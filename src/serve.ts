import type { DocumentConstructor, ExtendedSettings, IFileManager, IPermission, ImageConstructor, RequestBody, Settings } from '@squared-functions/types';
import type { ResponseData } from '@squared-functions/types/lib/squared';
import type { IRoute } from 'express';
import type { CorsOptions } from 'cors';

import path = require('path');
import fs = require('fs-extra');
import yargs = require('yargs');
import express = require('express');
import cors = require('cors');
import body_parser = require('body-parser');
import request = require('request');
import uuid = require('uuid');
import archiver = require('archiver');
import _7z = require('node-7z');
import yaml = require('js-yaml');
import chalk = require('chalk');

import FileManager = require('@squared-functions/file-manager');

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

interface CompressModule extends ExtendedSettings.CompressModule {
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
}

interface Route extends Partial<RouteHandler> {
    mount?: string;
    path?: string;
    handler?: string | string[];
    document?: string;
}

type RouteHandler = { [K in keyof Omit<IRoute, "path" | "stack"> | "connect" | "propfind" | "proppatch"]: string };

const JSON_CACHE: ObjectMap<PlainObject> = {};
const BLOB_CACHE: ObjectMap<{ filename: string; uri: string }> = {};

const app = express();
app.use(body_parser.urlencoded({ extended: true }));

const Module = FileManager.moduleCompress();
const Image = new Map<string, ImageConstructor>();

let documentModule: Undef<ObjectMap<ExtendedSettings.DocumentModule>>,
    taskModule: Undef<ObjectMap<ExtendedSettings.TaskModule>>,
    cloudModule: Undef<ExtendedSettings.CloudModule>,
    compressModule: Undef<CompressModule>,
    settings: ServeSettings = {},
    permission: Undef<IPermission>,
    path7za: Undef<string>,
    watchInterval: Undef<number>;

function installModules(this: IFileManager, query: StringMap, body: RequestBody) {
    if (documentModule && body.document) {
        for (const value of body.document) {
            const module = documentModule[value];
            if (module && module.handler) {
                try {
                    const instance = require(module.handler);
                    switch (value) {
                        case 'chrome':
                            this.install('document', instance, module, query.release === '1');
                            break;
                        default:
                            this.install('document', instance, module);
                            break;
                    }
                }
                catch (err) {
                    Module.writeFail(['Unable to load Document handler', value], err);
                }
            }
        }
    }
    if (taskModule && body.task) {
        for (const value of body.task) {
            const module = taskModule[value];
            if (module && module.handler && module.settings) {
                try {
                    const instance = require(module.handler);
                    this.install('task', instance, module);
                }
                catch (err) {
                    Module.writeFail(['Unable to load Task handler', value], err);
                }
            }
        }
    }
    if (Image) {
        this.install('image', Image);
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
        case '7z':
            Module.formatMessage(Module.logType.SYSTEM, 'ARCHIVE', ['Install required? <npm i 7zip-bin>', '7z'], 'Binary not found', { titleColor: 'yellow' });
            break;
        case 'archive':
            Module.writeFail(['Unable to create archive', hint], err);
            break;
        case 'download':
            Module.writeFail(['Unable to download file', hint], err);
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
        .epilogue('For more information and source: https://github.com/anpham6/squared')
        .argv as YargsArgv;

    let { NODE_ENV: ENV, PORT } = process.env;
    try {
        settings = fs.existsSync('./squared.settings.yml') && yaml.load(fs.readFileSync(path.resolve('./squared.settings.yml'), 'utf8')) as ServeSettings || require('./squared.settings.json');
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
        let mime = '';
        try {
            for (mime in settings.image) {
                const name = settings.image[mime];
                if (name) {
                    Image.set((mime !== 'handler' ? 'image/' : '') + mime, require(name));
                }
            }
        }
        catch (err) {
            Module.writeFail(['Unable to load Image handler', mime], err);
        }
    }
    if (!Image.has('handler')) {
        Image.set('handler', require('@squared-functions/image/jimp'));
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
        let mounts = 0,
            routes = 0,
            workspace = 0;
        for (const item of [settings.routing['__SHARED__'], settings.routing[ENV]]) {
            if (Array.isArray(item)) {
                for (const route of item) {
                    const { mount, path: dirname, document } = route;
                    if (mount && dirname) {
                        let data: Undef<StandardMap>;
                        if (document && (data = settings.document?.[document])) {
                            const { handler, settings: plugins } = data;
                            if (handler && plugins) {
                                try {
                                    const baseDir = path.resolve(mount);
                                    if (fs.lstatSync(baseDir).isDirectory()) {
                                        try {
                                            const target = FileManager.toPosix((dirname[0] !== '/' ? '/' : '') + dirname);
                                            const instance = new (require(handler) as DocumentConstructor)({} as RequestBody, data);
                                            app.get(target + '/*', async (req, res) => {
                                                const url = new URL(req.protocol + '://' + req.hostname + req.originalUrl);
                                                const params = new URLSearchParams(url.search);
                                                const type = params.get('type');
                                                const format = params.get('format');
                                                const mime = params.get('mime');
                                                if (mime) {
                                                    res.setHeader('Content-Type', mime);
                                                }
                                                let content = '';
                                                if (type && format && plugins[type]) {
                                                    const uri = path.join(baseDir, url.pathname.substring(target.length));
                                                    if (fs.existsSync(uri)) {
                                                        const result = await instance.transform(type, format, fs.readFileSync(uri, 'utf8'));
                                                        if (result) {
                                                            content = result[0];
                                                        }
                                                    }
                                                }
                                                res.send(content);
                                            });
                                            Module.formatMessage(Module.logType.SYSTEM, 'BUILD', `${chalk.bgGrey(baseDir)} ${chalk.yellow('->')} ${chalk.bold(target)}`, '', { titleColor: 'yellow' });
                                            ++workspace;
                                        }
                                        catch (err) {
                                            Module.writeFail(['Unable to load Document handler', document], err);
                                        }
                                    }
                                }
                                catch (err) {
                                    Module.writeFail(['Unable to mount directory', document], err);
                                }
                            }
                            else {
                                if (!handler) {
                                    Module.writeFail(['Document handler not found', document]);
                                }
                                if (!plugins) {
                                    Module.writeFail(['Document settings not found', document]);
                                }
                            }
                        }
                        else {
                            const pathname = path.join(__dirname, mount);
                            try {
                                app.use(dirname, express.static(pathname));
                                Module.formatMessage(Module.logType.SYSTEM, 'MOUNT', `${chalk.bgGrey(pathname)} ${chalk.yellow('->')} ${chalk.bold(dirname)}`, '', { titleColor: 'yellow' });
                                ++mounts;
                            }
                            catch (err) {
                                Module.writeFail(['Unable to mount directory', dirname], err);
                            }
                        }
                    }
                    else {
                        let handler = route.handler;
                        if (handler) {
                            if (typeof handler === 'string') {
                                handler = [handler];
                            }
                            let callback: FunctionType<string>[] | FunctionType<string> = [];
                            for (const content of handler) {
                                const method = Module.parseFunction(content);
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
                                if (pathname && typeof pathname === 'string') {
                                    try {
                                        app[attr](pathname, callback);
                                        Module.formatMessage(Module.logType.SYSTEM, 'ROUTE', chalk.bgGrey(pathname), '', { titleColor: 'yellow' });
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
            }
        }
        if (mounts) {
            console.log(`\n${chalk.bold(mounts)} ${mounts === 1 ? 'directory was' : 'directories were'} mounted.` + (routes || workspace ? '' : '\n'));
        }
        if (routes) {
            console.log(`\n${chalk.bold(routes)} ${routes === 1 ? 'route was' : 'routes were'} created.` + (workspace ? '' : '\n'));
        }
        if (workspace) {
            console.log(`\n${chalk.bold(workspace)} ${workspace === 1 ? 'workspace was' : 'workspaces were'} mounted.\n`);
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

    if (argv.cors) {
        app.use(cors({ origin: argv.cors }));
        app.options('*', cors());
    }
    else if (settings.cors && settings.cors.origin) {
        app.use(cors(settings.cors));
        app.options('*', cors());
        argv.cors = typeof settings.cors.origin === 'string' ? settings.cors.origin : 'true';
    }

    Module.formatMessage(Module.logType.SYSTEM, 'CORS', argv.cors ? chalk.green(argv.cors) : chalk.grey('disabled'), '', { titleColor: 'blue' });

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
                    manager.formatMessage(Module.logType.NODE, 'WRITE', [dirname, files.length + ' files']);
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
            if (path7za) {
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
                        manager.formatMessage(Module.logType.NODE, 'WRITE', [response.filename!, bytes + ' bytes']);
                    };
                    if (!use7z) {
                        const archive = archiver(format as archiver.Format, { zlib: { level: Module.gzipLevel } });
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
                        _7z.add(zippath, dirname + path.sep + '*', { $bin: path7za, recursive: true })
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
        if (path7za) {
            const match = /([^/\\]+)\.\w+?$/i.exec(append_to);
            if (match) {
                const zippath = path.join(dirname_zip, match[0]);
                const extractFull = () => {
                    _7z.extractFull(zippath, dirname, { $bin: path7za, recursive: true })
                        .on('end', () => {
                            resumeThread(match[1]);
                        })
                        .on('error', err => {
                            Module.writeFail(['Unable to decompress file', zippath], err);
                            resumeThread();
                        });
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
                Module.writeFail('Invalid archive format', new Error(append_to));
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
        let valid = true;
        const loadContent = (message: unknown, body: string) => {
            let data: Undef<string | object>;
            if (!message) {
                try {
                    switch (path.extname(uri).toLowerCase()) {
                        case '.json':
                        case '.js':
                            data = JSON.parse(body);
                            break;
                        case '.yml':
                        case '.yaml':
                            data = yaml.load(body) as object;
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
        else if (permission && fs.existsSync(uri = FileManager.resolveUri(uri))) {
            if (FileManager.isFileUNC(uri)) {
                valid = permission.hasUNCRead();
            }
            else {
                valid = permission.hasDiskRead();
            }
            if (valid) {
                fs.readFile(uri, 'utf8', (err, data) => loadContent(err, data));
            }
        }
        else {
            valid = false;
        }
        if (!valid) {
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