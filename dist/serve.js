/* squared-express 0.5.0
   https://github.com/anpham6/squared-express */
!function(){"use strict";var e;Object.defineProperty(exports,"__esModule",{value:!0});const t=require("path"),o=require("fs-extra"),r=require("yargs"),s=require("express"),i=require("cors"),n=require("body-parser"),a=require("request"),l=require("mime-types"),c=require("uuid"),d=require("archiver"),p=require("node-7z"),u=require("js-yaml"),f=require("chalk"),m=require("@squared-functions/file-manager"),g=require("@squared-functions/document"),y=require("@squared-functions/image"),h={},w={},b=s();b.use(n.urlencoded({extended:!0}));const v=m.moduleCompress(),k=new Map;let S,U,E,F,T,q,C={};function j(e,t){const{document:o,task:r}=t;if(S&&o)for(const t of o){const o=S[t];if(o&&o.handler)try{const r=require(o.handler);switch(t){case"chrome":this.install("document",r,o,"1"===e.release);break;default:this.install("document",r,o)}}catch(e){v.writeFail(["Unable to load Document handler",t],e)}}if(U&&r)for(const e of r){const t=U[e];if(t&&t.handler&&t.settings)try{const e=require(t.handler);this.install("task",e,t)}catch(t){v.writeFail(["Unable to load Task handler",e],t)}}k.size&&this.install("image",k),F&&this.install("compress"),E&&this.install("cloud",E),"1"===e.watch&&this.install("watch",undefined)}function M(){var e;const t=null===(e=C.compress)||void 0===e?void 0:e.tinify_api_key;if(t)for(const e of this.assets)if(e.compress)for(const o of e.compress)switch(o.format){case"png":case"jpeg":"tinify"!==(o.plugin||(o.plugin="tinify"))||(o.options||(o.options={})).apiKey||(o.options.apiKey=t)}}function z(e,t="",o){switch(e){case"7z":v.formatMessage(v.logType.SYSTEM,"ARCHIVE",["Install required? <npm i 7zip-bin>","7z"],"Binary not found",{titleColor:"yellow"});break;case"archive":v.writeFail(["Unable to create archive",t],o);break;case"download":v.writeFail(["Unable to download file",t],o)}}function _(e){const t=e.length;if(t)return t>1?{hint:`FAIL: ${t} errors`,message:e.map((e=>"- "+e)).join("\n")}:{message:"FAIL: "+e[0]}}{const a=r.usage("$0 [args]").option("access-all",{type:"boolean",description:"Grant full disk and UNC privileges"}).option("access-disk",{alias:"d",type:"boolean",description:"Grant full disk privileges"}).option("access-unc",{alias:"u",type:"boolean",description:"Grant full UNC privileges"}).option("disk-read",{alias:"r",type:"boolean",description:"Grant disk +r (read only)"}).option("disk-write",{alias:"w",type:"boolean",description:"Grant disk +w (write only)"}).option("unc-read",{alias:"y",type:"boolean",description:"Grant UNC +r (read only)"}).option("unc-write",{alias:"z",type:"boolean",description:"Grant UNC +w (write only)"}).option("env",{alias:"e",type:"string",description:"Set environment <prod|dev>",nargs:1}).option("port",{alias:"p",type:"number",description:"Set HTTP port number",nargs:1}).option("cors",{alias:"c",type:"string",description:'Enable CORS access to <origin|"*">',nargs:1}).option("routing",{alias:"a",type:"string",description:"Additional routing namespaces",nargs:1}).epilogue("For more information and source: https://github.com/anpham6/squared-express").argv;let{NODE_ENV:c,PORT:d}=process.env;try{C=o.existsSync("./squared.settings.yml")&&u.load(o.readFileSync(t.resolve("./squared.settings.yml"),"utf8"))||require("./squared.settings.json"),({document:S,task:U,compress:F,cloud:E}=C)}catch(e){v.writeFail(["Unable to load Settings file","squared"],e)}if(a.accessAll?(C.disk_read=!0,C.disk_write=!0,C.unc_read=!0,C.unc_write=!0):(a.accessDisk?(C.disk_read=!0,C.disk_write=!0):(a.diskRead&&(C.disk_read=!0),a.diskWrite&&(C.disk_write=!0)),a.accessUnc?(C.unc_read=!0,C.unc_write=!0):(a.uncRead&&(C.unc_read=!0),a.uncWrite&&(C.unc_write=!0))),F)try{const e=F["7za_bin"];e&&o.existsSync(e)?q=e:({path7za:q}=require("7zip-bin"))}catch(e){}if(C.image){let e="";try{for(e in C.image){const t=C.image[e];t&&k.set(("handler"!==e?"image/":"")+e,require(t))}}catch(t){v.writeFail(["Unable to load Image handler",e],t)}}if(k.has("handler")||k.set("handler",require("@squared-functions/image/jimp")),C.routing){a.env&&C.routing[a.env.trim()]?c=a.env.trim():c&&!C.routing[c]&&(c=C.env),c&&C.routing[c]||(c="development");const r=["all","get","post","put","delete","patch","options","head","checkout","connect","copy","lock","merge","mkactivity","mkcol","move","m-search","notify","propfind","proppatch","purge","report","search","subscribe","trace","unlock","unsubscribe"],i={},n=[],d=(e,t)=>(i[e]||(i[e]=new Set)).add(t),p=(e,t)=>i[e]&&i[e].has(t);if(a.routing)for(let e of a.routing.split(",")){const t=C.routing[e=e.trim()];Array.isArray(t)&&!n.find((t=>t[0]===e))&&n.push([e,t])}if(n.push(...[[c,C.routing[c]],["common",C.routing.common]].filter((e=>Array.isArray(e[1])))),n.length){console.log();for(const[i,a]of n){let n=0,c=0,u=0;for(const i of a){const{mount:a,path:h,document:w,image:k}=i;if(a&&h){let r,i;if(w&&(r=null===(e=C.document)||void 0===e?void 0:e[w])&&(i=r.handler)||(i=k))if(i){const e=m.toPosix(("/"!==h[0]?"/":"")+h),s=e+"/*";if(!p("get",s))try{const n=t.resolve(a);if(o.lstatSync(n).isDirectory()){const a=o=>t.join(n,o.substring(e.length)),c=()=>{v.formatMessage(v.logType.SYSTEM,"BUILD",`${f.bgGrey(n)} ${f.yellow("->")} ${f.bold(e)}`,"",{titleColor:"yellow"}),d("get",s),++u};if(r)if(r.settings)try{const e=new(require(i))(r);b.get(s,(async(s,i,n)=>{const c=new URL(s.protocol+"://"+s.hostname+s.originalUrl),d=new URLSearchParams(c.search),p=d.get("type"),u=d.get("format"),f=a(c.pathname);if(p&&u&&r.settings[p]&&o.existsSync(f)){const r={};d.forEach(((e,t)=>{switch(t){case"type":case"format":case"mime":return;case"~type":case"~format":case"~mime":t=t.substring(1)}const o=t.split(".");let s=r;for(;;){const t=o.shift();if(0===o.length){switch(e){case"true":s[t]=!0;break;case"false":s[t]=!1;break;case"undefined":s[t]=void 0;break;case"null":s[t]=null;break;case"{}":s[t]={};break;case"[]":s[t]=[];break;default:s[t]=isNaN(+e)?e:+e}break}s[t]&&"object"==typeof s[t]||(s[t]={}),s=s[t]}}));const s={sourceFile:f,external:r},n=o.readFileSync(f,"utf8");try{const e=require("source-map-resolve");try{const r=e.resolveSourceMapSync(n,c.pathname,o.readFileSync);// eslint-disable-line @typescript-eslint/no-unsafe-call
if(r){const e=r.map,o=e.sources;s.sourcesRelativeTo=t.dirname(f);for(let e=0;e<o.length;++e)o[e]=t.resolve(s.sourcesRelativeTo,o[e]);const i=g.createSourceMap(n);i.nextMap("unknown",n,e),s.sourceMap=i}}catch(e){v.writeFail(["Unable to parse source map",w],e)}}catch(e){}const a=await e.transform(p,n,u,s);if(a){if(a.map){let e=t.basename(f);e.endsWith(p)||(e+="."+p),e+="."+u+".map",g.writeSourceMap(f,a,{sourceMappingURL:e})}const e=d.get("mime")||l.lookup(c.pathname);e&&i.setHeader("Content-Type",e),i.send(a.code)}else i.send(null)}else n()})),c()}catch(e){v.writeFail(["Unable to load Document handler",w],e)}else v.writeFail(["Document settings not found",w]);else try{const e=require(i);e.prototype instanceof y?(b.get(s,(async(t,r,s)=>{const i=new URL(t.protocol+"://"+t.hostname+t.originalUrl),n=new URLSearchParams(i.search),c=n.get("command"),d=a(i.pathname);if(c&&o.existsSync(d)){let t=l.lookup(i.pathname)||await m.resolveMime(d);t&&"string"!=typeof t&&(t=t.mime);const o=Date.now(),s=await e.transform(d,c,t);s?(v.writeTimeElapsed("IMAGE",c,o),r.setHeader("Content-Type",n.get("mime")||t||"image/jpeg"),s instanceof Buffer?r.send(s):r.sendFile(s)):r.send(null)}else s()})),c()):v.writeFail("Object does not extend ImageConstructor",new Error(i))}catch(e){v.writeFail(["Unable to load Image handler",k],e)}}}catch(e){v.writeFail(["Unable to mount directory",w||k],e)}}else r&&v.writeFail(["Document handler not found",w]);else if(!p("static",h))try{const e=t.join(__dirname,a);b.use(h,s.static(e)),v.formatMessage(v.logType.SYSTEM,"STATIC",`${f.bgGrey(e)} ${f.yellow("->")} ${f.bold(h)}`,"",{titleColor:"yellow"}),d("static",h),++n}catch(e){v.writeFail(["Unable to mount static directory",h],e)}}else{let e=i.handler;if(e){"string"==typeof e&&(e=[e]);let t=[];for(const o of e){const e=m.parseFunction(o,"express");e&&t.push(e)}switch(t.length){case 0:continue;case 1:t=t[0]}let o=!1;for(const e of r){const r=i[e];if(r&&"string"==typeof r&&!p(e,r)){try{b[e](r,t),v.formatMessage(v.logType.SYSTEM,"ROUTE",f.bgGrey(r),"",{titleColor:"yellow"}),d(e,r),++c}catch(e){v.writeFail(["Unable to create route",r],e)}o=!0;break}}o||b.use(t)}}}n>0||c>0||u>0?(console.log(),v.formatMessage(v.logType.SYSTEM," READY ",[i,`static: ${n} / route: ${c}`],u?"workspace: "+u:null,{titleColor:"white",titleBgColor:"bgGreen"})):v.formatMessage(v.logType.SYSTEM," CHECK ",[i,"No routes were mounted"],null,{titleColor:"grey",titleBgColor:"bgYellow"}),console.log()}}}else c||(c="development"),b.use("/",s.static(t.join(__dirname,"html"))),b.use("/dist",s.static(t.join(__dirname,"dist"))),v.writeFail("Routing not defined");m.loadSettings(C),T=m.getPermission(C),v.formatMessage(v.logType.SYSTEM,"DISK",(T.hasDiskRead()?f.green("+"):f.red("-"))+"r "+(T.hasDiskWrite()?f.green("+"):f.red("-"))+"w","",{titleColor:"blue"}),v.formatMessage(v.logType.SYSTEM,"UNC",(T.hasUNCRead()?f.green("+"):f.red("-"))+"r "+(T.hasUNCWrite()?f.green("+"):f.red("-"))+"w","",{titleColor:"blue"});let p,h=a.cors;h?p={origin:h}:(p=C.cors)&&(h=p.origin),h&&(b.use(i(p)),b.options("*",i()),"string"!=typeof h&&(h="true")),v.formatMessage(v.logType.SYSTEM,"CORS",h?f.green(h):f.grey("disabled"),"",{titleColor:"blue"}),a.port?d=a.port.toString():!d&&C.port&&(d=C.port[c]),d=+d>=0&&d||"3000",b.use(n.json({limit:C.request_post_limit||"250mb"})),b.listen(d,(()=>{console.log(""),v.formatMessage(v.logType.SYSTEM,c.toUpperCase(),"Express server listening on port "+f.bold(d),"",{titleColor:c.startsWith("prod")?"green":"yellow"}),console.log("")})),process.env.NODE_ENV=c,process.env.PORT=d}b.post("/api/v1/assets/copy",((e,r)=>{const s=e.query,i=t.normalize(s.to);let n;if(i&&T&&!0===(n=m.hasPermission(i,T)))try{if("2"===s.empty)try{o.emptyDirSync(i)}catch(e){v.writeFail(["Unable to empty base directory",i],e)}const t=e.body,n=new m(i,t,(e=>{const t=Array.from(n.files);r.json({success:t.length>0,files:t,error:_(e)}),n.formatMessage(v.logType.NODE," WRITE ",[i,t.length+" files"])}),C);j.call(n,s,t),M.call(n),n.processAssets("1"===s.empty)}catch(e){r.json(m.responseError("FILE: Unknown",e.toString()))}else n&&r.json(n)})),b.post("/api/v1/assets/archive",((e,r)=>{const s=e.query,i=s.to&&t.normalize(s.to);let n,l=t.join(__dirname,"tmp",c.v4());try{i&&T&&!0===m.hasPermission(l,T)?l=i:o.mkdirpSync(l),n=l+"-zip",o.mkdirpSync(n)}catch(e){return void r.json(m.responseError(`DIRECTORY: ${l}`,e.toString()))}let u=s.append_to,f=!1,g=!1,y=(s.format||"zip").toLowerCase();switch(t.isAbsolute(u)&&(u=t.normalize(u)),y){case"7z":q?f=!0:(z("7z"),y="zip");break;case"gz":case"tgz":g=!0;case"tar":break;default:y="zip"}const h=(i="")=>{try{i=(s.filename||i||c.v4())+"."+y;let a=t.join(n,i);const u=e.body,h=new m(l,u,(e=>{const s={success:h.files.size>0,filename:i,files:Array.from(h.files),error:_(e)},n=e=>{if(e){const t=c.v4();s.bytes=e,s.downloadKey=t,w[t]={filename:i,uri:a}}else s.success=!1;r.json(s),h.formatMessage(v.logType.NODE," WRITE ",[s.filename,e+" bytes"])};if(f)p.add(a,l+t.sep+"*",{$bin:q,recursive:!0}).on("end",(()=>n(m.getFileSize(a)))).on("error",(e=>z("archive",y,e)));else{const e=d(y,{zlib:{level:v.level.gz}});e.pipe(o.createWriteStream(a).on("close",(()=>{if(g){const e="tgz"===y?a.replace(/tar$/,"tgz"):a+".gz";v.createWriteStreamAsGzip(a,e).on("finish",(()=>{a=e,s.filename=t.basename(e),n(m.getFileSize(e))})).on("error",(e=>{s.success=!1,z("archive",y,e),r.json(s)}))}else n(e.pointer())})).on("error",(e=>z("archive",y,e)))),e.directory(l,!1),e.finalize()}}),C);j.call(h,s,u),M.call(h),h.processAssets()}catch(e){r.json(m.responseError("FILE: Unknown",e.toString()))}};if(u)if(q){const e=/([^/\\]+)\.\w+?$/i.exec(u);if(e){const s=t.join(n,e[0]),i=()=>{p.extractFull(s,l,{$bin:q,recursive:!0}).on("end",(()=>{h(e[1])})).on("error",(e=>{v.writeFail(["Unable to decompress file",s],e),h()}))};try{if(m.isFileHTTP(u)){const e=o.createWriteStream(s);let t;return e.on("finish",i),void a(u).on("response",(e=>{const o=e.statusCode;o>=300&&(z("download",u,new Error(o+" "+e.statusMessage)),t=!0)})).on("error",(e=>{t||z("download",u,e),h()})).pipe(e)}if(o.existsSync(u=m.resolveUri(u))){if(m.isFileUNC(u))return void(T&&T.hasUNCRead()?o.copyFile(u,s,i):r.json(m.responseError("OPTION: --unc-read","Reading from UNC shares is not enabled.")));if(t.isAbsolute(u))return void(T&&T.hasDiskRead()?o.copyFile(u,s,i):r.json(m.responseError("OPTION: --disk-read","Reading from disk is not enabled.")))}v.writeFail("Archive not found",new Error(u))}catch(e){v.writeFail(s,e)}}else v.writeFail("Invalid archive format",new Error(u))}else z("7z");h()})),b.get("/api/v1/loader/data/json",((e,r)=>{let s=e.query.key;const i="1"===e.query.cache;if(s){let e=!0;const n=(e,o)=>{let n;if(!e)try{switch(t.extname(s).toLowerCase()){case".json":case".js":n=JSON.parse(o);break;case".yml":case".yaml":n=u.load(o)}}catch(t){e=t}"object"==typeof n?(i&&(h[s]=n),r.json({success:!0,data:n})):r.json(m.responseError(e,`FILE: Unable to download (${s})`))};if(i&&h[s]||m.isUUID(s)){const e=h[s];e?r.json({success:!0,data:e}):r.json(m.responseError(s,"CACHE: Could not locate key"))}else m.isFileHTTP(s)?a(s,((e,t)=>n(e,t.body))):T&&o.existsSync(s=m.resolveUri(s))?(e=m.isFileUNC(s)?T.hasUNCRead():T.hasDiskRead(),e&&o.readFile(s,"utf8",((e,t)=>n(e,t)))):e=!1;e||r.json(m.responseError("FILE: Unknown",s))}})),b.get("/api/v1/loader/data/blob",((e,t)=>{const o=e.query.key,r=w[o];if(r){const s=e.query.cache,i=r.uri;"0"===s&&delete w[o],t.download(i,r.filename,(e=>{e&&v.writeFail(["Unable to send file",i],e)}))}else t.send(null)}))}();
