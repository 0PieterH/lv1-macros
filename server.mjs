import {decodeMIDI,validateMappings,matchesMIDI} from './lib/midi.mjs';
import http from 'node:http';
import dgram from 'node:dgram';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { MacroEngine,validateMacros,validateAction } from './lib/engine.mjs';
import { Mixer } from './lib/mixer.mjs';
import { ACTIONS,PROPERTIES,GROUPS,seedMacros } from './lib/catalog.mjs';
import { decodePacket } from './lib/osc.ts';
const root=path.dirname(fileURLToPath(import.meta.url)),dataDir=process.env.LV1_DATA_DIR||path.join(root,'data');
fs.mkdirSync(dataDir,{recursive:true});
const savePath=path.join(dataDir,'macros.json'),clients=new Set(),logs=[];
let engine,mixer,revision=0,broadcastTimer,capture=false,captured=[],discovery=[],udp=null,udpPort=null;
function log(type,message){logs.unshift({id:++revision,time:new Date().toISOString(),type,message});logs.splice(250);schedule();}
function schedule(){if(broadcastTimer)return;broadcastTimer=setTimeout(()=>{broadcastTimer=null;const event='data: '+JSON.stringify(snapshot())+'\n\n';for(const res of clients)res.write(event);},70);}
function snapshot(){return{state:mixer.state,macros:engine.macros,armed:engine.armed,running:[...engine.running.keys()],logs,capture,captured,discovery,udpPort};}
mixer=new Mixer(log);
engine=new MacroEngine({getState:()=>mixer.state,execute:(a,ctx)=>mixer.execute(a,ctx),log});
engine.on('change',schedule);mixer.on('change',()=>{engine.changed();schedule();});mixer.on('offline',()=>{engine.arm(false);});
mixer.on('discovery',entries=>{discovery=entries;schedule();});
let initial=seedMacros();if(fs.existsSync(savePath)){try{initial=validateMacros(JSON.parse(fs.readFileSync(savePath,'utf8')));}catch(e){console.error('Saved macros could not be read:',e.message);log('error','Saved macro file is invalid; examples loaded. Original file preserved.');}}
engine.setMacros(initial);
const midiPath=path.join(dataDir,'midi-mappings.json');let midiMappings=[];
try{if(fs.existsSync(midiPath))midiMappings=validateMappings(JSON.parse(fs.readFileSync(midiPath,'utf8')));}catch(e){log('error','MIDI mappings could not be loaded: '+e.message);}

function persist(macros){validateMacros(macros);const temp=savePath+'.tmp';fs.writeFileSync(temp,JSON.stringify(macros,null,2));fs.renameSync(temp,savePath);engine.setMacros(macros);schedule();}
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>1024*1024)throw Error('Request too large');}return text?JSON.parse(text):{};}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  // Loopback binding, Host checks and same-origin writes prevent websites from driving the mixer.
  if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host||''))return json(res,403,{error:'Local host required'});
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
  if(req.method==='GET'&&url.pathname==='/api/midi-mappings')return json(res,200,{mappings:midiMappings});
  if(req.method==='POST'){
    if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return json(res,403,{error:'Same-origin request required'});
    if(!(req.headers['content-type']||'').startsWith('application/json'))return json(res,415,{error:'Use application/json'});
    try{const b=await body(req);switch(url.pathname){
      case '/api/midi-mappings':{validateMappings(b.mappings);const temp=midiPath+'.tmp';fs.writeFileSync(temp,JSON.stringify(b.mappings,null,2));fs.renameSync(temp,midiPath);midiMappings=b.mappings;return json(res,200,{ok:true});}
      case '/api/midi':{const event=decodeMIDI(b.data||[]);if(!event||typeof b.device!=='string')throw Error('Invalid MIDI message');event.device=b.device;if(engine.armed){const targets=new Set(midiMappings.filter(r=>matchesMIDI(r,event)).map(r=>r.macro));if(event.type==='pc'){const address=`/midi/${event.channel}/${event.number}`;for(const m of engine.macros)if(m.trigger==='external'&&m.address===address)targets.add(m.id);}for(const id of targets){const m=engine.macros.find(m=>m.id===id);if(m?.enabled&&!engine.running.has(id))void engine.fire(id,'MIDI').catch(()=>{});}}return json(res,200,{ok:true});}
      case '/api/macros':persist(b.macros);log('system','Macro library saved');return json(res,200,{ok:true});
      case '/api/arm':if(b.armed)mixer.assertReady();else mixer.cancelFades();engine.arm(b.armed===true);return json(res,200,{ok:true});
      case '/api/stop':engine.arm(false);mixer.cancelFades();return json(res,200,{ok:true});
      case '/api/fire':await engine.fire(b.id,b.source==='keyboard'?'keyboard':'manual');return json(res,200,{ok:true});
      case '/api/action':{
        validateAction(b.action);if(!engine.armed)throw Error('Arm the system before sending controls');await mixer.execute(b.action);if(capture){captured.push(structuredClone(b.action));if(captured.length>=128)capture=false;}log('control',ACTIONS[b.action.type].label);schedule();return json(res,200,{ok:true});
      }
      case '/api/capture':capture=b.enabled===true;if(capture)captured=[];schedule();return json(res,200,{ok:true});
      case '/api/connect':engine.arm(false);capture=false;await mixer.connect(String(b.host||''),Number(b.port||0));log('system',`Connecting to ${b.host}`);return json(res,200,{ok:true});
      case '/api/simulator':engine.arm(false);mixer.simulate();log('system','Simulator selected');return json(res,200,{ok:true});
      case '/api/discover':discovery=await mixer.scan();schedule();return json(res,200,{entries:discovery});
      case '/api/event':if(typeof b.address!=='string')throw Error('Expected an event address');engine.external(b.address,'local event');return json(res,200,{ok:true});
      case '/api/udp':{
        udp?.close();udp=null;udpPort=null;const port=Number(b.port);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('OSC listen port must be 1024–65535');
        const socket=dgram.createSocket('udp4');socket.on('message',buf=>{try{const m=decodePacket(buf);engine.external(m.address,'OSC UDP');log('external',m.address);}catch(e){log('error','OSC input: '+e.message);}});
        socket.on('error',e=>{log('error','OSC listener: '+e.message);if(udp===socket){udp=null;udpPort=null;}try{socket.close();}catch{}});
        await new Promise((resolve,reject)=>{socket.once('error',reject);socket.bind(port,'127.0.0.1',resolve);});udp=socket;udpPort=port;log('system',`OSC input listening on 127.0.0.1:${port}`);schedule();return json(res,200,{ok:true});
      }
      case '/api/simulate':{
        if(mixer.state.mode!=='simulator')throw Error('Simulated state edits are available only in simulator mode');
        const p=b.patch||{};if(b.kind==='track'){const allowed=['gain','muted','solo','pan','width','meter','meterR'];for(const [k,v]of Object.entries(p)){if(!allowed.includes(k))throw Error('Invalid simulator property');if(['muted','solo'].includes(k)?typeof v!=='boolean':!Number.isFinite(v))throw Error('Invalid simulator value');}if(!mixer.state.tracks[b.track])throw Error('Unknown channel');mixer.patchTrack(b.track,p);}
        else if(b.kind==='global'){if(Object.keys(p).some(k=>!['scene','sceneName','tempo','layer','mixer','flipAux'].includes(k)))throw Error('Invalid global');Object.assign(mixer.state.globals,p);mixer.changed();}
        else if(b.kind==='indexed'){if(!['muteGroups','talkback','spills'].includes(b.collection))throw Error('Invalid collection');mixer.state[b.collection][String(b.key)]=b.value===true;mixer.changed();}
        else if(b.kind==='send'){mixer.patchSend(b.key,{on:!!p.on,gain:Number(p.gain)});}
        else throw Error('Unknown simulation input');return json(res,200,{ok:true});
      }
      default:return json(res,404,{error:'Not found'});
    }}catch(e){log('error',e.message);return json(res,400,{error:e.message});}
  }
  if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
  if(url.pathname==='/api/health')return json(res,200,{service:'lv1-macro-studio',version:'1.0.0'});
  if(url.pathname==='/api/state')return json(res,200,snapshot());
  if(url.pathname==='/api/catalog')return json(res,200,{actions:ACTIONS,properties:PROPERTIES,groups:GROUPS});
  if(url.pathname==='/api/events'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});res.write('data: '+JSON.stringify(snapshot())+'\n\n');clients.add(res);const keep=setInterval(()=>res.write(': keepalive\n\n'),15000);req.on('close',()=>{clients.delete(res);clearInterval(keep);});return;}
  const files={'/':'index.html','/app.js':'app.js','/midi-ui.js':'midi-ui.js','/midi.mjs':'../lib/midi.mjs','/style.css':'style.css','/catalog.mjs':'../lib/catalog.mjs'};const file=files[url.pathname];if(!file)return json(res,404,{error:'Not found'});
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'");
  res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store'});fs.createReadStream(path.join(root,'public',file)).pipe(res);
});
let port=Number(process.env.LV1_APP_PORT??3210);
server.on('error',e=>{console.error(e.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{port=server.address().port;const url=`http://127.0.0.1:${port}`;console.log(`LV1 Macro Studio ready at ${url} · simulator mode · automation disarmed`);process.parentPort?.postMessage({type:'ready',port});if(process.argv.includes('--open')&&process.platform==='win32'){const browser=spawn('explorer.exe',[url],{windowsHide:true});browser.on('error',()=>console.log('Open '+url+' in your browser.'));browser.unref();}});
function shutdown(){engine.arm(false);mixer.close();udp?.close();for(const res of clients)res.end();server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),1000).unref();}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
process.parentPort?.on('message',event=>{if(event.data?.type==='shutdown')shutdown();});
