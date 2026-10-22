import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {packager} from '@electron/packager';
import {prepare} from './prepare-desktop.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),runtime=prepare();
const stage=path.join(root,'.desktop-stage');fs.mkdirSync(stage,{recursive:true});
fs.cpSync(path.join(root,'electron'),path.join(stage,'electron'),{recursive:true});fs.cpSync(runtime,path.join(stage,'runtime'),{recursive:true});
fs.copyFileSync(path.join(root,'LICENSE'),path.join(stage,'LICENSE'));
for(const file of ['README.md','LIVE-TEST.md','VALIDATION.md','ELECTRON.md'])fs.copyFileSync(path.join(root,file),path.join(stage,file));
const source=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
fs.writeFileSync(path.join(stage,'package.json'),JSON.stringify({name:source.name,productName:source.productName,version:source.version,main:source.main,type:'module',license:'MIT',description:source.description},null,2));
const paths=await packager({dir:stage,out:path.join(root,'dist'),name:'LV1 Macro Studio',platform:'win32',arch:'x64',electronVersion:source.devDependencies.electron,overwrite:true,asar:false,prune:true,icon:path.join(root,'electron','icon.ico'),appCopyright:'Community LV1 Macro Studio contributors; protocol portions © 2026 Miguel Lourenço',win32metadata:{CompanyName:'LV1 Macro Studio',FileDescription:'LV1 Macro Studio',ProductName:'LV1 Macro Studio',OriginalFilename:'LV1 Macro Studio.exe'}});
for(const output of paths)console.log('WINDOWS APP: '+output);

