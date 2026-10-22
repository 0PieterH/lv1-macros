const {app,BrowserWindow,Menu,dialog,shell,utilityProcess}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
app.setName('LV1 Macro Studio');
const isMac=process.platform==='darwin';
if(process.env.LV1_DESKTOP_DATA_DIR){fs.mkdirSync(process.env.LV1_DESKTOP_DATA_DIR,{recursive:true});app.setPath('userData',process.env.LV1_DESKTOP_DATA_DIR);}
const smoke=process.argv.includes('--smoke-test');
let window,bridge,origin,quitting=false,logStream;
const log=value=>{const line=new Date().toISOString()+' '+value+'\n';logStream?.write(line);};
process.on('uncaughtException',error=>{try{fs.appendFileSync(path.join(app.getPath('userData'),'desktop-error.log'),String(error.stack||error)+'\n');}catch{}if(smoke)app.exit(1);});
const lock=app.requestSingleInstanceLock();
if(!lock){app.quit();}else{
 app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
 app.on('activate',()=>{if(window&&!window.isDestroyed()){window.show();window.focus();}});
 app.whenReady().then(launch).catch(error=>{log('STARTUP ERROR '+(error.stack||String(error)));if(!smoke)dialog.showErrorBox('LV1 Macro Studio could not start',error.message);app.exit(1);});
 app.on('window-all-closed',()=>app.quit());
 app.on('before-quit',event=>{if(quitting)return;event.preventDefault();quitting=true;void closeBridge().finally(()=>{logStream?.end();app.quit();});});
}
function request(url,method='GET',data){return new Promise((resolve,reject)=>{
 const parsed=new URL(url),payload=data===undefined?null:JSON.stringify(data);
 const req=http.request({hostname:parsed.hostname,port:parsed.port,path:parsed.pathname,method,timeout:2500,headers:payload?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}:{}},res=>{let text='';res.on('data',chunk=>{text+=chunk;if(text.length>2*1024*1024)req.destroy(Error('Response too large'));});res.on('end',()=>{try{if(res.statusCode!==200)throw Error('HTTP '+res.statusCode);resolve(JSON.parse(text));}catch(e){reject(e);}});});req.on('timeout',()=>req.destroy(Error('Bridge request timed out')));req.on('error',reject);if(payload)req.write(payload);req.end();
});}
function localPage(url){try{const u=new URL(url);return u.origin===origin;}catch{return false;}}
async function existingBridge(){try{const state=await request('http://127.0.0.1:3210/api/state');if(['simulator','live'].includes(state.state?.mode)&&Array.isArray(state.macros)&&Array.isArray(state.logs))return 'http://127.0.0.1:3210';}catch{}return null;}
async function startBridge(){
 const base=app.isPackaged?path.join(app.getAppPath(),'runtime'):path.join(__dirname,'..','desktop-runtime');
 const entry=path.join(base,'server.mjs');if(!fs.existsSync(entry))throw Error('Desktop runtime is missing. Run npm run prepare:desktop first.');
 const dataDir=path.join(app.getPath('userData'),'data');fs.mkdirSync(dataDir,{recursive:true});
 const seed=path.join(base,'seed-macros.json'),saved=path.join(dataDir,'macros.json');if(!fs.existsSync(saved)&&fs.existsSync(seed))fs.copyFileSync(seed,saved);
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('The local mixer bridge did not become ready in 15 seconds')),15000);
  bridge=utilityProcess.fork(entry,[],{env:{...process.env,LV1_DATA_DIR:dataDir,LV1_APP_PORT:'0'},stdio:'pipe',serviceName:'LV1 mixer bridge'});
  bridge.stdout?.on('data',data=>log('BRIDGE '+data.toString().trim()));bridge.stderr?.on('data',data=>log('BRIDGE STDERR '+data.toString().trim()));
  bridge.on('message',message=>{log('BRIDGE CONTROL '+JSON.stringify(message));if(message?.type==='ready'&&Number.isInteger(message.port)){clearTimeout(timer);resolve('http://127.0.0.1:'+message.port);}});
  bridge.once('exit',code=>{clearTimeout(timer);if(!origin)reject(Error('Mixer bridge exited with code '+code));else if(!quitting){log('BRIDGE EXIT '+code);dialog.showErrorBox('Mixer bridge stopped','The mixer connection has stopped. Close and reopen LV1 Macro Studio.');}});
 });
}
async function launch(){
 fs.mkdirSync(app.getPath('userData'),{recursive:true});logStream=fs.createWriteStream(path.join(app.getPath('userData'),'desktop.log'),{flags:'a'});
 origin=process.argv.includes('--own-bridge')?null:await existingBridge();
 if(origin)log('Reusing running LV1 bridge at '+origin);else{origin=await startBridge();log('Started bundled bridge at '+origin);}
 window=new BrowserWindow({width:1440,height:960,minWidth:780,minHeight:600,show:false,title:'LV1 Macro Studio',backgroundColor:'#111413',icon:path.join(__dirname,'icon.png'),webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,spellcheck:false}});
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 window.webContents.on('will-navigate',(event,url)=>{if(!localPage(url))event.preventDefault();});
 window.webContents.session.setPermissionRequestHandler((contents,permission,callback,details)=>{callback(contents===window?.webContents&&localPage(details.requestingUrl||contents.getURL())&&['midi','midiSysex'].includes(permission));});
 window.webContents.session.setPermissionCheckHandler((contents,permission,requestingOrigin)=>contents===window?.webContents&&localPage(requestingOrigin)&&['midi','midiSysex'].includes(permission));
 window.webContents.on('console-message',(_event,level,message)=>{if(level>=2)log('RENDERER '+message);});
 window.on('unresponsive',()=>log('Window reported unresponsive'));window.webContents.on('render-process-gone',(_event,details)=>log('Renderer exit: '+details.reason));
 window.once('ready-to-show',()=>{log('Desktop window ready');if(!smoke)window.show();});
 Menu.setApplicationMenu(Menu.buildFromTemplate([
  ...(isMac?[{role:'appMenu'}]:[]),
  {label:'File',submenu:[{label:'Open desktop data folder',click:()=>shell.openPath(app.getPath('userData'))},{type:'separator'},{label:'Stop all automation',accelerator:'CmdOrCtrl+Shift+.',click:()=>request(origin+'/api/stop','POST',{}).catch(e=>log(e.message))},{role:isMac?'close':'quit'}]},
  {label:'Edit',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
  {label:'View',submenu:[{role:'reload'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]},
  ...(isMac?[{role:'windowMenu'}]:[]),
  {label:'Help',submenu:[{label:'About LV1 Macro Studio',click:()=>dialog.showMessageBox(window,{type:'info',title:'LV1 Macro Studio',message:'LV1 Macro Studio 1.0',detail:'Local Waves LV1 control and conditional macros.\n\nCredits: Pieter HUTAPEA\nProtocol contributions: Miguel Lourenço\n\nClosing the desktop window disarms automation.\nMacro engine and mixer bridge run locally.\nCommunity software; not affiliated with Waves or DiGiCo.'})}]}
 ]));
 await window.loadURL(origin);const state=await request(origin+'/api/state');log('Loaded desktop UI · '+state.state.mode+' · '+state.state.status+' · armed='+state.armed);
 if(smoke){const midi=await window.webContents.executeJavaScript("navigator.requestMIDIAccess({sysex:false}).then(access=>({ok:true,inputs:access.inputs.size}))");if(!midi.ok)throw Error('MIDI access failed');log('MIDI access granted; inputs='+midi.inputs);log('SMOKE PASS: Electron window loaded, bridge state API responded, isolated renderer enabled');fs.writeFileSync(path.join(app.getPath('userData'),'smoke-result.json'),JSON.stringify({ok:true,midi,electron:process.versions.electron,node:process.versions.node,url:origin,mode:state.state.mode,status:state.state.status,ownedBridge:!!bridge,nodeIntegration:window.webContents.getLastWebPreferences().nodeIntegration,contextIsolation:window.webContents.getLastWebPreferences().contextIsolation,sandbox:window.webContents.getLastWebPreferences().sandbox},null,2));app.quit();}
}
async function closeBridge(){
 if(origin){try{await request(origin+'/api/stop','POST',{});log('Automation disarmed on desktop exit');}catch(e){log('Disarm request: '+e.message);}}
 if(bridge){const child=bridge;bridge=null;await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill();resolve();},2000);child.once('exit',()=>{clearTimeout(timer);resolve();});child.postMessage({type:'shutdown'});});}
}
