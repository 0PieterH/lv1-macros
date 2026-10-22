export function decodeMIDI(data){
 const [status,number,value]=data;if(!Number.isInteger(status)||status<128||status>=240)return null;
 const kind=status>>4,type=kind===12?'pc':kind===11?'cc':kind===9&&value>0?'note':null;
 if(type!=='pc'&&(!Number.isInteger(value)||value<0||value>127))return null;
 if(!type||!Number.isInteger(number)||number<0||number>127)return null;
 return {type,channel:(status&15)+1,number,value:type==='pc'?null:value};
}
export function validateMappings(rows){
 if(!Array.isArray(rows)||rows.length>256)throw Error('Expected at most 256 MIDI mappings');
 const ids=new Set();for(const r of rows){if(typeof r.id!=='string'||!r.id||ids.has(r.id)||typeof r.device!=='string'||r.device.length>512||typeof r.macro!=='string'||!r.macro||typeof r.enabled!=='boolean'||!['pc','note','cc'].includes(r.type)||!Number.isInteger(r.channel)||r.channel<0||r.channel>16||!Number.isInteger(r.number)||r.number<0||r.number>127||!(r.value===null||Number.isInteger(r.value)&&r.value>=0&&r.value<=127))throw Error('Invalid MIDI mapping');ids.add(r.id);}return rows;
}
export function matchesMIDI(row,event){return row.enabled&&(row.device==='*'||row.device===event.device)&&(!row.channel||row.channel===event.channel)&&row.type===event.type&&row.number===event.number&&(row.value===null||row.value===event.value);}
