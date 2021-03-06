/* squared-express 0.6.1
   https://github.com/anpham6/squared-express */
!function(){"use strict";var e;Object.defineProperty(exports,"__esModule",{value:!0});const t=require("path"),s=require("fs-extra"),r=require("yargs"),o=require("express"),i=require("cors"),n=require("body-parser"),a=require("request"),l=require("mime-types"),c=require("uuid"),d=require("archiver"),u=require("decompress"),p=require("js-yaml"),g=require("toml"),m=require("chalk"),f=require("@squared-functions/file-manager"),y=require("@squared-functions/file-manager/permission"),h=require("@squared-functions/document"),w=require("@squared-functions/image"),b={},k={},S=o();S.use(n.urlencoded({extended:!0}));const v=f.moduleCompress(),q=new Map;let U,C,T,F,E,j,_,N,z,R={};function M(e,t){const{document:s,task:r}=t;if(C&&s)for(const e of s){const t=C[e];if(null==t?void 0:t.handler)try{const e=require(t.handler);this.install("document",e,t)}catch(t){v.writeFail(["Unable to load Document handler",e],t)}}if(T&&r)for(const e of r){const t=T[e];if((null==t?void 0:t.handler)&&t.settings)try{const e=require(t.handler);this.install("task",e,t)}catch(t){v.writeFail(["Unable to load Task handler",e],t)}}if(q.size&&this.install("image",q),F&&this.install("compress"),E&&this.install("cloud",E),"1"===e.watch)if(j){const e=this.install("watch",j.interval,j.port);if(e&&j.secure){const{port:t,ssl_key:s,ssl_cert:r}=j.secure;t&&(e.securePort=t),s&&r&&(e.setSSLKey(s),e.setSSLCert(r))}}else this.install("watch")}function D(){L(R.disk_read)&&this.setDiskRead(),L(R.disk_write)&&this.setDiskWrite(),L(R.unc_read)&&this.setUNCRead(),L(R.unc_write)&&this.setUNCWrite()}function x(){const e=null==F?void 0:F.tinify_api_key;if(e)for(const t of this.assets)if(t.compress)for(const s of t.compress)switch(s.format){case"png":case"jpeg":"tinify"!==(s.plugin||(s.plugin="tinify"))||(s.options||(s.options={})).apiKey||(s.options.apiKey=e)}(null==U?void 0:U.cache)&&(this.cacheHttpRequest=!0),D.call(this.permission)}function I(e,t){return{success:!1,error:{hint:t,message:e instanceof Error?e.message:e?e.toString():""}}}function A(e,t){if(f.isDirectoryUNC(e)){if(!t.hasUNCWrite())return I("Writing to UNC shares is not enabled.","NODE: --unc-write")}else if(!t.hasDiskWrite())return I("Writing to disk is not enabled.","NODE: --disk-write");try{if(s.existsSync(e)){if(!s.lstatSync(e).isDirectory())throw new Error("Target is not a directory.")}else s.mkdirpSync(e)}catch(t){return I(t,"DIRECTORY: "+e)}return!0}function O(e,t="",s){switch(e){case"archive":v.writeFail(["Unable to create archive",t],s);break;case"download":v.writeFail(["Unable to download file",t],s);break;case"decompress":v.writeFail(["Unable to decompress file",t],s);break;case"7z":v.formatMessage(v.logType.SYSTEM,"ARCHIVE",["Install required? <npm i 7zip-bin>","7z"],"Binary not found",{titleColor:"yellow"})}}function W(e){const t=e.length;if(t)return t>1?{hint:`FAIL: ${t} errors`,message:e.map((e=>"- "+e)).join("\n")}:{message:"FAIL: "+e[0]}}const L=e=>!0===e||"true"===e||1==+e;{const a=r.usage("$0 [args]").option("access-all",{type:"boolean",description:"Grant full disk and UNC privileges"}).option("access-disk",{alias:"d",type:"boolean",description:"Grant full disk privileges"}).option("access-unc",{alias:"u",type:"boolean",description:"Grant full UNC privileges"}).option("disk-read",{alias:"r",type:"boolean",description:"Grant disk +r (read only)"}).option("disk-write",{alias:"w",type:"boolean",description:"Grant disk +w (write only)"}).option("unc-read",{alias:"y",type:"boolean",description:"Grant UNC +r (read only)"}).option("unc-write",{alias:"z",type:"boolean",description:"Grant UNC +w (write only)"}).option("env",{alias:"e",type:"string",description:"Set environment <prod|dev>",nargs:1}).option("port",{alias:"p",type:"number",description:"Set HTTP port number",nargs:1}).option("cors",{alias:"c",type:"string",description:'Enable CORS access to <origin|"*">',nargs:1}).option("routing",{alias:"a",type:"string",description:"Additional routing namespaces",nargs:1}).option("silent",{alias:"s",type:"boolean",description:"Suppress all console messages"}).epilogue("For more information and source: https://github.com/anpham6/squared-express").argv;let{NODE_ENV:c,PORT:d}=process.env;try{R=s.existsSync("./squared.settings.yml")?p.load(s.readFileSync(t.resolve("./squared.settings.yml"),"utf8")):s.existsSync("./squared.settings.toml")?g.parse(s.readFileSync(t.resolve("./squared.settings.toml"),"utf8")):require("./squared.settings.json"),({request:U,document:C,task:T,compress:F,cloud:E,watch:j}=R),f.loadSettings(R)}catch(e){v.writeFail(["Unable to load Settings file","squared"],e)}if(a.accessAll?(R.disk_read=!0,R.disk_write=!0,R.unc_read=!0,R.unc_write=!0):(a.accessDisk?(R.disk_read=!0,R.disk_write=!0):(a.diskRead&&(R.disk_read=!0),a.diskWrite&&(R.disk_write=!0)),a.accessUnc?(R.unc_read=!0,R.unc_write=!0):(a.uncRead&&(R.unc_read=!0),a.uncWrite&&(R.unc_write=!0))),F){const{gzip_level:e,brotli_quality:t,chunk_size:r}=F,o=+e,i=+t,n=+r;isNaN(o)||(v.level.gz=o),isNaN(i)||(v.level.br=i),!isNaN(n)&&n>0&&n%1024==0&&(v.chunkSize=n);try{N=require("node-7z");const e=F["7za_bin"];e&&s.existsSync(e)?z=e:({path7za:z}=require("7zip-bin"))}catch(e){}}if(R.image){let e="";try{for(e in R.image){const t=R.image[e];t&&q.set(("handler"!==e?"image/":"")+e,require(t))}}catch(t){v.writeFail(["Unable to load Image handler",e],t)}}if(q.has("handler")||q.set("handler",require("@squared-functions/image/jimp")),R.routing){a.env&&R.routing[a.env.trim()]?c=a.env.trim():c&&!R.routing[c]&&(c=R.env),c&&R.routing[c]||(c="development");const r=["all","get","post","put","delete","patch","options","head","checkout","connect","copy","lock","merge","mkactivity","mkcol","move","m-search","notify","propfind","proppatch","purge","report","search","subscribe","trace","unlock","unsubscribe"],i={},n=[],d=(e,t)=>(i[e]||(i[e]=new Set)).add(t),u=(e,t)=>i[e]&&i[e].has(t);if(a.routing)for(let e of a.routing.split(",")){const t=R.routing[e=e.trim()];Array.isArray(t)&&!n.find((t=>t[0]===e))&&n.push([e,t])}if(n.push(...[[c,R.routing[c]],["common",R.routing.common]].filter((e=>Array.isArray(e[1])))),n.length){console.log();for(const[i,a]of n){let n=0,c=0,p=0;for(const i of a){const{mount:a,path:g,document:y,image:b}=i;if(a&&g){let r,i;if(y&&(r=null===(e=R.document)||void 0===e?void 0:e[y])&&(i=r.handler)||(i=b))if(i){const e=f.toPosix(("/"!==g[0]?"/":"")+g),o=e+"/*";if(!u("get",o))try{const n=t.resolve(a);if(s.lstatSync(n).isDirectory()){const a=s=>t.join(n,s.substring(e.length)),c=()=>{v.formatMessage(v.logType.SYSTEM,"BUILD",`${m.bgGrey(n)} ${m.yellow("->")} ${m.bold(e)}`,"",{titleColor:"yellow"}),d("get",o),++p};if(r)if(r.settings)try{const e=new(require(i))(r);S.get(o,(async(o,i,n)=>{const c=new URL(o.protocol+"://"+o.hostname+o.originalUrl),d=new URLSearchParams(c.search),u=d.get("type"),p=d.get("format"),g=a(c.pathname);if(u&&p&&r.settings[u]&&s.existsSync(g)){const r={};d.forEach(((e,t)=>{switch(t){case"type":case"format":case"mime":return;case"~type":case"~format":case"~mime":t=t.substring(1)}const s=t.split(".");let o=r;for(;;){const t=s.shift();if(0===s.length){switch(e){case"true":o[t]=!0;break;case"false":o[t]=!1;break;case"undefined":o[t]=void 0;break;case"null":o[t]=null;break;case"{}":o[t]={};break;case"[]":o[t]=[];break;default:o[t]=isNaN(+e)?e:+e}break}o[t]&&"object"==typeof o[t]||(o[t]={}),o=o[t]}}));const o={sourceFile:g,external:r},n=s.readFileSync(g,"utf8");try{const e=require("source-map-resolve");try{const r=e.resolveSourceMapSync(n,c.pathname,s.readFileSync);// eslint-disable-line @typescript-eslint/no-unsafe-call
if(r){const e=r.map,s=e.sources;o.sourcesRelativeTo=t.dirname(g);for(let e=0;e<s.length;++e)s[e]=t.resolve(o.sourcesRelativeTo,s[e]);const i=h.createSourceMap(n);i.nextMap("unknown",n,e),o.sourceMap=i}}catch(e){v.writeFail(["Unable to parse source map",y],e)}}catch(e){}const a=await e.transform(u,n,p,o);if(a){if(a.map){let e=t.basename(g);e.endsWith(u)||(e+="."+u),e+="."+p+".map",h.writeSourceMap(g,a,{sourceMappingURL:e})}const e=d.get("mime")||l.lookup(c.pathname);e&&i.setHeader("Content-Type",e),i.send(a.code)}else i.send(null)}else n()})),c()}catch(e){v.writeFail(["Unable to load Document handler",y],e)}else v.writeFail(["Document settings not found",y]);else try{const e=require(i);e.prototype instanceof w?(S.get(o,(async(t,r,o)=>{const i=new URL(t.protocol+"://"+t.hostname+t.originalUrl),n=new URLSearchParams(i.search),c=n.get("command"),d=a(i.pathname);if(c&&s.existsSync(d)){let t=l.lookup(i.pathname)||await f.resolveMime(d);t&&"string"!=typeof t&&(t=t.mime);const s=Date.now(),o=await e.transform(d,c,t);o?(v.writeTimeElapsed("IMAGE",c,s),r.setHeader("Content-Type",n.get("mime")||t||"image/jpeg"),o instanceof Buffer?r.send(o):r.sendFile(o)):r.send(null)}else o()})),c()):v.writeFail("Object does not extend ImageConstructor",new Error(i))}catch(e){v.writeFail(["Unable to load Image handler",b],e)}}}catch(e){v.writeFail(["Unable to mount directory",y||b],e)}}else r&&v.writeFail(["Document handler not found",y]);else if(!u("static",g))try{const e=t.join(__dirname,a);S.use(g,o.static(e)),v.formatMessage(v.logType.SYSTEM,"STATIC",`${m.bgGrey(e)} ${m.yellow("->")} ${m.bold(g)}`,"",{titleColor:"yellow"}),d("static",g),++n}catch(e){v.writeFail(["Unable to mount static directory",g],e)}}else{let e=i.handler;if(e){"string"==typeof e&&(e=[e]);let t=[];for(const s of e){const e=f.parseFunction(s,"express");e&&t.push(e)}switch(t.length){case 0:continue;case 1:t=t[0]}let s=!1;for(const e of r){const r=i[e];if(r&&"string"==typeof r&&!u(e,r)){try{S[e](r,t),v.formatMessage(v.logType.SYSTEM,"ROUTE",m.bgGrey(r),"",{titleColor:"yellow"}),d(e,r),++c}catch(e){v.writeFail(["Unable to create route",r],e)}s=!0;break}}s||S.use(t)}}}n>0||c>0||p>0?(console.log(),v.formatMessage(v.logType.SYSTEM," READY ",[i,`static: ${n} / route: ${c}`],p?"workspace: "+p:null,{titleColor:"white",titleBgColor:"bgGreen"})):v.formatMessage(v.logType.SYSTEM," CHECK ",[i,"No routes were mounted"],null,{titleColor:"grey",titleBgColor:"bgYellow"}),console.log()}}}else c||(c="development"),S.use("/",o.static(t.join(__dirname,"html"))),S.use("/dist",o.static(t.join(__dirname,"dist"))),v.writeFail("Routing not defined");if(R.logger&&a.silent){const e=R.logger;for(const t in e)e[t]=!1}D.call(_=new y),v.formatMessage(v.logType.SYSTEM,"DISK",(_.hasDiskRead()?m.green("+"):m.red("-"))+"r "+(_.hasDiskWrite()?m.green("+"):m.red("-"))+"w","",{titleColor:"blue"}),v.formatMessage(v.logType.SYSTEM,"UNC",(_.hasUNCRead()?m.green("+"):m.red("-"))+"r "+(_.hasUNCWrite()?m.green("+"):m.red("-"))+"w","",{titleColor:"blue"});let u,b=a.cors;b?u={origin:b}:(u=R.cors)&&(b=u.origin),b&&(S.use(i(u)),S.options("*",i()),"string"!=typeof b&&(b="true")),v.formatMessage(v.logType.SYSTEM,"CORS",b?m.green(b):m.grey("disabled"),"",{titleColor:"blue"}),a.port?d=a.port.toString():!d&&R.port&&(d=R.port[c]),d=+d>=0&&d||"3000",S.use(n.json({limit:(null==U?void 0:U.post_limit)||"250mb"})),S.listen(d,(()=>{console.log(""),v.formatMessage(v.logType.SYSTEM,c.toUpperCase(),"Express server listening on port "+m.bold(d),"",{titleColor:c.startsWith("prod")?"green":"yellow"}),console.log(""),f.loadSettings(R)})),process.env.NODE_ENV=c,process.env.PORT=d}S.post("/api/v1/assets/copy",((e,r)=>{const o=e.query,i=t.normalize(o.to);let n;if(i&&_&&!0===(n=A(i,_)))try{if("2"===o.empty)try{s.emptyDirSync(i)}catch(e){v.writeFail(["Unable to empty base directory",i],e)}const t=e.body,n=new f(i,t,(e=>{const t=Array.from(n.files);r.json({success:t.length>0,files:t,error:W(e)}),n.formatMessage(v.logType.NODE," WRITE ",[i,t.length+" files"])}));M.call(n,o,t),x.call(n),n.processAssets("1"===o.empty)}catch(e){r.json(I("FILE: Unknown",e.toString()))}else n&&r.json(n)})),S.post("/api/v1/assets/archive",((e,r)=>{const o=e.query,i=o.to&&t.normalize(o.to);let n,l=t.join(__dirname,"tmp",c.v4());try{i&&_&&!0===A(l,_)?l=i:s.mkdirpSync(l),n=l+"-zip",s.mkdirpSync(n)}catch(e){return void r.json(I(`DIRECTORY: ${l}`,e.toString()))}let p=o.append_to,g=!1,m=!1,y=(o.format||"zip").toLowerCase();switch(t.isAbsolute(p)&&(p=t.normalize(p)),y){case"7z":N&&z?g=!0:(O("7z"),y="zip");break;case"gz":case"tgz":m=!0;case"tar":break;default:y="zip"}const h=(i="")=>{try{i=(o.filename||i||c.v4())+"."+y;let a=t.join(n,i);const u=e.body,p=new f(l,u,(e=>{const o={success:p.files.size>0,filename:i,files:Array.from(p.files),error:W(e)},n=e=>{if(e){const t=c.v4();o.bytes=e,o.downloadKey=t,k[t]={filename:i,uri:a}}else o.success=!1;r.json(o),p.formatMessage(v.logType.NODE," WRITE ",[o.filename,e+" bytes"])};if(g)N.add(a,l+t.sep+"*",{$bin:z,recursive:!0}).on("end",(()=>n(f.getFileSize(a)))).on("error",(e=>O("archive",y,e)));else{const e=d(y,{zlib:{level:v.level.gz}});e.pipe(s.createWriteStream(a).on("close",(()=>{if(m){const e="tgz"===y?a.replace(/tar$/,"tgz"):a+".gz";v.createWriteStreamAsGzip(a,e).on("finish",(()=>{a=e,o.filename=t.basename(e),n(f.getFileSize(e))})).on("error",(e=>{o.success=!1,O("archive",y,e),r.json(o)}))}else n(e.pointer())})).on("error",(e=>O("archive",y,e)))),e.directory(l,!1),e.finalize()}}));M.call(p,o,u),x.call(p),p.processAssets()}catch(e){r.json(I("FILE: Unknown",e.toString()))}};if(p){const e=t.basename(p),o=t.extname(e).substring(1),i=e.substring(0,e.length-(o.length+1)),c=t.join(n,e);async function w(){let t=[];if("7z"!==o)try{t=await u(c,l)}catch(t){z||O("decompress",e,t)}t.length?h(i):N&&z?N.extractFull(c,l,{$bin:z,recursive:!0}).on("end",(()=>h(i))).on("error",(t=>{O("decompress",e,t),h()})):(O("decompress",e,new Error("Unsupported format: "+o)),h())}try{if(f.isFileHTTP(p)){const e=s.createWriteStream(c);return e.on("finish",(()=>{w()})),void a(p).on("response",(e=>{e.statusCode>=300&&O("download",p,new Error(e.statusCode+": "+e.statusMessage))})).on("error",(e=>{O("download",p,e),h()})).pipe(e)}if(s.existsSync(p=f.resolveUri(p))){if(f.isFileUNC(p))return void(_&&_.hasUNCRead()?s.copyFile(p,c,(()=>{w()})):r.json(I("OPTION: --unc-read","Reading from UNC shares is not enabled.")));if(t.isAbsolute(p))return void(_&&_.hasDiskRead()?s.copyFile(p,c,(()=>{w()})):r.json(I("OPTION: --disk-read","Reading from disk is not enabled.")))}v.writeFail("Archive not found",new Error(p))}catch(e){v.writeFail(c,e)}}h()})),S.get("/api/v1/loader/data/json",((e,r)=>{let o=e.query.key;const i="1"===e.query.cache;if(o){const n=(s,n)=>{let a;if(!s)try{const s=e.query.mime;switch((s&&s.split("/").pop()||t.extname(o).substring(1)).toLowerCase()){case"json":case"jsonp":case"jsonld":case"javascript":case"js":case"mjs":case"map":a=JSON.parse(n);break;case"yml":case"yaml":a=p.load(n);break;case"toml":a=g.parse(n)}}catch(e){s=e}"object"==typeof a?(i&&(b[o]=a),r.json({success:!0,data:a})):r.json(I(s,`FILE: Unable to download (${o})`))};if(i&&b[o]||f.isUUID(o)){const e=b[o];e?r.json({success:!0,data:e}):r.json(I(o,"CACHE: Could not locate key"))}else f.isFileHTTP(o)?a(o,((e,t)=>n(e,t.body))):_&&s.existsSync(o=f.resolveUri(o))&&(f.isFileUNC(o)?_.hasUNCRead():_.hasDiskRead())?s.readFile(o,"utf8",((e,t)=>n(e,t))):r.json(I("FILE: Unknown",o))}})),S.get("/api/v1/loader/data/blob",((e,t)=>{const s=e.query.key,r=k[s];if(r){const o=e.query.cache,i=r.uri;"0"===o&&delete k[s],t.download(i,r.filename,(e=>{e&&v.writeFail(["Unable to send file",i],e)}))}else t.send(null)}))}();
