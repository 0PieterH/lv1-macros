import path from 'node:path';
import {packager} from '@electron/packager';
import {stageDesktop,root} from './stage-desktop.mjs';
const {stage,source}=stageDesktop();
const paths=await packager({dir:stage,out:path.join(root,'dist'),name:'LV1 Macro Studio',platform:'win32',arch:'x64',electronVersion:source.devDependencies.electron,overwrite:true,asar:false,prune:true,icon:path.join(root,'electron','icon.ico'),appCopyright:'© 2026 Pieter HUTAPEA',win32metadata:{CompanyName:'LV1 Macro Studio',FileDescription:'LV1 Macro Studio',ProductName:'LV1 Macro Studio',OriginalFilename:'LV1 Macro Studio.exe'}});
for(const output of paths)console.log('WINDOWS APP: '+output);

