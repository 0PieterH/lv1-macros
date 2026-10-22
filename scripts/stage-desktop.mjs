import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepare} from './prepare-desktop.mjs';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function stageDesktop(){
 const runtime=prepare(),stage=path.join(root,'.desktop-stage');fs.mkdirSync(stage,{recursive:true});
 fs.cpSync(path.join(root,'electron'),path.join(stage,'electron'),{recursive:true});fs.cpSync(runtime,path.join(stage,'runtime'),{recursive:true});
 fs.copyFileSync(path.join(root,'LICENSE'),path.join(stage,'LICENSE'));
 for(const file of ['README.md','LIVE-TEST.md','VALIDATION.md','ELECTRON.md','MACOS.md'])fs.copyFileSync(path.join(root,file),path.join(stage,file));
 const source=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
 fs.writeFileSync(path.join(stage,'package.json'),JSON.stringify({name:source.name,productName:source.productName,version:source.version,main:source.main,type:'module',license:'MIT',description:source.description},null,2));
 return {stage,source};
}
