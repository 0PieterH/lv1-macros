import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import {seedMacros} from '../lib/catalog.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function prepare(){
 const output=path.join(root,'desktop-runtime');fs.mkdirSync(path.join(output,'lib'),{recursive:true});
 for(const name of fs.readdirSync(path.join(root,'lib'))){if(!/\.(mjs|ts)$/.test(name))continue;let code=fs.readFileSync(path.join(root,'lib',name),'utf8');if(name.endsWith('.ts'))code=stripTypeScriptTypes(code,{mode:'strip'});code=code.replaceAll('./osc.ts','./osc.mjs').replaceAll('./zdns-discover.ts','./zdns-discover.mjs');fs.writeFileSync(path.join(output,'lib',name.replace(/\.ts$/,'.mjs')),code);}
 let server=fs.readFileSync(path.join(root,'server.mjs'),'utf8').replaceAll('./lib/osc.ts','./lib/osc.mjs');fs.writeFileSync(path.join(output,'server.mjs'),server);
 fs.cpSync(path.join(root,'public'),path.join(output,'public'),{recursive:true});
 // Ship deterministic examples, never a developer's saved mixer or macro data.
 fs.writeFileSync(path.join(output,'seed-macros.json'),JSON.stringify(seedMacros(),null,2));
 console.log('Prepared bundled desktop bridge (plain JavaScript; no system Node required).');return output;
}
if(process.argv[1]===fileURLToPath(import.meta.url))prepare();
