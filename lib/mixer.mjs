import {namingPlan} from './naming.mjs';
import { EventEmitter } from 'node:events';
import dgram from 'node:dgram';
import { isIPv4 } from 'node:net';
import { LV1Transport } from './transport.mjs';
import { discover } from './zdns-discover.ts';
import { encodeMessage } from './osc.ts';
import { GROUPS } from './catalog.mjs';
import { validateAction,parseArgs } from './engine.mjs';
export function blankState(){return{tracks:{},sends:{},muteGroups:{},talkback:{},spills:{},userKeys:{},scenes:{},globals:{},mode:'simulator',status:'simulator',host:'',port:0};}
const int=value=>({type:'i',value}),double=value=>({type:'d',value}),float=value=>({type:'f',value}),bool=value=>({type:value?'T':'F'}),str=value=>({type:'s',value});
export class Mixer extends EventEmitter{
  constructor(log){super();this.log=log;this.state=blankState();this.epoch=0;this.transport=new LV1Transport();this.fades=new Map();this.talkHolds=new Map();this.scanHandle=null;this.recovery=null;this.failures=0;
    this.transport.on('notice',m=>log('error',m));
    this.transport.on('message',m=>{try{this.notify(m);}catch(e){log('error','Ignored malformed LV1 message: '+e.message);}});
    this.transport.on('status',status=>{this.state.status=status;if(status==='disconnected'){this.cancelFades();this.state.tracks={};this.state.sends={};this.state.globals={};this.state.scenes={};this.state.muteGroups={};this.state.talkback={};this.state.spills={};this.state.userKeys={};this.emit('offline');this.failures++;if(this.failures>=2&&!this.recovery){const epoch=this.epoch;this.recovery=this.scan(this.state.host).then(entries=>{if(epoch===this.epoch&&entries[0]?.port){this.state.port=entries[0].port;this.transport.updatePort(entries[0].port);}}).catch(e=>log('error',e.message)).finally(()=>this.recovery=null);}}if(status==='connected'){this.failures=0;this.emit('online');}this.changed();});this.simulate();
  }
  changed(){this.emit('change',this.state);}
  cancelFades(){for(const release of [...this.talkHolds.values()])release();for(const controller of this.fades.values())controller.abort();this.fades.clear();}
  simulate(){this.cancelFades();this.epoch++;this.scanHandle?.stop();this.transport.disconnect();this.emit('offline');this.state=blankState();
    const names=['Presenter','Vocal','Guitar','Walk-in music','Playback L','Playback R','Guest 1','Guest 2'];
    for(const [g,label,count] of GROUPS)for(let ch=0;ch<(g===0?16:g===2?8:count);ch++)this.state.tracks[`${g}.${ch}`]={group:g,ch,name:g===0?(names[ch]||`Input ${ch+1}`):`${label} ${ch+1}`,gain:-10,muted:false,solo:false,pan:0,width:1,meter:-60,meterR:-60,color:'#6ca6c6'};
    this.state.scenes={0:'Walk-in',2:'Show start',5:'Encore'};this.state.globals={scene:0,sceneName:'Walk-in',tempo:120,layer:0,mixer:1,flipAux:0};
    for(let i=0;i<8;i++){this.state.muteGroups[i]=false;this.state.talkback[i]=false;this.state.spills[`0.${i}`]=false;}
    this.state.userKeys[0]={name:'Mon 1',func:'Flip Sends: MX1: Mon 1',assigned:true};this.state.tracks['0.0'].gain=-40;
    for(let ch=0;ch<16;ch++)for(let aux=0;aux<8;aux++)this.state.sends[`0.${ch}.${aux}`]={on:false,gain:-144};this.changed();
  }
  async connect(host,port){if(!isIPv4(host))throw Error('Enter the LV1 IPv4 address');if(!Number.isInteger(port)||port<0||port>65535)throw Error('Port must be 0–65535');this.cancelFades();this.epoch++;const epoch=this.epoch;this.scanHandle?.stop();this.transport.disconnect();this.emit('offline');this.state=blankState();Object.assign(this.state,{mode:'live',host,port,status:'discovering'});this.changed();
    if(!port){const entries=await this.scan(host);if(epoch!==this.epoch)return;if(!entries[0]?.port){this.state.status='disconnected';this.changed();throw Error('No matching LV1 discovered. Enter its port manually.');}port=entries[0].port;}
    if(epoch!==this.epoch)return;this.state.port=port;this.transport.connect(host,port);
  }
  async scan(host){this.scanHandle?.stop();const handle=discover({timeoutMs:5000,filterHostIp:host||undefined});this.scanHandle=handle;const entries=await handle.done;if(this.scanHandle===handle)this.scanHandle=null;return entries;}
  patchTrack(key,patch){const [group,ch]=key.split('.').map(Number);this.state.tracks[key]={group,ch,name:`Track ${key}`,...this.state.tracks[key],...patch};this.changed();}
  patchSend(key,patch){this.state.sends[key]={...this.state.sends[key],...patch};this.changed();}
  notify(m){const a=m.args.map(a=>a.value??(a.type==='T'?true:a.type==='F'?false:undefined)),[g,ch,v]=a,key=`${g}.${ch}`,addr=m.address;
    const numeric=(...xs)=>xs.every(x=>typeof x==='number'&&Number.isFinite(x));
    const trackProps={'/Notify/Track/Out/Gain':'gain','/Notify/Track/Pan':'pan','/Notify/Track/Pan/Width':'width'};
    // PanArcWidth is a display/arc quantity (857.14 observed on LV1 v17), not normalized stereo width.
    if(trackProps[addr]&&numeric(g,ch,v)){if(trackProps[addr]==='width'&&(v<0||v>1))return;return this.patchTrack(key,{[trackProps[addr]]:v});}
    if(addr==='/Notify/Track/Out/Mute'&&numeric(g,ch,v)){if(g===13)this.state.muteGroups[ch]=!!v;else return this.patchTrack(key,{muted:!!v});}
    else if(addr==='/Notify/Solo'&&numeric(g,ch,v))return this.patchTrack(key,{solo:!!v});
    else if(['/Notify/Track/Name','/Notify/TrackName'].includes(addr)&&typeof v==='string')return this.patchTrack(key,{name:v});
    else if(addr==='/Notify/TrackColor'&&numeric(g,ch,a[3],a[4],a[5]))return this.patchTrack(key,{color:'#'+a.slice(3,6).map(x=>Math.round(Math.max(0,Math.min(1,x))*255).toString(16).padStart(2,'0')).join('')});
    else if(addr==='/Notify/Aux/Send/On'&&numeric(g,ch,v)&&typeof a[3]==='boolean')return this.patchSend(`${key}.${v}`,{on:a[3]});
    else if(addr==='/Notify/Aux/Send/Gain'&&numeric(g,ch,v,a[3]))return this.patchSend(`${key}.${v}`,{gain:a[3]});
    else if(addr==='/Notify/CurSceneIndex'&&numeric(g)){this.state.globals.scene=g;this.state.globals.sceneName=this.state.scenes[g]??'';}
    else if(addr==='/Notify/Scene/Name'&&typeof g==='string'){this.state.globals.sceneName=g;if(this.state.globals.scene!==undefined)this.state.scenes[this.state.globals.scene]=g;}
    else if(addr==='/Notify/SceneList'&&numeric(g)&&g>=0&&g<=999){this.state.scenes={};for(let i=1;i<Math.min(a.length,1+g*2)-1;i+=2)if(numeric(a[i])&&typeof a[i+1]==='string')this.state.scenes[a[i]]=a[i+1];this.state.globals.sceneName=this.state.scenes[this.state.globals.scene]??'';}
    else if(addr==='/Notify/Tempo'&&numeric(g))this.state.globals.tempo=g;
    else if(addr==='/Notify/CurrentLayer'&&numeric(g,ch))Object.assign(this.state.globals,{mixer:g+1,layer:ch});
    else if(addr==='/Notify/SpillButton'&&numeric(g,ch,v))this.state.spills[key]=!!v;
    else if(addr==='/Notify/UserKeyInfo'&&numeric(g,a[3]))this.state.userKeys[g]={name:ch,func:v,assigned:!!a[3]};
    else if(addr==='/Notify/InternalAssign'&&numeric(g,ch,v,a[3],a[4])){if(v===2)this.state.talkback[a[3]]=!!a[4];if(v===7){if(a[4]===1)this.state.globals.flipAux=g===2?ch+1:0;else if(this.state.globals.flipAux===ch+1)this.state.globals.flipAux=0;}}
    else if(addr==='/Notify/Meters'){for(let i=1;i+3<a.length;i+=4){if(!numeric(...a.slice(i,i+4)))continue;const k=`${a[i]}.${a[i+1]}`,t=this.state.tracks[k];if(t&&[0,1].includes(a[i+2]))t[a[i+2]===0?'meter':'meterR']=a[i+3];}}
    else if(addr==='/Channels'&&numeric(g)&&g<=256){for(let i=0;i<g;i++){const j=1+i*19;if(typeof a[j]==='string'&&numeric(a[j+1],a[j+2])){const k=`${a[j+1]}.${a[j+2]}`,patch={group:a[j+1],ch:a[j+2],name:a[j]};
      // Confirmed on the user's LV1 v17.6.26.454 by independent /Channels readback before/after fader and mute changes.
      if(m.args.length===1+g*19&&m.args[j+3]?.type==='d'&&numeric(a[j+3])&&a[j+3]>=-144&&a[j+3]<=10)patch.gain=a[j+3];
      if(m.args.length===1+g*19&&m.args[j+6]?.type==='i'&&[0,1].includes(a[j+6]))patch.muted=!!a[j+6];
      this.state.tracks[k]={...this.state.tracks[k],...patch};}}}
    else if(addr==='/Aux/Tracks'){for(let i=1;i+2<a.length;i+=3)if(numeric(a[i])&&typeof a[i+2]==='string'){const k=`2.${a[i]}`;this.state.tracks[k]={...this.state.tracks[k],group:2,ch:a[i],name:a[i+2]};}}
    else if(addr==='/Notify/Layers'){let i=3;const layers=a[2];if(!numeric(layers)||layers>32)return;for(let l=0;l<layers&&i<a.length;l++){i++;const count=a[i++];if(!numeric(count)||count<0||count>256)break;for(let j=0;j<count&&i+1<a.length;j++){const group=a[i++],channel=a[i++];if(!numeric(group,channel)||group<0||channel<0)continue;const k=`${group}.${channel}`;this.state.tracks[k]={group,ch:channel,name:`${GROUPS.find(x=>x[0]===group)?.[1]??'Track'} ${channel+1}`,...this.state.tracks[k]};}}}
    else return;this.changed();
  }
  send(address,args=[]){if(this.state.mode==='live')this.transport.send(address,args);}
  assertReady(){if(this.state.mode==='live'&&!this.transport.registered)throw Error('LV1 is not registered');}
  async execute(a,{signal,macro,onCleanup}={}){
    validateAction(a);this.assertReady();if(signal?.aborted)throw Error('Cancelled');
    if(a.type==='renameSequence'){for(const row of namingPlan(a))await this.execute({type:'rename',track:row.track,text:row.name},{signal,macro,onCleanup});return;}
    if(a.through>0){const [group,start]=a.track.split('.').map(Number);for(let channel=start;channel<a.through;channel++)await this.execute({...a,track:`${group}.${channel}`,through:0},{signal});return;}
    const [g,ch]=(a.track||'0.0').split('.').map(Number),ints=[int(g),int(ch)],key=`${g}.${ch}`,aux=(a.aux??1)-1;
    const send=(address,args)=>this.send(address,args),trackPatch=patch=>this.patchTrack(key,patch),sendKey=`${key}.${aux}`;
    const desired=current=>a.state==='toggle'?(current===undefined?(()=>{throw Error('State unknown; use explicit ON/OFF until mixer state arrives');})():!current):a.state==='on';
    const fadeKey=a.type==='sendFade'||a.type==='sendGain'?`send:${sendKey}`:`out:${key}`;
    if(['gain','sendGain','fade','sendFade'].includes(a.type)){this.fades.get(fadeKey)?.abort();this.fades.delete(fadeKey);}
    switch(a.type){
      case 'mute':{const on=desired(this.state.tracks[key]?.muted);send('/Set/Track/Out/Mute',[...ints,bool(on)]);trackPatch({muted:on});break;}
      case 'solo':{const on=desired(this.state.tracks[key]?.solo);send('/Set/Solo',[...ints,int(+on)]);trackPatch({solo:on});break;}
      case 'clearSolo':send('/ClearAllSolo',[]);for(const t of Object.values(this.state.tracks))t.solo=false;this.changed();break;
      case 'gain':send('/Set/Track/Out/Gain',[...ints,double(a.value)]);trackPatch({gain:a.value});break;
      case 'pan':send('/Set/Track/Pan',[...ints,double(a.value)]);trackPatch({pan:a.value});break;
      case 'width':send('/Set/Track/Pan/Width',[...ints,double(a.value)]);trackPatch({width:a.value});break;
      case 'sendOn':{const on=desired(this.state.sends[sendKey]?.on);send('/Set/Aux/Send/On',[...ints,int(aux),bool(on)]);this.patchSend(sendKey,{on});break;}
      case 'sendGain':send('/Set/Aux/Send/Gain',[...ints,int(aux),double(a.value)]);this.patchSend(sendKey,{gain:a.value});break;
      case 'sendPan':send('/Set/Aux/Send/Pan',[...ints,int(aux),double(a.value)]);break;
      case 'fade':case 'sendFade':{
        const start=a.type==='fade'?this.state.tracks[key]?.gain:this.state.sends[sendKey]?.gain;if(!Number.isFinite(start))throw Error('Cannot fade: current fader value is unknown');
        const controller=new AbortController(),epoch=this.epoch;this.fades.set(fadeKey,controller);const since=Date.now();
        try{do{if(controller.signal.aborted||signal?.aborted||epoch!==this.epoch)throw Error('Fade cancelled');const t=a.duration===0?1:Math.min(1,(Date.now()-since)/a.duration);const value=start+(a.value-start)*t;send(a.type==='fade'?'/Set/Track/Out/Gain':'/Set/Aux/Send/Gain',a.type==='fade'?[...ints,double(value)]:[...ints,int(aux),double(value)]);if(a.type==='fade')trackPatch({gain:value});else this.patchSend(sendKey,{gain:value});if(t>=1)break;await new Promise(r=>setTimeout(r,30));}while(true);}finally{if(this.fades.get(fadeKey)===controller)this.fades.delete(fadeKey);}break;
      }
      case 'muteGroup':{const on=desired(this.state.muteGroups[a.index-1]);send('/Set/MuteGroup',[int(a.index-1),bool(on)]);this.state.muteGroups[a.index-1]=on;this.changed();break;}
      case 'userKey':case 'flip':{if(this.talkHolds.has(a.index-1))throw Error('This User Key is held by a talkback macro');if(a.type==='flip'&&!(this.state.userKeys[a.index-1]?.func||'').startsWith('Flip Sends'))throw Error('Choose an LV1 User Key assigned to Flip Sends');const moment=a.type==='flip'||a.state==='momentary';send('/Set/UserKey',[int(a.index-1),bool(moment||a.state==='on')]);if(moment)send('/Set/UserKey',[int(a.index-1),bool(false)]);if(this.state.mode==='simulator'&&a.type==='flip'){this.state.globals.flipAux=this.state.globals.flipAux?0:a.index;this.changed();}break;}
      case 'spill':{const k=`${a.bank}.${a.index}`,on=desired(this.state.spills[k]);send('/Set/SpillButton',[int(a.bank),int(a.index),int(+on)]);this.state.spills[k]=on;this.changed();break;}
      case 'talkbackMaster':{
        const index=a.index-1,keyInfo=this.state.userKeys[index];
        if(a.state==='off'){
          if(this.talkHolds.size&&!this.talkHolds.has(index))throw Error('Use the same Talkback User Key as the active On action');
          const release=this.talkHolds.get(index);if(release)release();else{send('/Set/UserKey',[int(index),bool(false)]);if(this.state.mode==='simulator'){this.state.globals.talkActive=false;this.changed();}}
          break;
        }
        if(this.state.mode==='live'&&(!keyInfo?.assigned||!/talk/i.test(keyInfo.func||'')||/preset/i.test(keyInfo.func||'')))throw Error('Assign the selected LV1 User Key to Talkback On/Off first');
        if(this.talkHolds.has(index))break;
        if(this.talkHolds.size)throw Error('TALK is already active on another User Key');
        const mode=this.state.mode,transport=this.transport,connectionEpoch=this.epoch;let released=false;
        const release=()=>{if(released)return;released=true;this.talkHolds.delete(index);
          if(mode==='live'){if(connectionEpoch===this.epoch&&transport.registered){try{transport.send('/Set/UserKey',[int(index),bool(false)]);}catch(e){this.log('error','TALK release failed: '+e.message);}}else this.log('error','TALK release could not be confirmed after connection loss. Release TALK on the LV1.');}
          if(mode==='simulator'&&this.state.mode==='simulator'){this.state.globals.talkActive=false;this.changed();}
        };
        send('/Set/UserKey',[int(index),bool(true)]);this.talkHolds.set(index,release);
        if(mode==='simulator'){this.state.globals.talkActive=true;this.changed();}
        break;
      }
      case 'talkbackHold':{
        if(!macro||!onCleanup)throw Error('Hold TALK must run inside a macro');
        const index=a.index-1,keyInfo=this.state.userKeys[index];
        if(this.state.mode==='live'&&(!keyInfo?.assigned||!/talk/i.test(keyInfo.func||'')||/preset/i.test(keyInfo.func||'')))throw Error('Assign the selected LV1 User Key to Talkback On/Off first; refresh/reconnect if its assignment is missing');
        if(this.talkHolds.size)throw Error('TALK is already held by another macro');
        const mode=this.state.mode,transport=this.transport,connectionEpoch=this.epoch;let released=false;
        const release=()=>{if(released)return;released=true;this.talkHolds.delete(index);signal?.removeEventListener('abort',release);
          if(mode==='live'){if(connectionEpoch===this.epoch&&transport.registered){try{transport.send('/Set/UserKey',[int(index),bool(false)]);}catch(e){this.log('error','TALK release failed: '+e.message);}}else this.log('error','TALK release could not be confirmed after connection loss. Release TALK on the LV1.');}
          if(mode==='simulator'&&this.state.mode==='simulator'){this.state.globals.talkActive=false;this.changed();}
        };
        send('/Set/UserKey',[int(index),bool(true)]);this.talkHolds.set(index,release);onCleanup(release);signal?.addEventListener('abort',release,{once:true});
        if(mode==='simulator'){this.state.globals.talkActive=true;this.changed();}
        break;
      }
      case 'talkback':{const on=desired(this.state.talkback[aux]);send('/Set/Aux/Send/On',[int(8),int(0),int(aux),bool(on)]);send('/Set/Aux/Send/Gain',[int(8),int(0),int(aux),double(on?0:-144)]);this.state.talkback[aux]=on;this.patchSend(`8.0.${aux}`,{on,gain:on?0:-144});break;}
      case 'auxFocus':send('/Set/AuxId',[int(a.index-1)]);break;
      case 'scene':case 'sceneNext':case 'scenePrev':{let idx=a.index;const list=Object.keys(this.state.scenes).map(Number).sort((a,b)=>a-b);if(a.type!=='scene'){if(!list.length)throw Error('No scene list received');const current=list.indexOf(this.state.globals.scene);idx=list[(current+(a.type==='sceneNext'?1:-1)+list.length)%list.length];}send('/Set/CurSceneIndex',[int(idx)]);if(this.state.mode==='simulator'){this.state.globals.scene=idx;this.state.globals.sceneName=this.state.scenes[idx]||`Scene ${idx}`;this.changed();}break;}
      case 'tap':send('/TapTempo',[int(1)]);send('/TapTempo',[int(0)]);break;
      case 'inputGain':send('/SetTrackInGain',[...ints,int(0),float(a.value)]);break;
      case 'trim':send('/SetTrackTrim',[...ints,int(0),float(a.value)]);break;
      case 'phantom':send('/SetTrackPhantomState',[...ints,int(0),int(a.state==='on'?1:0)]);break;
      case 'polarity':send('/SetTrackPhaseState',[...ints,int(0),int(a.state==='on'?1:0)]);break;
      case 'plugin':send({eq:'/SetEQState',filter:'/SetFilterState',comp:'/SetCompressorState',deesser:'/SetDeEsserState',dyn:'/SetDynamicsState',gate:'/SetGateState',leveler:'/SetLevelerState',limiter:'/SetLimiterState'}[a.section],[...ints,int(a.state==='on'?1:0)]);break;
      case 'eq':send(`/Set/EQ/Band/${{gain:'Gain',freq:'Freq',q:'Q'}[a.param]}`,[...ints,int(a.band),double(a.value)]);break;
      case 'rename':send('/Set/TrackName',[...ints,str(a.text.trim())]);trackPatch({name:a.text.trim()});break;
      case 'refresh':send('/Get/Aux/Tracks',[]);send('/Get/Layers',[int(0),int(0)]);break;
      case 'discover':{const entries=await this.scan();this.emit('discovery',entries);break;}
      case 'raw':send(a.address,parseArgs(a.args));break;
      case 'osc':{if(!isIPv4(a.host))throw Error('OSC destination must be IPv4');if(this.state.mode==='simulator'){this.log('system','Simulated outgoing OSC '+a.address);break;}const socket=dgram.createSocket('udp4');try{await new Promise((resolve,reject)=>{socket.once('error',reject);socket.send(encodeMessage(a.address,parseArgs(a.args)),a.port,a.host,e=>e?reject(e):resolve());});}finally{try{socket.close();}catch{}}break;}
      case 'wait':await new Promise(r=>setTimeout(r,a.duration));break;
    }
  }
  close(){this.cancelFades();this.epoch++;this.scanHandle?.stop();this.transport.disconnect();}
}
