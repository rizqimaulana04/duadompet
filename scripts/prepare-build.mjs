import fs from 'node:fs';
import path from 'node:path';
// Pre-create directory trees serially before webpack/prerender workers on
// Windows. This avoids transient EPERM mkdir races in restricted environments.
if(process.platform==='win32'){
 const cwd=path.resolve(process.cwd());
 const output=path.resolve(cwd,process.env.NEXT_BUILD_DIR||'.next');
 if(!output.startsWith(cwd+path.sep))throw new Error('Build output must be a dedicated directory inside the project');
 const folders=['cache/webpack/client-production','cache/webpack/server-production','cache/webpack/edge-server-production','server/app','server/pages','server/chunks','static/chunks/app','static/chunks/pages','static/css','types/app','diagnostics'];
 const routes=['demo','login','register','forgot-password','reset-password','_not-found','_global-error','(app)/[...path]','api/account','api/auth/[...nextauth]','api/cron','api/data','api/reports'];
 for(const route of routes){folders.push('server/app/'+route,'static/chunks/app/'+route);if(!route.startsWith('api/')&&!route.startsWith('(app)'))folders.push('server/app/'+route+'.segments/'+route);}
 folders.push('server/app/index.segments');
 for(const folder of folders)fs.mkdirSync(path.join(output,folder),{recursive:true});
 console.log('Prepared Windows build directories. Existing build output is preserved.');
}
