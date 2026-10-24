import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents,GuestProfile } from "@planetfall/shared";
import {pgClock} from "./modes/planet-gun/pg-clock";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
let guestProfile:GuestProfile|null=null;
export const getGuestProfile=():GuestProfile|null=>guestProfile;

export function createGameSocket(): GameSocket {
  const serverUrl = import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? "http://localhost:3000" : window.location.origin);
  const socket:GameSocket=io(serverUrl, {
    auth:callback=>callback({profile:true,profileToken:localStorage.getItem("planetfall:profile-token")??undefined}),
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.35,
    transports: ["websocket", "polling"]
  });
  // Register immediately: connection may complete while the renderer imports.
  socket.on("profile:ready",({token,profile})=>{localStorage.setItem("planetfall:profile-token",token);guestProfile=profile;});
  socket.on("profile:state",profile=>{guestProfile=profile;});
  pgClock(socket);
  return socket;
}
