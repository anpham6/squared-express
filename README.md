# squared-express 0.1

```xml
<!-- NOTE: cd ./dist -->

1. squared.settings.[json|yml] (configure)

2. node serve.js [--help]
```

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

### LICENSE

MIT