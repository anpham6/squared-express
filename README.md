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

// Project based (android)
squared.save(); // Uses defaults from settings

squared.saveAs('archive1.zip', data); // optional: "data"
squared.appendTo('/path/project.zip');
squared.copyTo('/path/project');

// File based (chrome)
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
    "common": [
      { "mount": "html", "path": "/" },
      { "mount": "dist", "path": "/dist" },
      { "get": "/index.html", "handler": "./index-html.js" }, // handler file paths are relative and start with either './' OR '../'
      { "all": "/route/pathname", "handler": ["./handler-1.js", "./handler-2.js", "npm-package-name"] },
      { "handler": "./middleware.js" }
    ],
    "production": [
      { "post": "/data/:userId", "handler": "function (req, res) { res.send(req.params); }" } // handler contents always start with "function"
    ]
  }
}

// index-html.js
function (req, res) { // synchronous
    res.send('<html><body><!-- content --></body></html>');
}

// handler-1.js
function (req, res, next) {
    /* handler-1: code */
    next();
}

// handler-2.js
function (req, res, next) { /* handler-2: code */ }

// NPM package
module.exports = function express(req, res) { // function name has to be "express"
    /* npm-package-name: code */
}

// middleware.js
function () {
    const cookieParser = require('cookie-parser'); // npm i cookie-parser
    return cookieParser();
}
```

### Workspaces

Text based documents which require a preprocessor before being rendered can have the working live document precompiled before it is parsed by squared. Images with transformations can similarly be served into the browser for immediate viewing during the drafting phase. It is not recommended for use in production deployments.

```javascript
// squared.settings.[json|yml]

{
  "routing": {
    "development": [
      { "mount": "../local/src", "path": "/workspace-1", "document": "chrome" }, // Without "document" it is treated as an ordinary static mount
      { "mount": "../local/html", "path": "/workspace-2", "document": "chrome" },
      { "mount": "../local/html/common/images", "path": "/common/images", "image": "@squared-functions/image/jimp" } // NPM hosted packages only with ImageConstructor interface
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
              "format": "iife"
            },
            "plugins": [["@rollup/plugin-typescript", { lib: ["es5", "es6", "dom"], target: "es5" }], "rollup-plugin-terser"] // npm i @rollup/plugin-typescript && npm i rollup-plugin-terser
          },
          "bundle": {
            "plugins": ["rollup-plugin-sourcemaps"], // npm i rollup-plugin-sourcemaps
            "output": {
              "format": "iife",
              "sourcemap": true
            }
          },
          "bundle-es6": {
            "plugins": ["rollup-plugin-sourcemaps"],
            "output": {
              "format": "es",
              "sourcemap": "inline" // Inline source maps are more reliable
            }
          }
        }
      },
      "css": {
        "sass": { // NPM package name
          "demo": "function (context, value, options, resolve) { resolve(context.renderSync({ ...options.outputConfig, data: value }, functions: {}).css); }" // Uses Promise callback "resolve"
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
}
```

* Source map support (js/css): npm i source-map-resolve

NPM plugins have to be installed manually and the transfomer routine is usually custom written. There are a few built-in example transformers as part of [squared-functions](https://github.com/anpham6/squared-functions#readme).

Evaluated functions in configuration files or HTML templates use Promise resolve callbacks. Asynchronous functions require NPM hosted packages and are treated similarly to a built-in transformer.

```html
<html>
<head>
    <script>var android = null;</script> <!-- predeclare ESM globals -->
    <!-- ../local/src/util.ts -->
    <script type="text/javascript" src="/workspace-1/src/util.ts?format=typescript&type=js&compilerOptions.target=es2017"></script> <!-- nested external properties use object dot syntax -->

    <!-- ../local/build/main.js -->
    <script type="text/javascript" src="/workspace-1/build/main.js?format=bundle&type=js&name=app"></script> <!-- query params (&name=app) are sent to plugin as external properties -->

    <!-- ../local/html/template-1.sass -->
    <link rel="stylesheet" type="text/css" href="/workspace-2/template-1.sass?format=demo&type=css&mime=text/css" /> <!-- "mime" is usually optional except certain file types -->

    <!-- ../local/html/css/template-2.sass -->
    <link rel="stylesheet" type="text/css" href="/workspace-2/css/template-2.sass?format=demo%2Bdemo-2&type=css&mime=text/css" /> <!-- "+" chain symbol (demo+demo-2) is URL encoded as "%2B" -->

    <!-- ../local/build/framework/android/src/main.js -->
    <script type="module">
        import appBase from '/build/framework/android/src/main.js?format=bundle-es6&type=js&mime=text/javascript'; // "mime" is required for type="module"
        android = appBase;
    </script>
</head>
<body>
    <img src="/common/images/android.png?command=webp(480x800)%7B90%7D" /> <!-- URL encoded: webp(480x800){90} -->
</body>
</html>
```

You can debug TypeScript files directly in Visual Code with the Chrome extension using the "tsc" --outDir &lt;workspace&gt;. It is more efficient to debug the "js" output files and to also use the --watch flag for recompilation.

Workspace images only support one rotation. The "mime" parameter can also be used in case the server is incorrectly detecting the image content type.

NOTE: To use "format" as an external property then it has to be prefixed as "~format".

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