import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents,GuestProfile } from "@planetfall/shared";
import {pgClock} from "./modes/planet-gun/pg-clock";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
let guestProfile:GuestProfile|null=null;
export const getGuestProfile=():GuestProfile|null=>guestProfile;

export const GUEST_TOKEN_KEY="planetfall:profile-token";
export const clearNetworkProfile=()=>{guestProfile=null;};

export function createGameSocket(accountAuth?:()=>Promise<{profile?:true;profileToken?:string;accountTicket?:string}>): GameSocket {
  const serverUrl = import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? "http://localhost:3000" : window.location.origin);
  const socket:GameSocket=io(serverUrl, {
    auth:callback=>{
      if(!accountAuth){callback({profile:true,profileToken:localStorage.getItem(GUEST_TOKEN_KEY)??undefined});return;}
      const transport=socket.io.engine;
      const send=(data:object)=>{if(socket.active&&socket.io.engine===transport)callback(data);};
      void accountAuth().then(send,()=>send({accountTicket:"unavailable"}));
    },
    autoConnect: !accountAuth,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.35,
    transports: ["websocket", "polling"]
  });
  // Register immediately: connection may complete while the renderer imports.
  socket.on("profile:ready",({token,profile})=>{if(token)localStorage.setItem(GUEST_TOKEN_KEY,token);guestProfile=profile;});
  socket.on("profile:state",profile=>{guestProfile=profile;});
  pgClock(socket);
  return socket;
}
