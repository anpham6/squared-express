## squared-express 0.4

```xml
<!-- NOTE: cd ./dist -->

1. squared.settings.[json|yml] (configure)

2. node serve.js [--help]
```

### squared 2.3

Typically you will be using squared with squared-express although it can also be used to copy or archive files with the API routes and JSON.

```javascript
const data = {
    filename: 'archive1', // optional
    format: 'zip', // optional (zip | 7z | gz | tar)
    assets: [ // optional
        {
            pathname: 'app/src/main/res/drawable',
            filename: 'ic_launcher_background.xml',
            uri: 'http://localhost:3000/common/images/ic_launcher_background.xml',
            compress: [{ format: 'gz', level: 9 }, { format: 'br' }] // optional
        }
    ],

    // All attributes are optional (case-sensitive except extension)
    exclusions: {
        glob: ['**/*.zip'],
        pathname: ['app/build', 'app/libs'],
        filename: ['ic_launcher_foreground.xml'],
        extension: ['iml', 'pro'],
        pattern: ['output', /grad.+?\./i, '\\.git']
    }
};

// android: Project based
squared.save(); // Uses defaults from settings

squared.saveAs('archive1.zip', data); // optional: "data"
squared.appendTo('/path/project.zip');
squared.copyTo('/path/project');

// chrome: File based
squared.saveFiles('archive.7z', data); // required: "data"
squared.appendFiles('http://hostname/project.zip', data);
squared.copyFiles('/path/www', data);
```

The same "data" object can be sent as JSON in a POST body request.

### Archiving

Supported formats:

```javascript
* zip
* 7z // npm i 7zip-bin
* gz
* tar
```

You can use a locally installed 7z by providing the full location of the binary (7za or 7z.exe) in squared.settings.json.

### Routing

Simple routing and also middleware can be loaded using locally evaluated functions in case you need additional functionality. It is not recommended you use this package in production environments when custom routes are defined.

https://expressjs.com/en/guide/routing.html

```javascript
// squared.settings.[json|yml]

{
  "routing": {
    "__SHARED__": [
      { "mount": "html", "path": "/" },
      { "mount": "dist", "path": "/dist" },
      { "get": "/index.html", "handler": "./index-html.js" }, // handler file paths are relative and start with either './' OR '../'
      { "all": "/route/pathname", "handler": ["./handler-1.js", "./handler-2.js"] },
      { "handler": "./middleware.js" }
    ],
    "production": [
      { "post": "/data/:userId", "handler": "function (req, res) { res.send(req.params); }" } // handler contents always start with "function"
    ]
  }
}

// index-html.js
function (req, res) {
    res.send('<html><body><!-- content --></body></html>');
}

// handler-1.js
function (req, res, next) {
    /* handler-1: code */
    next();
}

// handler-2.js
function (req, res) { /* handler-2: code */ }

// middleware.js
function () {
    const cookieParser = require('cookie-parser'); // npm i cookie-parser
    return cookieParser();
}
```

### Workspaces

Text based documents which require a preprocessor before being rendered can have the working live document precompiled before it is parsed by squared. It is not recommended for use in production deployments.

```javascript
// squared.settings.[json|yml]

{
  "routing": {
    "development": [
      { "mount": "../local/src", "path": "/workspace-1", "document": "chrome" }, // Without "document" it is treated as an ordinary static mount
      { "mount": "../local/html", "path": "/workspace-2", "document": "chrome" }
    ]
  },
  "chrome": {
    "handler": "@squared-functions/document/chrome",
    "eval_function": true,
    "settings": {
      "js": { // query param: "type"
        "rollup": { // built-in transformer
          "typescript": { // query param: "format"
            "output": {
              "format": "es",
              "sourcemap": "inline"  // Only inline source maps are supported
            },
            "plugins": [["@rollup/plugin-typescript", { lib: ["es5", "es6", "dom"], target: "es5" }], "rollup-plugin-terser"] // npm i @rollup/plugin-typescript && npm i rollup-plugin-terser
          }
        }
      },
      "css": {
        "sass": { // NPM package name
          "demo": "function (context, value, options) { return context.renderSync({ ...options, data: value }, functions: {}); }" // synchronous
          "demo-output": { // function param: "options" (optional)
            "indentedSyntax": true,
            "outputStyle": "compressed"
          }
        },
        "postcss": { // built-in transformer
          "demo-2": { // format names are unique per "type"
            "plugins": ["autoprefixer", "cssnano"] // npm i autoprefixer && npm i cssnano
          }
        }
      }
    }
}
```
NPM plugins have to be installed manually and are usually custom written. There are only a few built-in transformers from [squared-functions](https://github.com/anpham6/squared-functions#readme).

Evaluated functions in configuration files or HTML templates are synchronous. Routines that are asynchronous require NPM hosted packages and are treated similarly to a built-in transformer.

```html
<html>
<head>
    <!-- ../local/src/util.ts -->
    <script type="text/javascript" src="/workspace-1/src/util.ts?format=typescript&type=js"></script>

    <!-- ../local/html/template-1.sass -->
    <link rel="stylesheet" type="text/css" href="/workspace-2/template-1.sass?format=demo&type=css&mime=text/css" /> <!-- "mime" is optional except for some file types -->

    <!-- ../local/html/css/template-2.sass -->
    <link rel="stylesheet" type="text/css" href="/workspace-2/css/template-2.sass?format=demo%2Bdemo-2&type=css&mime=text/css" /> <!-- "+" chain symbol (demo+demo-2) is URL encoded as "%2B" -->
</head>
<body>
</body>
</html>
```

### API Routes

Version 1.0.0

```javascript
// NOTE: {required} [optional]

POST: "/api/v1/assets/archive?format={zip|7z|gz|tar}&filename=[no_ext]&to=[disk_uri]&append_to=[archive_uri]"

POST: "/api/v1/assets/copy?to={disk_uri}&empty=[0|1]" // target directory

GET: "/api/v1/loader/data/json?key={id}&cache=[0|1]" // squared 2.3.0 <ResponseData>
GET: "/api/v1/loader/data/blob?key={id}&cache=[0|1]" // squared 2.3.0 <Blob>
GET: "/api/v1/loader/data/text?key={id}&cache=[0|1]"
GET: "/api/v1/loader/data/document?key={id}&cache=[0|1]"
GET: "/api/v1/loader/data/arraybuffer?key={id}&cache=[0|1]"
```

### LICENSE

MIT