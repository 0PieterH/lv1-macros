import net from 'node:net';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { encodeMessage,decodePacket } from './osc.ts';
const HEADER=Buffer.from([0,0,0,2,0,0,0,0]);
export function frame(address,args=[]){const payload=encodeMessage(address,args),head=Buffer.alloc(4);head.writeUInt32BE(payload.length);return Buffer.concat([head,HEADER,payload]);}
export class LV1Transport extends EventEmitter{
  constructor(){super();this.socket=null;this.retry=null;this.ack=null;this.watch=null;this.epoch=0;this.registered=false;this.lastReceive=0;}
  connect(host,port){this.disconnect();this.host=host;this.port=port;this.active=true;this.open(this.epoch);}
  open(epoch){
    if(!this.active||epoch!==this.epoch)return;
    this.emit('status','connecting');const socket=new net.Socket();this.socket=socket;let buf=Buffer.alloc(0);
    socket.setTimeout(5000);socket.on('timeout',()=>socket.destroy(Error('TCP connection timed out')));
    socket.on('connect',()=>{if(epoch!==this.epoch)return;socket.setTimeout(0);this.lastReceive=Date.now();
      socket.write(Buffer.concat([frame('/handshake',[{type:'i',value:1},{type:'i',value:-1},{type:'i',value:1}]),frame('/device_name',[{type:'s',value:'LV1 Macro Studio'},{type:'s',value:randomUUID().toUpperCase()}])]));
      this.ack=setTimeout(()=>socket.destroy(Error('LV1 handshake not acknowledged')),3000);
      this.watch=setInterval(()=>{if(Date.now()-this.lastReceive>10000)socket.destroy(Error('No LV1 traffic for 10 seconds'));},2000);
    });
    socket.on('data',chunk=>{if(epoch!==this.epoch)return;this.lastReceive=Date.now();buf=Buffer.concat([buf,chunk]);if(buf.length>17*1024*1024){socket.destroy(Error('Receive buffer limit'));return;}
      try{while(buf.length>=12){const size=buf.readUInt32BE(0);if(size<4||size>16*1024*1024)throw Error('Invalid LV1 frame length');if(buf.length<12+size)break;const packet=buf.subarray(12,12+size);buf=buf.subarray(12+size);const message=decodePacket(packet);
        if(message.address==='/ping')socket.write(frame('/pong',message.args));
        if(message.address==='/handshake'&&message.args[0]?.value===1){clearTimeout(this.ack);this.registered=true;this.emit('status','connected');this.send('/Get/Aux/Tracks');this.send('/Get/Layers',[{type:'i',value:0},{type:'i',value:0}]);}
        this.emit('message',message);
      }}catch(e){socket.destroy(e);}
    });
    socket.on('error',e=>{if(epoch===this.epoch)this.emit('notice',e.message);});
    socket.on('close',()=>{if(epoch!==this.epoch)return;clearTimeout(this.ack);clearInterval(this.watch);this.socket=null;this.registered=false;this.emit('status','disconnected');if(this.active)this.retry=setTimeout(()=>this.open(epoch),3000);});
    socket.connect(this.port,this.host);
  }
  send(address,args=[]){if(!this.registered||!this.socket)throw Error('LV1 is not registered');if(this.socket.writableLength>1024*1024)throw Error('LV1 transmit queue is full');this.socket.write(frame(address,args));}
  updatePort(port){if(port!==this.port&&this.active)this.connect(this.host,port);}
  disconnect(){this.active=false;this.epoch++;clearTimeout(this.retry);clearTimeout(this.ack);clearInterval(this.watch);this.registered=false;this.socket?.destroy();this.socket=null;}
}
