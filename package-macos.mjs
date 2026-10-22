import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {packager} from '@electron/packager';
import {stageDesktop,root} from './stage-desktop.mjs';
if(process.platform!=='darwin')throw Error('Build macOS apps on a Mac, or use the included GitHub Actions workflow. This preserves framework symlinks, executable permissions and valid ad-hoc signatures.');
const requested=process.argv[2]||'all';if(!['all','arm64','x64'].includes(requested))throw Error('Architecture must be arm64, x64 or all');
const {stage,source}=stageDesktop(),architectures=requested==='all'?['arm64','x64']:[requested];
for(const arch of architectures){
 const outputs=await packager({dir:stage,out:path.join(root,'dist'),name:'LV1 Macro Studio',platform:'darwin',arch,electronVersion:source.devDependencies.electron,overwrite:true,asar:false,prune:true,icon:path.join(root,'electron','icon.icns'),appBundleId:'com.lv1macrostudio.app',appCategoryType:'public.app-category.music',darwinDarkModeSupport:true,osxSign:{identity:'-',identityValidation:false,hardenedRuntime:false,preAutoEntitlements:false},appCopyright:'Community LV1 Macro Studio contributors; protocol portions © 2026 Miguel Lourenço'});
 for(const output of outputs){const bundle=path.join(output,'LV1 Macro Studio.app');execFileSync('/usr/bin/codesign',['--force','--deep','--sign','-','--options','0','--preserve-metadata=entitlements',bundle],{stdio:'inherit'});execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',bundle],{stdio:'inherit'});const zip=path.join(root,'dist',`LV1-Macro-Studio-macOS-${arch}.zip`);if(fs.existsSync(zip))fs.unlinkSync(zip);execFileSync('/usr/bin/ditto',['-c','-k','--sequesterRsrc','--keepParent',bundle,zip],{stdio:'inherit'});console.log('MACOS APP: '+bundle);console.log('MACOS ZIP: '+zip);}
}
