import type {Server,Socket} from "socket.io";
import type {ClientToServerEvents,ServerToClientEvents} from "@planetfall/shared";

type GameSocket=Socket<ClientToServerEvents,ServerToClientEvents>;
type GameServer=Server<ClientToServerEvents,ServerToClientEvents>;
const MENU_SUBSCRIBERS="presence:home";
const BROADCAST_DELAY_MS=1000;

/** One authoritative service counts profile owners independently of room membership. */
export class PlayerPresence {
  private readonly socketsByProfile=new Map<string,number>();
  private update:ReturnType<typeof setTimeout>|undefined;
  constructor(private readonly io:GameServer){}

  bind(socket:GameSocket,verifiedProfileKey:string):void{
    const existing=this.socketsByProfile.get(verifiedProfileKey)??0;
    this.socketsByProfile.set(verifiedProfileKey,existing+1);
    if(!existing)this.queueBroadcast();
    socket.on("presence:menu",subscribed=>{
      if(subscribed===true){
        void socket.join(MENU_SUBSCRIBERS);
        socket.emit("presence:count",this.socketsByProfile.size);
      }else if(subscribed===false)void socket.leave(MENU_SUBSCRIBERS);
    });
    socket.once("disconnect",()=>{
      const remaining=this.socketsByProfile.get(verifiedProfileKey);
      if(remaining===undefined)return;
      if(remaining===1){
        this.socketsByProfile.delete(verifiedProfileKey);
        this.queueBroadcast();
      }else this.socketsByProfile.set(verifiedProfileKey,remaining-1);
    });
  }
  stop():void{
    clearTimeout(this.update);this.update=undefined;
    this.socketsByProfile.clear();
  }
  private queueBroadcast():void{
    if(this.update)return;
    this.update=setTimeout(()=>{
      this.update=undefined;
      this.io.to(MENU_SUBSCRIBERS).emit("presence:count",this.socketsByProfile.size);
    },BROADCAST_DELAY_MS);
    this.update.unref();
  }
}
