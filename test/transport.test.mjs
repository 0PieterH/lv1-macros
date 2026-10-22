import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { LV1Transport,frame } from '../lib/transport.mjs';
import { decodePacket } from '../lib/osc.ts';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const until=async pred=>{for(let i=0;i<100;i++){if(pred())return;await delay(20);}throw Error('Timed out');};
test('loopback LV1 handshake, frame reassembly, pong and reconnect cancellation',async()=>{
 const sockets=new Set(),received=[];let connections=0;
 const server=net.createServer(socket=>{connections++;sockets.add(socket);socket.on('close',()=>sockets.delete(socket));let buf=Buffer.alloc(0);socket.on('data',chunk=>{buf=Buffer.concat([buf,chunk]);while(buf.length>=12){const size=buf.readUInt32BE(0);if(buf.length<size+12)return;const m=decodePacket(buf.subarray(12,size+12));buf=buf.subarray(size+12);received.push(m);if(m.address==='/device_name'){const ack=frame('/handshake',[{type:'i',value:1}]);socket.write(ack.subarray(0,6));setTimeout(()=>{if(!socket.destroyed)socket.write(Buffer.concat([ack.subarray(6),frame('/ping',[{type:'i',value:7}])]));},10);}}});});
 const client=new LV1Transport();client.on('notice',()=>{});
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  client.connect('127.0.0.1',server.address().port);await until(()=>client.registered&&received.some(m=>m.address==='/pong'));
  client.send('/Set/Track/Out/Mute',[{type:'i',value:0},{type:'i',value:0},{type:'T'}]);await until(()=>received.some(m=>m.address==='/Set/Track/Out/Mute'));
  for(const socket of sockets)socket.destroy();await until(()=>client.retry);client.disconnect();const before=connections;await delay(3200);assert.equal(connections,before);
 }finally{client.disconnect();for(const socket of sockets)socket.destroy();await new Promise(r=>server.close(r));}
});
