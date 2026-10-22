const n = (key, label, value, min, max) => ({ key, label, type: 'number', value, min, max });
const s = (key, label, value = '') => ({ key, label, type: 'text', value });
const pick = (key, label, value, choices) => ({ key, label, type: 'select', value, choices });
const state = () => pick('state', 'State', 'on', ['on', 'off', 'toggle']);
const db = () => n('value', 'Level · dB', -10, -144, 10);
export const ACTIONS = {
  mute: { label: 'Channel mute', target: true, fields: [state()] },
  solo: { label: 'Channel solo', target: true, fields: [state()] },
  clearSolo: { label: 'Clear all solos', fields: [] },
  gain: { label: 'Output fader', target: true, fields: [db()] },
  fade: { label: 'Fade output fader', target: true, fields: [db(), n('duration', 'Duration · ms', 1000, 0, 60000)] },
  pan: { label: 'Channel pan', target: true, fields: [n('value', 'Pan · −1 to +1', 0, -1, 1)] },
  width: { label: 'Stereo width', target: true, fields: [n('value', 'Width · 0 to 1', 1, 0, 1)] },
  sendOn: { label: 'Send on / off', target: true, aux: true, fields: [state()] },
  sendGain: { label: 'Send fader', target: true, aux: true, fields: [db()] },
  sendFade: { label: 'Fade send fader', target: true, aux: true, fields: [db(), n('duration', 'Duration · ms', 1000, 0, 60000)] },
  sendPan: { label: 'Send pan', target: true, aux: true, fields: [n('value', 'Pan · −1 to +1', 0, -1, 1)] },
  talkback: { label: 'Talkback destination to aux', aux: true, fields: [state()] },
  talkbackMaster: { label: 'Talkback On / Off', fields: [n('index', 'Talkback User Key · 1–16', 1, 1, 16), pick('state', 'Talkback', 'on', ['on', 'off'])] },
  talkbackHold: { legacy: true, label: 'Talkback: hold TALK while macro runs', fields: [n('index', 'Talkback User Key · 1–16', 1, 1, 16)] },
  muteGroup: { label: 'Mute group', fields: [n('index', 'Mute group · 1–8', 1, 1, 8), state()] },
  userKey: { label: 'LV1 User Key', fields: [n('index', 'Key · 1–16', 1, 1, 16), pick('state', 'Mode', 'momentary', ['momentary', 'on', 'off'])] },
  flip: { label: 'Flip sends via assigned User Key', fields: [n('index', 'Flip Sends key · 1–16', 1, 1, 16)] },
  spill: { label: 'Spill group / DCA', fields: [n('bank', 'Mixer bank · 0–1', 0, 0, 1), n('index', 'Slot · 0–31', 0, 0, 31), state()] },
  auxFocus: { label: 'Focus aux · MyMon', fields: [n('index', 'Aux · 0 = none', 1, 0, 32)] },
  scene: { label: 'Recall scene', fields: [n('index', 'Scene index · zero-based', 0, 0, 999)] },
  sceneNext: { label: 'Next scene', fields: [] },
  scenePrev: { label: 'Previous scene', fields: [] },
  tap: { label: 'Tap tempo', fields: [] },
  inputGain: { label: 'Preamp input gain', target: true, fields: [n('value', 'Gain · dB', 20, -10, 60)] },
  trim: { label: 'Digital trim', target: true, fields: [n('value', 'Trim · dB', 0, -20, 20)] },
  phantom: { label: 'Phantom power', target: true, fields: [pick('state', 'State', 'off', ['on', 'off'])] },
  polarity: { label: 'Polarity invert', target: true, fields: [pick('state', 'State', 'off', ['on', 'off'])] },
  plugin: { label: 'Processing section', target: true, fields: [pick('section', 'Section', 'eq', ['eq', 'filter', 'comp', 'deesser', 'dyn', 'gate', 'leveler', 'limiter']), pick('state', 'State', 'on', ['on', 'off'])] },
  eq: { label: 'EQ band parameter', target: true, fields: [n('band', 'Band · 1–6', 1, 1, 6), pick('param', 'Parameter', 'gain', ['gain', 'freq', 'q']), n('value', 'Value · dB / Hz / Q', 0, -100, 24000)] },
  renameSequence: { label: 'Rename channels · numbered sequence', target: true, fields: [s('prefix', 'Prefix · include any spaces', 'Vocal '), n('start', 'Starting number', 1, 0, 999999), n('increment', 'Increment', 1, 1, 9999), n('padding', 'Minimum number digits', 2, 1, 6), s('suffix', 'Suffix · optional', '')] },
  rename: { label: 'Rename channel', target: true, fields: [s('text', 'Channel name', 'Vocal')] },
  refresh: { label: 'Refresh layers and auxes', fields: [] },
  discover: { label: 'Scan for LV1s', fields: [] },
  raw: { label: 'Raw LV1 OSC', fields: [s('address', 'OSC address', '/Set/Track/Out/Mute'), s('args', 'Typed arguments as JSON', '[{"type":"i","value":0},{"type":"i","value":0},{"type":"T"}]')] },
  osc: { label: 'Send external OSC · UDP', fields: [s('host', 'Destination IPv4', '127.0.0.1'), n('port', 'UDP port', 9000, 1, 65535), s('address', 'OSC address', '/cue'), s('args', 'Typed arguments as JSON', '[]')] },
  wait: { label: 'Wait', fields: [n('duration', 'Delay · ms', 500, 0, 60000)] },
};
export const PROPERTIES = [
  ['gain', 'Output fader · dB', 'track'], ['muted', 'Channel muted', 'track'], ['solo', 'Channel solo', 'track'],
  ['pan', 'Channel pan', 'track'], ['width', 'Stereo width', 'track'], ['meter', 'Meter L / mono · dB', 'track'], ['meterR', 'Meter R · dB', 'track'],
  ['sendOn', 'Send enabled', 'send'], ['sendGain', 'Send fader · dB', 'send'],
  ['scene', 'Current scene index', 'global'], ['sceneName', 'Current scene name', 'global'], ['anySolo', 'Any channel soloed', 'global'],
  ['tempo', 'Tempo · BPM', 'global'], ['layer', 'Layer index · zero-based', 'global'], ['mixer', 'Mixer view · 1 or 2', 'global'],
  ['muteGroup', 'Mute group active', 'indexed'], ['talkback', 'Talkback destination enabled', 'indexed'],
  ['flipAux', 'Flipped aux · 0 = none', 'global'], ['spill', 'Spill slot active · mixer 1', 'indexed'],
];
export const GROUPS = [[0,'Input',80],[1,'Group',16],[2,'Aux',32],[3,'LR',1],[4,'Center',1],[5,'Mono',1],[6,'Matrix',8],[7,'Cue',1],[8,'Talkback',1],[12,'DCA',16]];
export function defaultAction(type = 'mute') {
  const def = ACTIONS[type];
  return { type, track: '0.0', aux: 1, ...Object.fromEntries(def.fields.map(f => [f.key,f.value])) };
}
export function seedMacros() {
  return [
    { id:'low-fader', name:'Fader down → mute', color:'#f4b75e', enabled:true, trigger:'conditions', logic:'all', cooldown:300,
      conditions:[{property:'gain',track:'0.0',op:'lte',value:-80,tolerance:0.1}], actions:[{...defaultAction('mute'),state:'on'}] },
    { id:'presenter-live', name:'Presenter live', color:'#8ebaf2', enabled:true, trigger:'conditions', logic:'all', cooldown:500,
      conditions:[{property:'gain',track:'0.0',op:'gt',value:-20}], actions:[{...defaultAction('fade'),track:'0.3',value:-30,duration:1000}] },
    { id:'walk-in', name:'Walk-in music', color:'#b5a0ec', enabled:true, trigger:'manual',logic:'all',cooldown:300,conditions:[],
      actions:[{...defaultAction('mute'),track:'0.0',state:'on'},{...defaultAction('mute'),track:'0.3',state:'off'},{...defaultAction('fade'),track:'0.3',value:-10,duration:1200}] },
  ];
}
