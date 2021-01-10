import type { ExtendedSettings, IFileManager, ImageConstructor, RequestBody, Settings } from '@squared-functions/types';
import type { ResponseData } from '@squared-functions/types/lib/squared';
import type { CorsOptions } from 'cors';
import type { IRoute } from 'express';

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
}

type RouteHandler = { [K in keyof Omit<IRoute, "path" | "stack"> | "connect" | "propfind" | "proppatch"]: string };

const JSON_CACHE: ObjectMap<PlainObject> = {};
const BLOB_CACHE: StringMap = {};

const app = express();
app.use(body_parser.urlencoded({ extended: true }));

const Node = FileManager.moduleNode();

let Image: Undef<ImageConstructor>,
    documentModule: Undef<ObjectMap<ExtendedSettings.DocumentModule>>,
    taskModule: Undef<ObjectMap<ExtendedSettings.TaskModule>>,
    cloudModule: Undef<ExtendedSettings.CloudModule>,
    compressModule: Undef<CompressModule>,
    path7za: Undef<string>,
    watchInterval: Undef<number>;

function installModules(manager: IFileManager, query: StringMap, document: Undef<string[]>, task: Undef<string[]>) {
    if (documentModule && document) {
        for (const value of document) {
            const module = documentModule[value];
            if (module && module.handler) {
                try {
                    const instance = require(module.handler);
                    switch (value) {
                        case 'chrome':
                            manager.install('document', instance, module, query.release === '1');
                            break;
                        default:
                            manager.install('document', instance, module);
                            break;
                    }
                }
                catch (err) {
                    Node.writeFail(['Unable to load Document handler', value], err);
                }
            }
        }
    }
    if (taskModule && task) {
        for (const value of task) {
            const module = taskModule[value];
            if (module && module.handler && module.settings) {
                try {
                    const instance = require(module.handler);
                    manager.install('task', instance, module);
                }
                catch (err) {
                    Node.writeFail(['Unable to load Task handler', value], err);
                }
            }
        }
    }
    if (Image) {
        manager.install('image', Image);
    }
    if (compressModule) {
        manager.install('compress');
    }
    if (cloudModule) {
        manager.install('cloud', cloudModule);
    }
    if (query.watch === '1') {
        manager.install('watch', watchInterval);
    }
}

function writeFail(name: string, hint = '', err?: unknown) {
    switch (name) {
        case '7z':
            Node.formatMessage(Node.logType.NODE, 'ARCHIVE', ['Install required? [npm i 7zip-bin]', '7z'], 'Binary not found', { titleColor: 'yellow' });
            break;
        case 'archive':
            Node.writeFail(['Unable to create archive', hint], err);
            break;
        case 'download':
            Node.writeFail(['Unable to download file', hint], err);
            break;
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

    let { NODE_ENV: ENV, PORT } = process.env,
        ignorePermissions = false;
    if (argv.accessAll) {
        Node.setDiskRead();
        Node.setDiskWrite();
        Node.setUNCRead();
        Node.setUNCWrite();
        ignorePermissions = true;
    }
    else {
        if (argv.accessDisk) {
            Node.setDiskRead();
            Node.setDiskWrite();
            ignorePermissions = true;
        }
        else {
            if (argv.diskRead) {
                Node.setDiskRead();
                ignorePermissions = true;
            }
            if (argv.diskWrite) {
                Node.setDiskWrite();
                ignorePermissions = true;
            }
        }
        if (argv.accessUnc) {
            Node.setUNCRead();
            Node.setUNCWrite();
            ignorePermissions = true;
        }
        else {
            if (argv.uncRead) {
                Node.setUNCRead();
                ignorePermissions = true;
            }
            if (argv.uncWrite) {
                Node.setUNCWrite();
                ignorePermissions = true;
            }
        }
    }

    let settings: ServeSettings = {};
    try {
        settings = fs.existsSync('./squared.settings.yml') && yaml.load(fs.readFileSync(path.resolve('./squared.settings.yml'), 'utf8')) as ServeSettings || require('./squared.settings.json');
        ({ document: documentModule, task: taskModule, compress: compressModule, cloud: cloudModule } = settings);
        FileManager.loadSettings(settings, ignorePermissions);
    }
    catch (err) {
        Node.writeFail(['Unable to load Settings file', 'squared'], err);
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

    try {
        Image = require(settings.image?.handler || '@squared-functions/image/jimp');
    }
    catch (err) {
        Node.writeFail(['Unable to load Image handler', settings.image!.handler!], err);
        Image = require('@squared-functions/image/jimp');
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
            routes = 0;
        for (const item of [settings.routing['__SHARED__'], settings.routing[ENV]]) {
            if (Array.isArray(item)) {
                for (const route of item) {
                    const { path: dirname, mount } = route;
                    if (dirname && mount) {
                        const pathname = path.join(__dirname, mount);
                        try {
                            app.use(dirname, express.static(pathname));
                            Node.formatMessage(Node.logType.SYSTEM, 'MOUNT', `${chalk.bgGrey(pathname)} ${chalk.yellow('->')} ${chalk.bold(dirname)}`, '', { titleColor: 'yellow' });
                            ++mounts;
                        }
                        catch (err) {
                            Node.writeFail(['Unable to mount directory', dirname], err);
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
                                const method = Node.parseFunction(content);
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
                                        Node.formatMessage(Node.logType.SYSTEM, 'ROUTE', chalk.bgGrey(pathname), '', { titleColor: 'yellow' });
                                        ++routes;
                                    }
                                    catch (err) {
                                        Node.writeFail(['Unable to create route', pathname], err);
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
            console.log(`\n${chalk.bold(mounts)} ${mounts === 1 ? 'directory was' : 'directories were'} mounted.${routes ? '' : '\n'}`);
        }
        if (routes) {
            console.log(`\n${chalk.bold(routes)} ${routes === 1 ? 'route was' : 'routes were'} created.\n`);
        }
    }
    else {
        ENV ||= 'development';
        app.use('/', express.static(path.join(__dirname, 'html')));
        app.use('/dist', express.static(path.join(__dirname, 'dist')));
        Node.writeFail('Routing not defined');
    }

    Node.formatMessage(Node.logType.SYSTEM, 'DISK', (Node.hasDiskRead() ? chalk.green('+') : chalk.red('-')) + 'r ' + (Node.hasDiskWrite() ? chalk.green('+') : chalk.red('-')) + 'w', '', { titleColor: 'blue' });
    Node.formatMessage(Node.logType.SYSTEM, 'UNC', (Node.hasUNCRead() ? chalk.green('+') : chalk.red('-')) + 'r ' + (Node.hasUNCWrite() ? chalk.green('+') : chalk.red('-')) + 'w', '', { titleColor: 'blue' });

    if (argv.cors) {
        app.use(cors({ origin: argv.cors }));
        app.options('*', cors());
    }
    else if (settings.cors && settings.cors.origin) {
        app.use(cors(settings.cors));
        app.options('*', cors());
        argv.cors = typeof settings.cors.origin === 'string' ? settings.cors.origin : 'true';
    }

    Node.formatMessage(Node.logType.SYSTEM, 'CORS', argv.cors ? chalk.green(argv.cors) : chalk.grey('disabled'), '', { titleColor: 'blue' });

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
        Node.formatMessage(Node.logType.SYSTEM, ENV!.toUpperCase(), 'Express server listening on port ' + chalk.bold(PORT), '', { titleColor: ENV!.startsWith('prod') ? 'green' : 'yellow' });
        console.log('');
    });
    process.env.NODE_ENV = ENV;
    process.env.PORT = PORT;
}

app.post('/api/v1/assets/copy', (req, res) => {
    const query = req.query;
    const dirname = path.normalize(query.to as string);
    if (dirname && FileManager.hasPermissions(dirname, res)) {
        try {
            const body = req.body as RequestBody;
            const manager = new FileManager(
                dirname,
                body,
                function(this: IFileManager) {
                    res.json({ success: this.files.size > 0, files: Array.from(this.files) } as ResponseData);
                    manager.formatMessage(Node.logType.NODE, 'WRITE', [dirname, this.files.size + ' files'], '');
                }
            );
            installModules(manager, query as StringMap, body.document, body.task);
            manager.processAssets(query.empty === '1');
        }
        catch (err) {
            res.json(Node.getResponseError('FILE: Unknown', (err as Error).toString()));
        }
    }
});

app.post('/api/v1/assets/archive', (req, res) => {
    const query = req.query;
    const copy_to = query.to && path.normalize(query.to as string);
    let dirname = path.join(__dirname, 'tmp', uuid.v4()),
        dirname_zip: string;
    try {
        if (copy_to && FileManager.hasPermissions(copy_to, res)) {
            dirname = copy_to;
        }
        else {
            fs.mkdirpSync(dirname);
        }
        dirname_zip = dirname + '-zip';
        fs.mkdirpSync(dirname_zip);
    }
    catch (err) {
        res.json(Node.getResponseError(`DIRECTORY: ${dirname}`, (err as Error).toString()));
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
    const resumeThread = (zipname?: string) => {
        zipname = (query.filename || zipname || uuid.v4()) + '.' + format;
        let zippath = path.join(dirname_zip, zipname);
        const body = req.body as RequestBody;
        const manager = new FileManager(
            dirname,
            body,
            () => {
                const response: ResponseData = {
                    success: manager.files.size > 0,
                    zipname,
                    files: Array.from(manager.files)
                };
                const complete = (bytes: number) => {
                    if (bytes) {
                        const downloadKey = uuid.v4();
                        response.bytes = bytes;
                        response.downloadKey = downloadKey;
                        BLOB_CACHE[downloadKey] = zippath;
                    }
                    else {
                        response.success = false;
                    }
                    res.json(response);
                    manager.formatMessage(Node.logType.NODE, 'WRITE', [response.zipname!, bytes + ' bytes']);
                };
                if (!use7z) {
                    const archive = archiver(format as archiver.Format, { zlib: { level: FileManager.moduleCompress().gzipLevel } });
                    const output = fs.createWriteStream(zippath);
                    output
                        .on('close', () => {
                            if (useGzip) {
                                const gz = format === 'tgz' ? zippath.replace(/tar$/, 'tgz') : zippath + '.gz';
                                FileManager.moduleCompress().createWriteStreamAsGzip(zippath, gz)
                                    .on('finish', () => {
                                        zippath = gz;
                                        response.zipname = path.basename(gz);
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
                        .on('error', err => writeFail('archive', format, err));
                    archive.pipe(output);
                    archive.directory(dirname, false);
                    archive.finalize();
                }
                else {
                    _7z.add(zippath, dirname + path.sep + '*', { $bin: path7za, recursive: true })
                        .on('end', () => complete(FileManager.getFileSize(zippath)))
                        .on('error', err => writeFail('archive', format, err));
                }
            }
        );
        installModules(manager, query as StringMap, body.document, body.task);
        try {
            manager.processAssets();
        }
        catch (err) {
            res.json(Node.getResponseError('FILE: Unknown', (err as Error).toString()));
        }
    };
    if (append_to) {
        if (path7za) {
            const match = /([^/\\]+)\.\w+?$/i.exec(append_to);
            if (match) {
                const zippath = path.join(dirname_zip, match[0]);
                const decompress = () => {
                    _7z.extractFull(zippath, dirname, { $bin: path7za, recursive: true })
                        .on('end', () => {
                            resumeThread(match[1]);
                        })
                        .on('error', err => {
                            Node.writeFail(['Unable to decompress file', zippath], err);
                            resumeThread();
                        });
                };
                try {
                    if (Node.isFileURI(append_to)) {
                        const stream = fs.createWriteStream(zippath);
                        stream.on('finish', decompress);
                        let error: Undef<boolean>;
                        request(append_to)
                            .on('response', response => {
                                const statusCode = response.statusCode;
                                if (statusCode >= 300) {
                                    writeFail('download', append_to, statusCode + ' ' + response.statusMessage);
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
                    else if (fs.existsSync(append_to)) {
                        if (Node.isFileUNC(append_to)) {
                            if (!Node.hasUNCRead()) {
                                res.json(Node.getResponseError('OPTION: --unc-read', 'Reading from UNC shares is not enabled.'));
                                return;
                            }
                        }
                        else if (!Node.hasDiskRead() && path.isAbsolute(append_to)) {
                            res.json(Node.getResponseError('OPTION: --disk-read', 'Reading from disk is not enabled.'));
                            return;
                        }
                        fs.copyFile(append_to, zippath, decompress);
                        return;
                    }
                    Node.writeFail('Archive not found', append_to);
                }
                catch (err) {
                    Node.writeFail(zippath, err);
                }
            }
            else {
                Node.writeFail('Invalid archive format', append_to);
            }
        }
        else {
            writeFail('7z');
        }
    }
    resumeThread();
});

app.get('/api/v1/loader/data/json', (req, res) => {
    const uri = req.query.key as string;
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
                res.json(Node.getResponseError(`FILE: Unable to download (${uri})`, message as Error));
            }
        };
        if (cache && JSON_CACHE[uri] || Node.isUUID(uri)) {
            const data = JSON_CACHE[uri];
            if (data) {
                res.json({ success: true, data } as ResponseData);
            }
            else {
                res.json(Node.getResponseError('CACHE: Could not locate key', uri));
            }
        }
        else if (Node.isFileURI(uri)) {
            request(uri, (err, response) => loadContent(err, response.body));
        }
        else if (fs.existsSync(uri)) {
            if (Node.isFileUNC(uri)) {
                valid = Node.hasUNCRead();
            }
            else {
                valid = Node.hasDiskRead();
            }
            if (valid) {
                fs.readFile(uri, 'utf8', (err, data) => loadContent(err, data));
            }
        }
        else {
            valid = false;
        }
        if (!valid) {
            res.json(Node.getResponseError('FILE: Unknown', uri));
        }
    }
});

app.get('/api/v1/loader/data/blob', (req, res) => {
    const key = req.query.key as string;
    const uri = BLOB_CACHE[key];
    if (uri) {
        if (req.query.cache === '0') {
            delete BLOB_CACHE[key];
        }
        res.sendFile(uri, err => {
            if (err) {
                Node.writeFail(['Unable to send file', uri], err);
            }
        });
    }
});