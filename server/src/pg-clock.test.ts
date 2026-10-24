import {expect,it} from "vitest";
import {io,type Socket} from "socket.io-client";
import type {ClientToServerEvents,ServerToClientEvents} from "@planetfall/shared";
import {createPlanetfallServer} from "./app.js";

it("answers clock probes before room creation without changing room membership",async()=>{
 const server=await createPlanetfallServer({port:0,host:"127.0.0.1",nodeEnv:"test",clientOrigins:["http://test.local"]});
 const {url}=await server.listen();const socket:Socket<ServerToClientEvents,ClientToServerEvents>=io(url,{transports:["websocket"],extraHeaders:{Origin:"http://test.local"},forceNew:true,reconnection:false});
 try{
  await new Promise<void>((resolve,reject)=>{socket.once("connect",resolve);socket.once("connect_error",reject);});
  const before=Date.now(),time=await new Promise<number>(resolve=>socket.emit("pg:clock",resolve));
  expect(time).toBeGreaterThanOrEqual(before);expect(time).toBeLessThanOrEqual(Date.now());expect(server.manager.rooms.size).toBe(0);
  const data=server.io.sockets.sockets.get(socket.id!)!.data;expect(data.roomCode).toBeUndefined();expect(data.playerId).toBeUndefined();
  // Malformed callers without an acknowledgment must not crash the server.
  socket.emit("pg:clock",undefined as never);
  expect(await new Promise<number>(resolve=>socket.emit("pg:clock",resolve))).toBeGreaterThanOrEqual(time);
 }finally{socket.disconnect();await server.close();}
});
