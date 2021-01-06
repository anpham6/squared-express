!function(){"use strict";var e;Object.defineProperty(exports,"__esModule",{value:!0});const s=require("path"),r=require("fs-extra"),t=require("yargs"),o=require("express"),i=require("cors"),n=require("body-parser"),a=require("request"),l=require("uuid"),c=require("archiver"),d=require("node-7z"),p=require("js-yaml"),u=require("chalk"),g=require("@squared-functions/file-manager"),m=o();m.use(n.urlencoded({extended:!0}));const f=g.moduleNode();let y,h,b,w,v,k;function U(e,s){const{chrome:r,watch:t,release:o}=s;y&&e.install("image",y),b&&e.install("gulp",b),w&&e.install("cloud",w),"1"===r&&(h&&e.install("chrome",h,"1"===o),v&&e.install("compress",v)),"1"===t&&e.install("watch",undefined)}const S=()=>f.formatMessage(f.logType.NODE,"ARCHIVE",["Install required? [npm i 7zip-bin]","7z"],"Binary not found",{titleColor:"yellow"});{const a=t.usage("$0 [args]").option("access-all",{type:"boolean",description:"Grant full disk and UNC privileges"}).option("access-disk",{alias:"d",type:"boolean",description:"Grant full disk privileges"}).option("access-unc",{alias:"u",type:"boolean",description:"Grant full UNC privileges"}).option("disk-read",{alias:"r",type:"boolean",description:"Grant disk +r (read only)"}).option("disk-write",{alias:"w",type:"boolean",description:"Grant disk +w (write only)"}).option("unc-read",{alias:"y",type:"boolean",description:"Grant UNC +r (read only)"}).option("unc-write",{alias:"z",type:"boolean",description:"Grant UNC +w (write only)"}).option("env",{alias:"e",type:"string",description:"Set environment <prod|dev>",nargs:1}).option("port",{alias:"p",type:"number",description:"Set HTTP port number",nargs:1}).option("cors",{alias:"c",type:"string",description:'Enable CORS access to <origin|"*">',nargs:1}).epilogue("For more information and source: https://github.com/anpham6/squared").argv;let{NODE_ENV:l,PORT:c}=process.env,d=!1;a.accessAll?(f.setDiskRead(),f.setDiskWrite(),f.setUNCRead(),f.setUNCWrite(),d=!0):(a.accessDisk?(f.setDiskRead(),f.setDiskWrite(),d=!0):(a.diskRead&&(f.setDiskRead(),d=!0),a.diskWrite&&(f.setDiskWrite(),d=!0)),a.accessUnc?(f.setUNCRead(),f.setUNCWrite(),d=!0):(a.uncRead&&(f.setUNCRead(),d=!0),a.uncWrite&&(f.setUNCWrite(),d=!0)));let U={};try{if(U=r.existsSync("./squared.settings.yml")&&p.load(r.readFileSync(s.resolve("./squared.settings.yml"),"utf8"))||require("./squared.settings.json"),({compress:v,cloud:w,gulp:b,chrome:h}=U),g.loadSettings(U,d),v){const e=v["7za_bin"];if(e&&r.existsSync(e))k=e;else try{const e=require("7zip-bin");k=e.path7za}catch(e){}}y=require((null===(e=U.image)||void 0===e?void 0:e.command)||"@squared-functions/image/jimp")}catch(e){y=require("@squared-functions/image/jimp"),f.writeFail("Unable to load settings",e)}if(U.routing){a.env&&U.routing[a.env.trim()]?l=a.env.trim():l&&!U.routing[l]&&(l=U.env),l&&U.routing[l]||(l="development");const e=["all","get","post","put","delete","patch","options","head","checkout","connect","copy","lock","merge","mkactivity","mkcol","move","m-search","notify","propfind","proppatch","purge","report","search","subscribe","trace","unlock","unsubscribe"];let r=0,t=0;for(const i of[U.routing.__SHARED__,U.routing[l]])if(Array.isArray(i))for(const n of i){const{path:i,mount:a}=n;if(i&&a){const e=s.join(__dirname,a);try{m.use(i,o.static(e)),f.formatMessage(f.logType.SYSTEM,"MOUNT",`${u.bgGrey(e)} ${u.yellow("->")} ${u.bold(i)}`,"",{titleColor:"yellow"}),++r}catch(e){f.writeFail(["Unable to mount directory",i],e)}}else{let s=n.handler;if(s){"string"==typeof s&&(s=[s]);let r=[];for(const e of s){const s=f.parseFunction(e);s&&r.push(s)}switch(r.length){case 0:continue;case 1:r=r[0]}let o=!1;for(const s of e){const e=n[s];if(e&&"string"==typeof e){try{m[s](e,r),f.formatMessage(f.logType.SYSTEM,"ROUTE",u.bgGrey(e),"",{titleColor:"yellow"}),++t}catch(s){f.writeFail(["Unable to create route",e],s)}o=!0;break}}o||m.use(r)}}}r&&console.log(`\n${u.bold(r)} ${1===r?"directory was":"directories were"} mounted.${t?"":"\n"}`),t&&console.log(`\n${u.bold(t)} ${1===t?"route was":"routes were"} created.\n`)}else l||(l="development"),m.use("/",o.static(s.join(__dirname,"html"))),m.use("/dist",o.static(s.join(__dirname,"dist"))),f.writeFail("Routing not defined");f.formatMessage(f.logType.SYSTEM,"DISK",(f.hasDiskRead()?u.green("+"):u.red("-"))+"r "+(f.hasDiskWrite()?u.green("+"):u.red("-"))+"w","",{titleColor:"blue"}),f.formatMessage(f.logType.SYSTEM,"UNC",(f.hasUNCRead()?u.green("+"):u.red("-"))+"r "+(f.hasUNCWrite()?u.green("+"):u.red("-"))+"w","",{titleColor:"blue"}),a.cors?(m.use(i({origin:a.cors})),m.options("*",i())):U.cors&&U.cors.origin&&(m.use(i(U.cors)),m.options("*",i()),a.cors="string"==typeof U.cors.origin?U.cors.origin:"true"),f.formatMessage(f.logType.SYSTEM,"CORS",a.cors?u.green(a.cors):u.grey("disabled"),"",{titleColor:"blue"}),a.port?c=a.port.toString():!c&&U.port&&(c=U.port[l]),c=+c>=0&&c||"3000",m.use(n.json({limit:U.request_post_limit||"250mb"})),m.listen(c,(()=>{console.log(""),f.formatMessage(f.logType.SYSTEM,l.toUpperCase(),"Express server listening on port "+u.bold(c),"",{titleColor:l.startsWith("prod")?"green":"yellow"}),console.log("")})),process.env.NODE_ENV=l,process.env.PORT=c}m.post("/api/v1/assets/copy",((e,r)=>{const t=e.query,o=s.normalize(t.to);if(o&&g.hasPermissions(o,r))try{const s=new g(o,e.body,(function(){r.json({success:this.files.size>0,files:Array.from(this.files)}),s.formatMessage(f.logType.NODE,"WRITE",[o,this.files.size+" files"],"")}));U(s,t),s.processAssets("1"===t.empty)}catch(e){r.json({success:!1,error:{hint:"FILE: Unknown",message:e.toString()}})}})),m.post("/api/v1/assets/archive",((e,t)=>{const o=e.query,i=o.to&&s.normalize(o.to),n=s.join(__dirname,"tmp"+s.sep+l.v4());let p;try{r.mkdirpSync(n),i&&g.hasPermissions(i,t)?p=i:(p=n+"-zip",r.mkdirpSync(p))}catch(e){return void t.json({success:!1,error:{hint:`DIRECTORY: ${n}`,message:e.toString()}})}let u=o.append_to,m="",y=!1,h=!1,b=(o.format||"zip").toLowerCase();switch(s.isAbsolute(u)&&(u=s.normalize(u)),b){case"7z":k?y=!0:(S(),b="zip");break;case"gz":case"tgz":h=!0;case"tar":break;default:b="zip"}const w=()=>{m=s.join(p,(o.filename||m||l.v4())+"."+b);const i=new g(n,e.body,(()=>{const e={success:i.files.size>0,zipname:m,files:Array.from(i.files)},o=r=>{r&&(e.bytes=r),t.json(e),i.formatMessage(f.logType.NODE,"WRITE",[s.basename(m),r+" bytes"])};if(y)d.add(m,n+s.sep+"*",{$bin:k,recursive:!0}).on("end",(()=>o(g.getFileSize(m)))).on("error",(e=>f.writeFail(["Unable to create archive",b],e)));else{const s=c(b,{zlib:{level:g.moduleCompress().gzipLevel}}),a=r.createWriteStream(m);a.on("close",(()=>{if(h){const s="tgz"===b?m.replace(/tar$/,"tgz"):m+".gz";g.moduleCompress().createWriteStreamAsGzip(m,s).on("finish",(()=>{m=s,e.zipname=s,o(g.getFileSize(s))})).on("error",(r=>{e.success=!1,i.writeFail(["Unable to compress file",s],r),t.json(e)}))}else o(s.pointer())})).on("error",(e=>f.writeFail(["Unable to create archive",b],e))),s.pipe(a),s.directory(n,!1),s.finalize()}}));U(i,o);try{i.processAssets()}catch(e){t.json({success:!1,error:{hint:"FILE: Unknown",message:e.toString()}})}};if(u)if(k){const e=/([^/\\]+)\.\w+?$/i.exec(u);if(e){const o=s.join(p,e[0]),i=()=>{m=e[1],d.extractFull(o,n,{$bin:k,recursive:!0}).on("end",w).on("error",(e=>{f.writeFail(["Unable to decompress file",o],e),w()}))};try{if(f.isFileURI(u)){const e=r.createWriteStream(o);return e.on("finish",i),void a(u).on("response",(e=>{const s=e.statusCode;s>=300&&f.writeFail(["Unable to download file",u],s+" "+e.statusMessage)})).on("error",(()=>w())).pipe(e)}if(r.existsSync(u)){if(f.isFileUNC(u)){if(!f.hasUNCRead())return void t.json({success:!1,error:{hint:"OPTION: --unc-read",message:"Reading from UNC shares is not enabled."}})}else if(!f.hasDiskRead()&&s.isAbsolute(u))return void t.json({success:!1,error:{hint:"OPTION: --disk-read",message:"Reading from disk is not enabled."}});return void r.copyFile(u,o,i)}f.writeFail("Archive not found",u)}catch(e){f.writeFail(o,e)}}else f.writeFail("Invalid archive format",u)}else S();w()})),m.get("/api/v1/browser/download",((e,s)=>{const r=e.query.uri;r&&s.sendFile(r,(e=>{e&&f.writeFail(["Unable to send file",r],e)}))})),m.get("/api/v1/loader/json",((e,t)=>{const o=e.query.uri;let i=!0;if(o){const e=(e,r)=>{let i;if(!e)try{switch(s.extname(o).toLowerCase()){case".json":case".js":i=JSON.parse(r);break;case".yaml":case".yml":i=p.load(r)}}catch(s){e=s}"object"==typeof i?t.json({success:!0,data:i}):t.json({success:!1,error:{hint:`FILE: Unable to download (${o})`,message:e}})};f.isFileURI(o)?a(o,((s,r)=>e(s,r.body))):r.existsSync(o)&&(f.isFileUNC(o)?f.hasUNCRead()||(i=!1):f.hasDiskRead()||(i=!1),i&&r.readFile(o,"utf8",((s,r)=>e(s,r))))}i||t.json({success:!1,error:{hint:"FILE: Unknown",message:o}})}))}();
