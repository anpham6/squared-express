## squared-express 0.2

```xml
<!-- NOTE: cd ./dist -->

1. squared.settings.[json|yml] (configure)

2. node serve.js [--help]
```

### squared 2.0

Typically you will be using squared with squared-express although it can also be used to copy or archive files using JSON and the API routes.

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
squared.saveFiles('7z', data); // required: "data"
squared.appendFiles('http://hostname/project.zip', data);
squared.copyFiles('/path/www', data);
```

The same "data" object can be sent as JSON in a POST body request.

```javascript
// NOTE: {required} [optional]

/api/v1/assets/archive?format={zip|7z|gz|tar}&to=[disk_uri]&append_to=[archive_uri]&filename=[no_ext]

/api/v1/assets/copy?to={disk_uri}&empty=[0|1] // target directory
```

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
// squared.settings.json

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

### API Routes

Version 1.0.0
```xml
/api/v1/assets/copy
/api/v1/assets/archive
/api/v1/browser/download
/api/v1/loader/json
```

### LICENSE

MIT