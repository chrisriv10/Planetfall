import { expect,it,vi } from "vitest";
import type { Server,Socket } from "socket.io";
import { seededRandom,type BrInput,type BrSnapshot,type ClientToServerEvents,type ServerToClientEvents } from "@planetfall/shared";
import { BattleRoyaleRoom } from "./br-room.js";

for (const [latency,jitter,inputLoss] of [[20,2,0],[60,20,0],[120,40,.03],[200,60,.06]] as const) {
  it(`preserves BR inventory/action authority at ${latency}ms with ${jitter}ms jitter`,()=>{
    const start=10_000;let clock=start,lastInbound=0,lastOutbound=0;
    const date=vi.spyOn(Date,"now").mockImplementation(()=>clock);
    const random=seededRandom(3191+latency);
    const inbound:Array<{at:number;run:()=>void}>=[],outbound:Array<{at:number;snapshot:BrSnapshot}>=[];
    const delivered:BrSnapshot[]=[];
    // Reliable actions retain Socket.IO order. Only the latest-input stream
    // drops samples; application retries below are intentionally duplicated.
    const send=(at:number,run:()=>void,input=false)=>{
      if(input&&random()<inputLoss)return;
      lastInbound=Math.max(lastInbound+.01,at+latency+(random()*2-1)*jitter);
      inbound.push({at:lastInbound,run});
    };
    const io={to:(destination:string)=>({emit:(event:string,payload:BrSnapshot)=>{
      if(event!=="br:match:snapshot"||destination!=="net-host")return;
      lastOutbound=Math.max(lastOutbound+.01,clock+latency+(random()*2-1)*jitter);
      outbound.push({at:lastOutbound,snapshot:payload});
    }})} as unknown as Server<ClientToServerEvents,ServerToClientEvents>;
    const socket=(id:string)=>({id,data:{},join:()=>undefined}) as unknown as Socket<ClientToServerEvents,ServerToClientEvents>;
    const room=new BattleRoyaleRoom(`NET-${latency}`,io,48151);
    try {
      const a=room.join(socket("net-host"),"Net A"),b=room.join(socket("net-guest"),"Net B");
      if(!a.ok||!b.ok)throw new Error("room join failed");
      room.configure(a.playerId,{targetPlayers:10,fillBots:false});room.setReady(a.playerId,true);room.setReady(b.playerId,true);
      expect(room.start(a.playerId,start)).toBe(true);room.phase="combat";
      const player=room.players.get(a.playerId)!,target=room.players.get(b.playerId)!;
      player.deployment=target.deployment="grounded";player.position={x:100,y:0,z:12};target.position={x:100,y:0,z:0};target.shield=100;
      player.inventory[0]={instanceId:"net-rifle",itemId:"pulse-rifle",rarity:"common",count:1,magazine:0};
      player.inventory[1]={instanceId:"net-heal",itemId:"med-patch",rarity:"common",count:2,magazine:0};player.hp=40;player.ammo.light=0;
      room.loot.set("net-ammo",{id:"net-ammo",ammoType:"light",rarity:"common",count:60,position:{...player.position}});
      let pickupSuccess=0,fireSuccess=0,reloadSuccess=0,useSuccess=0;
      const commands:Array<{at:number;run:()=>void}>= [
        {at:200,run:()=>{pickupSuccess+=Number(room.pickup(player.id,"net-ammo"));}},
        {at:201,run:()=>{pickupSuccess+=Number(room.pickup(player.id,"net-ammo"));}},
        {at:500,run:()=>{reloadSuccess+=Number(room.reload(player.id,clock));}},
        {at:501,run:()=>{reloadSuccess+=Number(room.reload(player.id,clock));}},
        {at:2500,run:()=>room.selectSlot(player.id,1)},
        {at:2600,run:()=>{useSuccess+=Number(room.useItem(player.id,clock));}},
        {at:2601,run:()=>{useSuccess+=Number(room.useItem(player.id,clock));}},
        {at:5100,run:()=>room.selectSlot(player.id,0)},
        {at:5500,run:()=>{fireSuccess+=Number(room.fire(player.id,{x:100,y:.72,z:11.52},{x:0,y:0,z:-1},clock,clock-latency));}},
        {at:5501,run:()=>{fireSuccess+=Number(room.fire(player.id,{x:100,y:.72,z:11.52},{x:0,y:0,z:-1},clock,clock-latency));}}
      ];
      let command=0,sequence=0;
      for(let tick=0;tick<240;tick++) {
        clock=start+tick*1000/30;
        while(command<commands.length&&start+commands[command].at<=clock){const action=commands[command++];send(start+action.at,action.run);}
        if(tick%2===0){const input:BrInput={sequence:++sequence,dt:1/30,moveX:0,moveY:0,yaw:0,pitch:0,jump:false,sprint:false,crouch:false,fire:false,aim:false,reload:false};send(clock,()=>room.setInput(player.id,input),true);}
        while(inbound[0]?.at<=clock)inbound.shift()!.run();
        room.update(1/30,clock);
        while(outbound[0]?.at<=clock)delivered.push(outbound.shift()!.snapshot);
        expect([player.position.x,player.position.y,player.position.z,player.hp,player.shield].every(Number.isFinite)).toBe(true);
      }
      expect(pickupSuccess).toBe(1);expect(reloadSuccess).toBe(1);expect(useSuccess).toBe(1);expect(fireSuccess).toBe(1);
      expect(player.ammo.light+player.inventory[0]!.magazine).toBe(59);
      expect(player.inventory[1]?.count).toBe(1);expect(player.hp).toBe(65);expect(target.shield).toBeLessThan(100);expect(target.hp).toBe(100);
      expect(room.loot.has("net-ammo")).toBe(false);
      expect(delivered.length).toBeGreaterThan(50);
      expect(delivered.at(-1)?.actions).toEqual({reloadEndsAt:0,useEndsAt:0,reviveTargetId:null,reviveStartedAt:0});
      expect(delivered.at(-1)?.localPlayer.inventory).toEqual(player.inventory);
      const acceptedSequence=player.lastInputSequence;
      room.setInput(player.id,{...player.input!,sequence:1,moveX:1});expect(player.lastInputSequence).toBe(acceptedSequence);
      room.disconnect(player.id);clock+=500;
      const resumed=room.join(socket("net-return"),"Net A",a.sessionToken);
      expect(resumed.ok).toBe(true);if(resumed.ok){expect(resumed.playerId).toBe(player.id);expect(resumed.room.players.find(p=>p.id===player.id)?.inventory).toEqual(player.inventory);}
    } finally {room.dispose();date.mockRestore();}
  });
}
