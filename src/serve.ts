import type { ResponseData } from '@squared-functions/types/lib/squared';

import type { DocumentConstructor, IFileManager, IPermission, ImageConstructor } from '@squared-functions/types';
import type { SourceMap, SourceMapOutput, TransformOutput } from '@squared-functions/types/lib/document';
import type { CloudModule, CompressModule, DocumentModule, TaskModule } from '@squared-functions/types/lib/module';
import type { RequestBody, Settings } from '@squared-functions/types/lib/node';

import type { IRoute } from 'express';
import type { CorsOptions } from 'cors';
import type * as Node_7z from 'node-7z';

import path = require('path');
import fs = require('fs-extra');
import yargs = require('yargs');
import express = require('express');
import cors = require('cors');
import body_parser = require('body-parser');
import request = require('request');
import mime = require('mime-types');
import uuid = require('uuid');
import archiver = require('archiver');
import decompress = require('decompress');
import yaml = require('js-yaml');
import toml = require('toml');
import chalk = require('chalk');

import FileManager = require('@squared-functions/file-manager');
import Document = require('@squared-functions/document');
import Image = require('@squared-functions/image');

interface ServeSettings extends Settings {
    env?: string;
    port?: StringMap;
    routing?: RoutingModule;
    cors?: CorsOptions;
    request_post_limit?: string;
    compress?: CompressModule;
}

interface RoutingModule {
    [key: string]: Route[];
}

interface ICompressModule extends CompressModule {
    "7za_bin"?: string;
}

interface YargsArgv {
    accessAll?: boolean;
    accessDisk?: boolean;
    accessUnc?: boolean;
    diskRead?: boolean;
    diskWrite?: boolean;
    uncRead?: boolean;
    uncWrite?: boolean;
    env?: string;
    port?: number;
    cors?: string;
    routing?: string;
}

interface Route extends Partial<RouteHandler> {
    mount?: string;
    path?: string;
    handler?: string | string[];
    document?: string;
    image?: string;
}

interface FileData {
    filename: string;
    uri: string;
}

type RouteHandler = { [K in keyof Omit<IRoute, "path" | "stack"> | "connect" | "propfind" | "proppatch"]: string };
type CallbackResponse = FunctionType<Promise<string> | string>;

const JSON_CACHE: ObjectMap<PlainObject> = {};
const BLOB_CACHE: ObjectMap<FileData> = {};

const app = express();
app.use(body_parser.urlencoded({ extended: true }));

const Module = FileManager.moduleCompress();
const imageMap = new Map<string, ImageConstructor>();

let settings: ServeSettings = {},
    documentModule: Undef<ObjectMap<DocumentModule>>,
    taskModule: Undef<ObjectMap<TaskModule>>,
    cloudModule: Undef<CloudModule>,
    compressModule: Undef<ICompressModule>,
    permission: Undef<IPermission>,
    prog7z: Undef<typeof Node_7z>,
    path7za: Undef<string>,
    watchInterval: Undef<number>;

function installModules(this: IFileManager, query: StringMap, body: RequestBody) {
    const { document, task } = body;
    if (documentModule && document) {
        for (const name of document) {
            const module = documentModule[name];
            if (module && module.handler) {
                try {
                    const instance = require(module.handler);
                    switch (name) {
                        case 'chrome':
                            this.install('document', instance, module, query.release === '1');
                            break;
                        default:
                            this.install('document', instance, module);
                            break;
                    }
                }
                catch (err) {
                    Module.writeFail(['Unable to load Document handler', name], err);
                }
            }
        }
    }
    if (taskModule && task) {
        for (const name of task) {
            const module = taskModule[name];
            if (module && module.handler && module.settings) {
                try {
                    const instance = require(module.handler);
                    this.install('task', instance, module);
                }
                catch (err) {
                    Module.writeFail(['Unable to load Task handler', name], err);
                }
            }
        }
    }
    if (imageMap.size) {
        this.install('image', imageMap);
    }
    if (compressModule) {
        this.install('compress');
    }
    if (cloudModule) {
        this.install('cloud', cloudModule);
    }
    if (query.watch === '1') {
        this.install('watch', watchInterval);
    }
}

function applySettings(this: IFileManager) {
    const apiKey = settings.compress?.tinify_api_key;
    if (apiKey) {
        for (const asset of this.assets) {
            if (asset.compress) {
                for (const item of asset.compress) {
                    switch (item.format) {
                        case 'png':
                        case 'jpeg':
                            if ((item.plugin ||= 'tinify') === 'tinify' && !(item.options ||= {}).apiKey) {
                                item.options.apiKey = apiKey;
                            }
                            break;
                    }
                }
            }
        }
    }
}

function writeFail(name: string, hint = '', err?: Null<Error>) {
    switch (name) {
        case 'archive':
            Module.writeFail(['Unable to create archive', hint], err);
            break;
        case 'download':
            Module.writeFail(['Unable to download file', hint], err);
            break;
        case 'decompress':
            Module.writeFail(['Unable to decompress file', hint], err);
            break;
        case '7z':
            Module.formatMessage(Module.logType.SYSTEM, 'ARCHIVE', ['Install required? <npm i 7zip-bin>', '7z'], 'Binary not found', { titleColor: 'yellow' });
            break;
    }
}

function parseErrors(errors: string[]) {
    const length = errors.length;
    if (length) {
        return length > 1 ? { hint: `FAIL: ${length} errors`, message: errors.map(value => '- ' + value).join('\n') } : { message: 'FAIL: ' + errors[0] };
    }
}

{
    const argv = yargs
        .usage('$0 [args]')
        .option('access-all', {
            type: 'boolean',
            description: 'Grant full disk and UNC privileges'
        })
        .option('access-disk', {
            alias: 'd',
            type: 'boolean',
            description: 'Grant full disk privileges'
        })
        .option('access-unc', {
            alias: 'u',
            type: 'boolean',
            description: 'Grant full UNC privileges'
        })
        .option('disk-read', {
            alias: 'r',
            type: 'boolean',
            description: 'Grant disk +r (read only)'
        })
        .option('disk-write', {
            alias: 'w',
            type: 'boolean',
            description: 'Grant disk +w (write only)'
        })
        .option('unc-read', {
            alias: 'y',
            type: 'boolean',
            description: 'Grant UNC +r (read only)'
        })
        .option('unc-write', {
            alias: 'z',
            type: 'boolean',
            description: 'Grant UNC +w (write only)'
        })
        .option('env', {
            alias: 'e',
            type: 'string',
            description: 'Set environment <prod|dev>',
            nargs: 1
        })
        .option('port', {
            alias: 'p',
            type: 'number',
            description: 'Set HTTP port number',
            nargs: 1
        })
        .option('cors', {
            alias: 'c',
            type: 'string',
            description: 'Enable CORS access to <origin|"*">',
            nargs: 1
        })
        .option('routing', {
            alias: 'a',
            type: 'string',
            description: 'Additional routing namespaces',
            nargs: 1
        })
        .epilogue('For more information and source: https://github.com/anpham6/squared-express')
        .argv as YargsArgv;

    let { NODE_ENV: ENV, PORT } = process.env;
    try {
        if (fs.existsSync('./squared.settings.yml')) {
            settings = yaml.load(fs.readFileSync(path.resolve('./squared.settings.yml'), 'utf8')) as ServeSettings;
        }
        else if (fs.existsSync('./squared.settings.toml')) {
            settings = toml.parse(fs.readFileSync(path.resolve('./squared.settings.toml'), 'utf8')) as ServeSettings;
        }
        else {
            settings = require('./squared.settings.json');
        }
        ({ document: documentModule, task: taskModule, compress: compressModule, cloud: cloudModule } = settings);
    }
    catch (err) {
        Module.writeFail(['Unable to load Settings file', 'squared'], err);
    }

    if (argv.accessAll) {
        settings.disk_read = true;
        settings.disk_write = true;
        settings.unc_read = true;
        settings.unc_write = true;
    }
    else {
        if (argv.accessDisk) {
            settings.disk_read = true;
            settings.disk_write = true;
        }
        else {
            if (argv.diskRead) {
                settings.disk_read = true;
            }
            if (argv.diskWrite) {
                settings.disk_write = true;
            }
        }
        if (argv.accessUnc) {
            settings.unc_read = true;
            settings.unc_write = true;
        }
        else {
            if (argv.uncRead) {
                settings.unc_read = true;
            }
            if (argv.uncWrite) {
                settings.unc_write = true;
            }
        }
    }

    if (compressModule) {
        try {
            prog7z = require('node-7z');
            const bin = compressModule['7za_bin'];
            if (bin && fs.existsSync(bin)) {
                path7za = bin;
            }
            else {
                ({ path7za } = require('7zip-bin'));
            }
        }
        catch {
        }
    }

    if (settings.image) {
        let ext = '';
        try {
            for (ext in settings.image) {
                const name = settings.image[ext];
                if (name) {
                    imageMap.set((ext !== 'handler' ? 'image/' : '') + ext, require(name));
                }
            }
        }
        catch (err) {
            Module.writeFail(['Unable to load Image handler', ext], err);
        }
    }
    if (!imageMap.has('handler')) {
        imageMap.set('handler', require('@squared-functions/image/jimp'));
    }

    if (settings.routing) {
        if (argv.env && settings.routing[argv.env.trim()]) {
            ENV = argv.env.trim();
        }
        else if (ENV && !settings.routing[ENV]) {
            ENV = settings.env;
        }
        if (!ENV || !settings.routing[ENV]) {
            ENV = 'development';
        }
        const expressMethods: (keyof RouteHandler)[] = [
            'all',
            'get',
            'post',
            'put',
            'delete',
            'patch',
            'options',
            'head',
            'checkout',
            'connect',
            'copy',
            'lock',
            'merge',
            'mkactivity',
            'mkcol',
            'move',
            'm-search',
            'notify',
            'propfind',
            'proppatch',
            'purge',
            'report',
            'search',
            'subscribe',
            'trace',
            'unlock',
            'unsubscribe'
        ];
        const mounted: ObjectMap<Set<string>> = {};
        const routing: [string, Route[]][] = [];
        const addMount = (method: keyof RouteHandler | "static", value: string) => (mounted[method] ||= new Set()).add(value);
        const wasMounted = (method: keyof RouteHandler | "static", value: string) => mounted[method] && mounted[method].has(value);
        if (argv.routing) {
            for (let route of argv.routing.split(',')) {
                const item = settings.routing[route = route.trim()];
                if (Array.isArray(item) && !routing.find(mount => mount[0] === route)) {
                    routing.push([route, item]);
                }
            }
        }
        routing.push(...[[ENV, settings.routing[ENV]], ['common', settings.routing.common]].filter(mount => Array.isArray(mount[1])) as [string, Route[]][]);
        if (routing.length) {
            console.log();
            for (const [namespace, item] of routing) {
                let mounts = 0,
                    routes = 0,
                    workspaces = 0;
                for (const route of item) {
                    const { mount, path: dirname, document, image } = route;
                    if (mount && dirname) {
                        let documentData: Undef<StandardMap>,
                            handler: Undef<string>;
                        if (document && (documentData = settings.document?.[document]) && (handler = documentData.handler) || (handler = image)) {
                            if (handler) {
                                const target = FileManager.toPosix((dirname[0] !== '/' ? '/' : '') + dirname);
                                const pathname = target + '/*';
                                if (!wasMounted('get', pathname)) {
                                    try {
                                        const baseDir = path.resolve(mount);
                                        if (fs.lstatSync(baseDir).isDirectory()) {
                                            const getSourceFile = (value: string) => path.join(baseDir, value.substring(target.length));
                                            const workspaceMounted = () => {
                                                Module.formatMessage(Module.logType.SYSTEM, 'BUILD', `${chalk.bgGrey(baseDir)} ${chalk.yellow('->')} ${chalk.bold(target)}`, '', { titleColor: 'yellow' });
                                                addMount('get', pathname);
                                                ++workspaces;
                                            };
                                            if (documentData) {
                                                if (documentData.settings) {
                                                    try {
                                                        const instance = new (require(handler) as DocumentConstructor)(documentData);
                                                        app.get(pathname, async (req, res, next) => {
                                                            const url = new URL(req.protocol + '://' + req.hostname + req.originalUrl);
                                                            const params = new URLSearchParams(url.search);
                                                            const type = params.get('type');
                                                            const format = params.get('format');
                                                            const sourceFile = getSourceFile(url.pathname);
                                                            if (type && format && documentData!.settings[type] && fs.existsSync(sourceFile)) {
                                                                const external: PlainObject = {};
                                                                params.forEach((value, key) => {
                                                                    switch (key) {
                                                                        case 'type':
                                                                        case 'format':
                                                                        case 'mime':
                                                                            return;
                                                                        case '~type':
                                                                        case '~format':
                                                                        case '~mime':
                                                                            key = key.substring(1);
                                                                            break;
                                                                    }
                                                                    const attrs = key.split('.');
                                                                    let current = external;
                                                                    do {
                                                                        const name = attrs.shift()!;
                                                                        if (attrs.length === 0) {
                                                                            switch (value) {
                                                                                case 'true':
                                                                                    current[name] = true;
                                                                                    break;
                                                                                case 'false':
                                                                                    current[name] = false;
                                                                                    break;
                                                                                case 'undefined':
                                                                                    current[name] = undefined;
                                                                                    break;
                                                                                case 'null':
                                                                                    current[name] = null;
                                                                                    break;
                                                                                case '{}':
                                                                                    current[name] = {};
                                                                                    break;
                                                                                case '[]':
                                                                                    current[name] = [];
                                                                                    break;
                                                                                default:
                                                                                    current[name] = !isNaN(+value) ? +value : value;
                                                                                    break;
                                                                            }
                                                                            break;
                                                                        }
                                                                        else {
                                                                            if (!current[name] || typeof current[name] !== 'object') {
                                                                                current[name] = {};
                                                                            }
                                                                            current = current[name] as PlainObject;
                                                                        }
                                                                    }
                                                                    while (true);
                                                                });
                                                                const options: TransformOutput = { sourceFile, external };
                                                                const code = fs.readFileSync(sourceFile, 'utf8');
                                                                try {
                                                                    const sourceMapResolve = require('source-map-resolve');
                                                                    try {
                                                                        const output = sourceMapResolve.resolveSourceMapSync(code, url.pathname, fs.readFileSync) as PlainObject; // eslint-disable-line @typescript-eslint/no-unsafe-call
                                                                        if (output) {
                                                                            const map = output.map as SourceMap;
                                                                            const sources = map.sources;
                                                                            options.sourcesRelativeTo = path.dirname(sourceFile);
                                                                            for (let i = 0; i < sources.length; ++i) {
                                                                                sources[i] = path.resolve(options.sourcesRelativeTo, sources[i]);
                                                                            }
                                                                            const sourceMap = Document.createSourceMap(code);
                                                                            sourceMap.nextMap('unknown', code, map);
                                                                            options.sourceMap = sourceMap;
                                                                        }
                                                                    }
                                                                    catch (err) {
                                                                        Module.writeFail(['Unable to parse source map', document!], err);
                                                                    }
                                                                }
                                                                catch {
                                                                }
                                                                const result = await instance.transform(type, code, format, options);
                                                                if (result) {
                                                                    if (result.map) {
                                                                        let sourceMappingURL = path.basename(sourceFile);
                                                                        if (!sourceMappingURL.endsWith(type)) {
                                                                            sourceMappingURL += '.' + type;
                                                                        }
                                                                        sourceMappingURL += '.' + format + '.map';
                                                                        Document.writeSourceMap(sourceFile, result as SourceMapOutput, { sourceMappingURL });
                                                                    }
                                                                    const contentType = params.get('mime') || mime.lookup(url.pathname);
                                                                    if (contentType) {
                                                                        res.setHeader('Content-Type', contentType);
                                                                    }
                                                                    res.send(result.code);
                                                                }
                                                                else {
                                                                    res.send(null);
                                                                }
                                                            }
                                                            else {
                                                                next();
                                                            }
                                                        });
                                                        workspaceMounted();
                                                    }
                                                    catch (err) {
                                                        Module.writeFail(['Unable to load Document handler', document!], err);
                                                    }
                                                }
                                                else {
                                                    Module.writeFail(['Document settings not found', document!]);
                                                }
                                            }
                                            else {
                                                try {
                                                    const instance = require(handler) as ImageConstructor;
                                                    if (instance.prototype instanceof Image) {
                                                        app.get(pathname, async (req, res, next) => {
                                                            const url = new URL(req.protocol + '://' + req.hostname + req.originalUrl);
                                                            const params = new URLSearchParams(url.search);
                                                            const command = params.get('command');
                                                            const sourceFile = getSourceFile(url.pathname);
                                                            if (command && fs.existsSync(sourceFile)) {
                                                                let contentType = mime.lookup(url.pathname) || await FileManager.resolveMime(sourceFile);
                                                                if (contentType && typeof contentType !== 'string') {
                                                                    contentType = contentType.mime;
                                                                }
                                                                const time = Date.now();
                                                                const result = await instance.transform(sourceFile, command, contentType);
                                                                if (result) {
                                                                    Module.writeTimeElapsed('IMAGE', command, time);
                                                                    res.setHeader('Content-Type', params.get('mime') || contentType || 'image/jpeg');
                                                                    if (result instanceof Buffer) {
                                                                        res.send(result);
                                                                    }
                                                                    else {
                                                                        res.sendFile(result);
                                                                    }
                                                                }
                                                                else {
                                                                    res.send(null);
                                                                }
                                                            }
                                                            else {
                                                                next();
                                                            }
                                                        });
                                                        workspaceMounted();
                                                    }
                                                    else {
                                                        Module.writeFail('Object does not extend ImageConstructor', new Error(handler));
                                                    }
                                                }
                                                catch (err) {
                                                    Module.writeFail(['Unable to load Image handler', image!], err);
                                                }
                                            }
                                        }
                                    }
                                    catch (err) {
                                        Module.writeFail(['Unable to mount directory', document || image!], err);
                                    }
                                }
                            }
                            else if (documentData) {
                                Module.writeFail(['Document handler not found', document!]);
                            }
                        }
                        else if (!wasMounted('static', dirname)) {
                            try {
                                const pathname = path.join(__dirname, mount);
                                app.use(dirname, express.static(pathname));
                                Module.formatMessage(Module.logType.SYSTEM, 'STATIC', `${chalk.bgGrey(pathname)} ${chalk.yellow('->')} ${chalk.bold(dirname)}`, '', { titleColor: 'yellow' });
                                addMount('static', dirname);
                                ++mounts;
                            }
                            catch (err) {
                                Module.writeFail(['Unable to mount static directory', dirname], err);
                            }
                        }
                    }
                    else {
                        let handler = route.handler;
                        if (handler) {
                            if (typeof handler === 'string') {
                                handler = [handler];
                            }
                            let callback: CallbackResponse[] | CallbackResponse = [];
                            for (const content of handler) {
                                const method = FileManager.parseFunction(content, 'express');
                                if (method) {
                                    callback.push(method);
                                }
                            }
                            switch (callback.length) {
                                case 0:
                                    continue;
                                case 1:
                                    callback = callback[0];
                                    break;
                            }
                            let found = false;
                            for (const attr of expressMethods) {
                                const pathname = route[attr];
                                if (pathname && typeof pathname === 'string' && !wasMounted(attr, pathname)) {
                                    try {
                                        app[attr](pathname, callback);
                                        Module.formatMessage(Module.logType.SYSTEM, 'ROUTE', chalk.bgGrey(pathname), '', { titleColor: 'yellow' });
                                        addMount(attr, pathname);
                                        ++routes;
                                    }
                                    catch (err) {
                                        Module.writeFail(['Unable to create route', pathname], err);
                                    }
                                    found = true;
                                    break;
                                }
                            }
                            if (!found) {
                                app.use(callback);
                            }
                        }
                    }
                }
                if (mounts > 0 || routes > 0 || workspaces > 0) {
                    console.log();
                    Module.formatMessage(Module.logType.SYSTEM, ' READY ', [namespace, `static: ${mounts} / route: ${routes}`], workspaces ? 'workspace: ' + workspaces : null, { titleColor: 'white', titleBgColor: 'bgGreen' });
                }
                else {
                    Module.formatMessage(Module.logType.SYSTEM, ' CHECK ', [namespace, 'No routes were mounted'], null, { titleColor: 'grey', titleBgColor: 'bgYellow' });
                }
                console.log();
            }
        }
    }
    else {
        ENV ||= 'development';
        app.use('/', express.static(path.join(__dirname, 'html')));
        app.use('/dist', express.static(path.join(__dirname, 'dist')));
        Module.writeFail('Routing not defined');
    }

    FileManager.loadSettings(settings);
    permission = FileManager.getPermission(settings);

    Module.formatMessage(Module.logType.SYSTEM, 'DISK', (permission.hasDiskRead() ? chalk.green('+') : chalk.red('-')) + 'r ' + (permission.hasDiskWrite() ? chalk.green('+') : chalk.red('-')) + 'w', '', { titleColor: 'blue' });
    Module.formatMessage(Module.logType.SYSTEM, 'UNC', (permission.hasUNCRead() ? chalk.green('+') : chalk.red('-')) + 'r ' + (permission.hasUNCWrite() ? chalk.green('+') : chalk.red('-')) + 'w', '', { titleColor: 'blue' });

    let origin: Undef<string> = argv.cors,
        corsOptions: Undef<CorsOptions>;
    if (origin) {
        corsOptions = { origin };
    }
    else if (corsOptions = settings.cors) {
        origin = corsOptions.origin as string;
    }
    if (origin) {
        app.use(cors(corsOptions));
        app.options('*', cors());
        if (typeof origin !== 'string') {
            origin = 'true';
        }
    }

    Module.formatMessage(Module.logType.SYSTEM, 'CORS', origin ? chalk.green(origin) : chalk.grey('disabled'), '', { titleColor: 'blue' });

    if (argv.port) {
        PORT = argv.port.toString();
    }
    else if (!PORT && settings.port) {
        PORT = settings.port[ENV];
    }

    PORT = +PORT! >= 0 && PORT || '3000';

    app.use(body_parser.json({ limit: settings.request_post_limit || '250mb' }));
    app.listen(PORT, () => {
        console.log('');
        Module.formatMessage(Module.logType.SYSTEM, ENV!.toUpperCase(), 'Express server listening on port ' + chalk.bold(PORT), '', { titleColor: ENV!.startsWith('prod') ? 'green' : 'yellow' });
        console.log('');
    });
    process.env.NODE_ENV = ENV;
    process.env.PORT = PORT;
}

app.post('/api/v1/assets/copy', (req, res) => {
    const query = req.query;
    const dirname = path.normalize(query.to as string);
    let error: Undef<true | ResponseData>;
    if (dirname && permission && (error = FileManager.hasPermission(dirname, permission)) === true) {
        try {
            if (query.empty === '2') {
                try {
                    fs.emptyDirSync(dirname);
                }
                catch (err) {
                    Module.writeFail(['Unable to empty base directory', dirname], err);
                }
            }
            const body = req.body as RequestBody;
            const manager = new FileManager(
                dirname,
                body,
                (errors: string[]) => {
                    const files = Array.from(manager.files);
                    res.json({
                        success: files.length > 0,
                        files,
                        error: parseErrors(errors)
                    } as ResponseData);
                    manager.formatMessage(Module.logType.NODE, ' WRITE ', [dirname, files.length + ' files']);
                },
                settings
            );
            installModules.call(manager, query as StringMap, body);
            applySettings.call(manager);
            manager.processAssets(query.empty === '1');
        }
        catch (err) {
            res.json(FileManager.responseError('FILE: Unknown', (err as Error).toString()));
        }
    }
    else if (error) {
        res.json(error);
    }
});

app.post('/api/v1/assets/archive', (req, res) => {
    const query = req.query;
    const copy_to = query.to && path.normalize(query.to as string);
    let dirname = path.join(__dirname, 'tmp', uuid.v4()),
        dirname_zip: string;
    try {
        if (copy_to && permission && FileManager.hasPermission(dirname, permission) === true) {
            dirname = copy_to;
        }
        else {
            fs.mkdirpSync(dirname);
        }
        dirname_zip = dirname + '-zip';
        fs.mkdirpSync(dirname_zip);
    }
    catch (err) {
        res.json(FileManager.responseError(`DIRECTORY: ${dirname}`, (err as Error).toString()));
        return;
    }
    let append_to = query.append_to as string,
        use7z = false,
        useGzip = false,
        format = (query.format as string || 'zip').toLowerCase();
    if (path.isAbsolute(append_to)) {
        append_to = path.normalize(append_to);
    }
    switch (format) {
        case '7z':
            if (prog7z && path7za) {
                use7z = true;
            }
            else {
                writeFail('7z');
                format = 'zip';
            }
            break;
        case 'gz':
        case 'tgz':
            useGzip = true;
        case 'tar':
            break;
        default:
            format = 'zip';
            break;
    }
    const resumeThread = (filename = '') => {
        try {
            filename = (query.filename || filename || uuid.v4()) + '.' + format;
            let zippath = path.join(dirname_zip, filename);
            const body = req.body as RequestBody;
            const manager = new FileManager(
                dirname,
                body,
                errors => {
                    const response: ResponseData = {
                        success: manager.files.size > 0,
                        filename,
                        files: Array.from(manager.files),
                        error: parseErrors(errors)
                    };
                    const complete = (bytes: number) => {
                        if (bytes) {
                            const downloadKey = uuid.v4();
                            response.bytes = bytes;
                            response.downloadKey = downloadKey;
                            BLOB_CACHE[downloadKey] = { filename, uri: zippath };
                        }
                        else {
                            response.success = false;
                        }
                        res.json(response);
                        manager.formatMessage(Module.logType.NODE, ' WRITE ', [response.filename!, bytes + ' bytes']);
                    };
                    if (!use7z) {
                        const archive = archiver(format as archiver.Format, { zlib: { level: Module.level.gz } });
                        archive.pipe(
                            fs.createWriteStream(zippath)
                                .on('close', () => {
                                    if (useGzip) {
                                        const gz = format === 'tgz' ? zippath.replace(/tar$/, 'tgz') : zippath + '.gz';
                                        Module.createWriteStreamAsGzip(zippath, gz)
                                            .on('finish', () => {
                                                zippath = gz;
                                                response.filename = path.basename(gz);
                                                complete(FileManager.getFileSize(gz));
                                            })
                                            .on('error', err => {
                                                response.success = false;
                                                writeFail('archive', format, err);
                                                res.json(response);
                                            });
                                    }
                                    else {
                                        complete(archive.pointer());
                                    }
                                })
                                .on('error', err => writeFail('archive', format, err))
                        );
                        archive.directory(dirname, false);
                        archive.finalize();
                    }
                    else {
                        prog7z!.add(zippath, dirname + path.sep + '*', { $bin: path7za, recursive: true })
                            .on('end', () => complete(FileManager.getFileSize(zippath)))
                            .on('error', err => writeFail('archive', format, err));
                    }
                },
                settings
            );
            installModules.call(manager, query as StringMap, body);
            applySettings.call(manager);
            manager.processAssets();
        }
        catch (err) {
            res.json(FileManager.responseError('FILE: Unknown', (err as Error).toString()));
        }
    };
    if (append_to) {
        const match = /([^/\\]+)\.(\w+?)$/.exec(append_to);
        if (match && (prog7z && path7za || /zip|tar|gz|bz|bz2|bzip2/i.test(match[2]))) {
            const zippath = path.join(dirname_zip, match[0]);
            const extractFull = () => {
                if (prog7z && path7za) {
                    prog7z.extractFull(zippath, dirname, { $bin: path7za, recursive: true })
                        .on('end', () => resumeThread(match[1]))
                        .on('error', err => {
                            writeFail('decompress', match[0], err);
                            resumeThread();
                        });
                }
                else {
                    decompress(zippath, dirname)
                        .then(() => resumeThread(match[1]))
                        .catch(err => {
                            writeFail('decompress', match[0], err);
                            resumeThread();
                        });
                }
            };
            try {
                if (FileManager.isFileHTTP(append_to)) {
                    const stream = fs.createWriteStream(zippath);
                    stream.on('finish', extractFull);
                    let error: Undef<boolean>;
                    request(append_to)
                        .on('response', response => {
                            const statusCode = response.statusCode;
                            if (statusCode >= 300) {
                                writeFail('download', append_to, new Error(statusCode + ' ' + response.statusMessage));
                                error = true;
                            }
                        })
                        .on('error', err => {
                            if (!error) {
                                writeFail('download', append_to, err);
                            }
                            resumeThread();
                        })
                        .pipe(stream);
                    return;
                }
                else if (fs.existsSync(append_to = FileManager.resolveUri(append_to))) {
                    if (FileManager.isFileUNC(append_to)) {
                        if (!permission || !permission.hasUNCRead()) {
                            res.json(FileManager.responseError('OPTION: --unc-read', 'Reading from UNC shares is not enabled.'));
                        }
                        else {
                            fs.copyFile(append_to, zippath, extractFull);
                        }
                        return;
                    }
                    else if (path.isAbsolute(append_to)) {
                        if (!permission || !permission.hasDiskRead()) {
                            res.json(FileManager.responseError('OPTION: --disk-read', 'Reading from disk is not enabled.'));
                        }
                        else {
                            fs.copyFile(append_to, zippath, extractFull);
                        }
                        return;
                    }
                }
                Module.writeFail('Archive not found', new Error(append_to));
            }
            catch (err) {
                Module.writeFail(zippath, err);
            }
        }
        else {
            writeFail('7z');
        }
    }
    resumeThread();
});

app.get('/api/v1/loader/data/json', (req, res) => {
    let uri = req.query.key as string;
    const cache = req.query.cache === '1';
    if (uri) {
        const loadContent = (message: unknown, body: string) => {
            let data: Undef<string | object>;
            if (!message) {
                try {
                    let mime = req.query.mime;
                    if (mime) {
                        mime = '.' + mime;
                    }
                    switch ((mime || path.extname(uri)).toLowerCase()) {
                        case '.js':
                        case '.mjs':
                        case '.json':
                        case '.jsonp':
                        case '.jsonld':
                        case '.map':
                            data = JSON.parse(body);
                            break;
                        case '.yml':
                        case '.yaml':
                            data = yaml.load(body) as object;
                            break;
                        case '.toml':
                            data = toml.parse(body);
                            break;
                    }
                }
                catch (err) {
                    message = err;
                }
            }
            if (typeof data === 'object') {
                if (cache) {
                    JSON_CACHE[uri] = data as PlainObject;
                }
                res.json({ success: true, data } as ResponseData);
            }
            else {
                res.json(FileManager.responseError(message as Error, `FILE: Unable to download (${uri})`));
            }
        };
        if (cache && JSON_CACHE[uri] || FileManager.isUUID(uri)) {
            const data = JSON_CACHE[uri];
            if (data) {
                res.json({ success: true, data } as ResponseData);
            }
            else {
                res.json(FileManager.responseError(uri, 'CACHE: Could not locate key'));
            }
        }
        else if (FileManager.isFileHTTP(uri)) {
            request(uri, (err, response) => loadContent(err, response.body));
        }
        else if (permission && fs.existsSync(uri = FileManager.resolveUri(uri)) && (FileManager.isFileUNC(uri) ? permission.hasUNCRead() : permission.hasDiskRead())) {
            fs.readFile(uri, 'utf8', (err, data) => loadContent(err, data));
        }
        else {
            res.json(FileManager.responseError('FILE: Unknown', uri));
        }
    }
});

app.get('/api/v1/loader/data/blob', (req, res) => {
    const key = req.query.key as string;
    const data = BLOB_CACHE[key];
    if (data) {
        const cache = req.query.cache;
        const uri = data.uri;
        if (cache === '0') {
            delete BLOB_CACHE[key];
        }
        res.download(uri, data.filename, err => {
            if (err) {
                Module.writeFail(['Unable to send file', uri], err);
            }
        });
    }
    else {
        res.send(null);
    }
});