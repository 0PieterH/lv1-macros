import { EventEmitter } from 'node:events';
import { ACTIONS, PROPERTIES, GROUPS } from './catalog.mjs';
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
export function validateMacros(macros) {
  if(!Array.isArray(macros)||macros.length>256) throw Error('Expected up to 256 macros');
  const ids=new Set();
  for(const m of macros){
    if(!m.id||typeof m.id!=='string'||ids.has(m.id))throw Error('Macro IDs must be unique');ids.add(m.id);
    if(typeof m.name!=='string'||!m.name.trim()||m.name.length>100)throw Error('Each macro needs a name (up to 100 characters)');
    if(typeof m.enabled!=='boolean')throw Error('Enabled must be true or false');
    if(!/^#[0-9a-f]{6}$/i.test(m.color||''))m.color='#8ebaf2';
    if(!['manual','conditions','keyboard','external'].includes(m.trigger))throw Error('Invalid trigger');
    if(!['all','any'].includes(m.logic))throw Error('Invalid condition logic');
    if(!Number.isFinite(m.cooldown)||m.cooldown<0||m.cooldown>60000)throw Error('Cooldown must be 0–60000 ms');
    if(m.trigger==='keyboard'&&!/^F([1-9]|1[0-2])$/.test(m.key||''))throw Error('Keyboard trigger needs F1–F12');
    if(m.trigger==='external'&&!/^\/[a-z0-9_/-]{1,120}$/i.test(m.address||''))throw Error('External trigger needs an OSC address such as /macro/go');
    if(!Array.isArray(m.conditions)||m.conditions.length>64||!Array.isArray(m.actions)||!m.actions.length||m.actions.length>128)throw Error('Use 1–128 actions and up to 64 conditions');
    if(m.trigger==='conditions'&&!m.conditions.length)throw Error('Automatic macros need at least one condition');
    for(const c of m.conditions){
      if(!PROPERTIES.some(p=>p[0]===c.property))throw Error('Unknown condition property');
      if(!['lt','lte','gt','gte','eq','neq','on','off'].includes(c.op))throw Error('Unknown condition operator');
      if(!['on','off'].includes(c.op)&&!['sceneName'].includes(c.property)&&!Number.isFinite(Number(c.value)))throw Error('Condition needs a numeric value');
      if(c.tolerance!=null&&(!Number.isFinite(c.tolerance)||c.tolerance<0||c.tolerance>10))throw Error('Equality tolerance must be 0–10');
      if(c.track!=null&&!/^\d{1,2}\.\d{1,3}$/.test(c.track))throw Error('Invalid condition track');
      if(['indexed','send'].includes(PROPERTIES.find(p=>p[0]===c.property)[2])&&(!Number.isInteger(c.index)||c.index<1||c.index>32))throw Error('Condition index must be 1–32');
    }
    for(const a of m.actions)validateAction(a);
  }
  return macros;
}
export function validateAction(a){
  const def=ACTIONS[a.type];if(!def)throw Error('Unknown action: '+a.type);
  if(def.target&&!/^\d{1,2}\.\d{1,3}$/.test(a.track||''))throw Error('Select an action channel');
  if(def.target){const [g,ch]=a.track.split('.').map(Number),group=GROUPS.find(x=>x[0]===g);if(!group||ch>=group[2])throw Error('Channel is outside the supported group range');if(a.through>group[2])throw Error('Channel range exceeds this group');}
  if(a.through!=null&&(!Number.isInteger(a.through)||a.through<0||a.through>256||a.through>0&&(!def.target||a.through<Number(a.track?.split('.')[1])+1)))throw Error('Channel range end must be at or after its starting channel (1-based)');
  if(def.aux&&(!Number.isInteger(a.aux)||a.aux<1||a.aux>32))throw Error('Aux must be 1–32');
  for(const f of def.fields){const v=a[f.key];if(f.type==='number'&&(!Number.isFinite(v)||v<f.min||v>f.max))throw Error(`${def.label}: ${f.label} must be ${f.min}–${f.max}`);if(f.type==='select'&&!f.choices.includes(v))throw Error('Invalid '+f.label);if(f.type==='text'&&(typeof v!=='string'||v.length>8192))throw Error('Invalid '+f.label);}
  if(['inputGain','phantom','polarity','sendOn','sendGain','sendFade','sendPan'].includes(a.type)&&!a.track.startsWith('0.'))throw Error('This action supports input channels only, matching the supplied module');
  if(a.type==='eq'&&((a.param==='freq'&&(a.value<20||a.value>24000))||(a.param==='q'&&(a.value<0.01||a.value>100))||(a.param==='gain'&&(a.value<-30||a.value>30))))throw Error('EQ range: 20–24000 Hz, 0.01–100 Q, or −30–30 dB');
  if(['raw','osc'].includes(a.type)){if(!a.address.startsWith('/')||a.address.includes('\0'))throw Error('OSC address must start with /');parseArgs(a.args);}
  if(a.type==='rename'&&!a.text.trim())throw Error('Channel name cannot be empty');
  return a;
}
export function parseArgs(text){
  const args=JSON.parse(text);if(!Array.isArray(args)||args.length>128)throw Error('OSC args must be an array of up to 128 typed arguments');
  for(const a of args){if(!['i','f','d','s','T','F','N','I'].includes(a.type))throw Error('Unsupported OSC argument type');if(['i','f','d'].includes(a.type)&&(!Number.isFinite(a.value)||(a.type==='i'&&(!Number.isInteger(a.value)||a.value<-2147483648||a.value>2147483647))))throw Error('Invalid numeric OSC argument');if(a.type==='s'&&(typeof a.value!=='string'||a.value.includes('\0')))throw Error('Invalid OSC string');}return args;
}
export function readCondition(state,c){
  const t=state.tracks[c.track];
  if(['gain','muted','solo','pan','width','meter','meterR'].includes(c.property))return t?.[c.property];
  if(c.property==='sendOn'||c.property==='sendGain')return state.sends[`${c.track}.${c.index-1}`]?.[c.property==='sendOn'?'on':'gain'];
  if(c.property==='anySolo'){const known=Object.values(state.tracks).filter(t=>t.solo!==undefined);return known.length?known.some(t=>t.solo):undefined;}
  if(c.property==='muteGroup')return state.muteGroups[c.index-1];
  if(c.property==='talkback')return state.talkback[c.index-1];
  if(c.property==='spill')return state.spills[`0.${c.index-1}`];
  return state.globals[c.property];
}
export function compare(value,c){
  if(value===undefined||value===null||typeof value==='number'&&!Number.isFinite(value))return null;
  if(c.op==='on')return value===true||value===1;
  if(c.op==='off')return value===false||value===0;
  const b=typeof value==='number'?Number(c.value):String(c.value);
  switch(c.op){case 'lt':return value<b;case 'lte':return value<=b;case 'gt':return value>b;case 'gte':return value>=b;case 'eq':return typeof value==='number'?Math.abs(value-b)<=(c.tolerance??0.1):value===b;case 'neq':return typeof value==='number'?Math.abs(value-b)>(c.tolerance??0.1):value!==b;default:return false;}
}
export class MacroEngine extends EventEmitter{
  constructor({getState,execute,log}){super();this.getState=getState;this.execute=execute;this.log=log;this.macros=[];this.armed=false;this.memory=new Map();this.running=new Map();this.generation=0;this.queueing=false;}
  setMacros(macros){validateMacros(macros);this.stop();this.macros=structuredClone(macros);this.memory.clear();this.baseline();}
  result(m){const v=m.conditions.map(c=>compare(readCondition(this.getState(),c),c));if(!v.length)return false;if(m.logic==='any')return v.includes(true)?true:v.includes(null)?null:false;return v.includes(false)?false:v.includes(null)?null:true;}
  baseline(){for(const m of this.macros)this.memory.set(m.id,{last:this.result(m),fired:0});}
  arm(value){this.stop();this.armed=!!value;this.baseline();this.log('system',value?'Automation armed · current state baselined':'Automation disarmed · pending actions cancelled');this.emit('change');}
  stop(){this.generation++;for(const t of this.running.values())t.abort.abort();this.running.clear();this.emit('change');}
  changed(){if(this.queueing)return;this.queueing=true;queueMicrotask(()=>{this.queueing=false;this.evaluate();});}
  evaluate(){for(const m of this.macros){if(m.trigger!=='conditions'||!m.enabled)continue;const current=this.result(m),mem=this.memory.get(m.id)||{last:null,fired:0};const crossing=current===true&&mem.last===false;mem.last=current;this.memory.set(m.id,mem);if(this.armed&&crossing&&Date.now()-mem.fired>=m.cooldown&&!this.running.has(m.id)){void this.fire(m.id,'condition').catch(()=>{});}}}
  async fire(id,source='manual'){
    const m=this.macros.find(m=>m.id===id);if(!m)throw Error('Macro not found');
    if(!m.enabled)throw Error('Macro is disabled');if(!this.armed)throw Error('Arm automation before firing a macro');
    if(this.running.has(id))throw Error('Macro is already running');
    const memory=this.memory.get(id)||{last:null,fired:0};if(Date.now()-memory.fired<m.cooldown)throw Error('Macro minimum interval has not elapsed');memory.fired=Date.now();this.memory.set(id,memory);
    const gen=this.generation,abort=new AbortController();this.running.set(id,{abort});this.log('fire',`${m.name} · ${source}`);this.emit('change');
    try{for(let i=0;i<m.actions.length;i++){if(gen!==this.generation||abort.signal.aborted)throw Error('Cancelled');const action=structuredClone(m.actions[i]);if(action.type==='wait'){await sleep(action.duration);}else{await this.execute(action,{signal:abort.signal,macro:id});}if(gen!==this.generation||abort.signal.aborted)throw Error('Cancelled');this.log('step',`${m.name} · ${i+1}/${m.actions.length} · ${ACTIONS[action.type].label}`);}this.log('done',`${m.name} completed`);}
    catch(e){this.log('error',`${m.name} · ${e.message}`);throw e;}
    finally{if(gen===this.generation)this.running.delete(id);this.emit('change');}
  }
  external(address,source){if(!this.armed)return;for(const m of this.macros){if(m.enabled&&m.trigger==='external'&&m.address===address&&!this.running.has(m.id))void this.fire(m.id,source).catch(()=>{});}}
}
