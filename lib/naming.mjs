export function namingPlan(action){
 const [group,first]=String(action.track||'').split('.').map(Number),last=action.through||first+1;
 if(!Number.isInteger(group)||!Number.isInteger(first)||!Number.isInteger(last)||first<0||last<=first||last-first>256)throw Error('Select a valid channel range');
 if(!Number.isInteger(action.start)||action.start<0||action.start>999999||!Number.isInteger(action.increment)||action.increment<1||action.increment>9999||!Number.isInteger(action.padding)||action.padding<1||action.padding>6)throw Error('Use whole numbers for start, increment and padding');
 if(typeof action.prefix!=='string'||typeof action.suffix!=='string')throw Error('Enter a prefix and suffix');
 return Array.from({length:last-first},(_,offset)=>{const number=action.start+offset*action.increment;if(number>999999)throw Error('Sequence exceeds 999999');const name=(action.prefix+String(number).padStart(action.padding,'0')+action.suffix).trim();if(!name||name.length>100)throw Error('Generated names must contain 1–100 characters');return {track:`${group}.${first+offset}`,channel:first+offset+1,name};});
}
