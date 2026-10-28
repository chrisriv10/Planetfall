import {createLobbyRosterRow} from "../../lobby-roster-art";
import { PR_ROUNDS, type PrRoomView, type PrSnapshot } from "@planetfall/shared";
import "./pr-ui.css";
import {createPrEventUi} from "./art/pr-event-ui";

export interface PrUi {
  lobby:HTMLElement;hud:HTMLElement;results:HTMLElement;
  setVisible(screen:"lobby"|"hud"|"results"|null):void;
  render(room:PrRoomView,localId:string):void;
  renderSnapshot(snapshot:PrSnapshot,localId:string):void;
}

/** DOM presentation only. The owning game lifecycle controls screens and all actions. */
export function createPrUi():PrUi {
  const ui=document.querySelector<HTMLElement>("#ui");
  if(!ui)throw new Error("PlanetRun requires #ui");
  const section=(id:string,html:string)=>{
    const element=document.createElement("section");element.id=id;element.className="screen pr-screen";
    element.innerHTML=html;ui.append(element);return element;
  };
  const lobby=section("pr-lobby-screen",`
    <div class="pr-lobby-layout">
      <div class="pr-panel pr-lobby-card glass mode-panel">
        <div class="lobby-heading"><div><p class="pr-eyebrow panel-kicker">PLANETFALL · ORBITAL COMPETITION</p><h1>Planet<span>Run</span></h1></div><div class="room-code mode-room-code"><small>ROOM CODE</small><span id="pr-code">—</span></div></div>
        <p class="pr-lead">One astronaut. A station full of surprises.</p>
        <div class="pr-room-strip"><span id="pr-player-count"></span></div>
        <nav class="pr-nav lobby-hub-nav" aria-label="Session hub"><button id="pr-shop" class="hub-tab">SHOP</button><button id="pr-pass" class="hub-tab">PLANET PASS</button><button id="pr-settings" class="hub-tab">SETTINGS</button></nav>
        <fieldset id="pr-host-controls" class="pr-config mode-fields">
          <legend>SET THE COURSE</legend>
          <label>Players<select id="pr-target"><option value="10">10 players</option><option value="20">20 players</option><option value="30">30 players</option></select></label>
          <label>Bot difficulty<select id="pr-difficulty"><option value="easy">Easy</option><option value="normal">Normal</option><option value="hard">Hard</option></select></label>
          <label class="pr-checkbox"><input id="pr-fill" type="checkbox"> Fill empty places with bots</label>
        </fieldset>
        <div id="pr-roster" class="pr-roster" aria-label="Players"></div>
        <div class="pr-actions"><button id="pr-ready" class="pr-primary button button-secondary">READY UP</button><button id="pr-start" class="pr-primary button button-primary">START RUN</button></div>
        <button id="pr-leave-lobby" class="pr-back button button-quiet">BACK TO MAIN MENU</button><p id="pr-lobby-note" class="pr-note"></p>
      </div>
    </div>`);
  lobby.classList.add("mode-lobby");
  const hud=section("pr-hud",`
    <div class="pr-hud-top">
      <div class="pr-hud-objective"><span id="pr-round-number" class="pr-eyebrow"></span><h2 id="pr-round-name"></h2><p id="pr-objective"></p></div>
      <div class="pr-hud-stats"><span id="pr-qualification"></span><strong id="pr-timer" aria-label="Time remaining"></strong><button id="pr-leave-game" aria-label="Leave PlanetRun">LEAVE RUN</button></div>
    </div>
    <div id="pr-round-announcement" class="pr-announcement" role="status"><span id="pr-announcement-label"></span><strong id="pr-announcement-main"></strong><p id="pr-announcement-detail"></p><div id="pr-round-roster" hidden><h3>ORBITAL ROSTER</h3><p id="pr-round-roster-summary"></p><ul id="pr-round-survivors"></ul></div></div>
    <div class="pr-hud-bottom"><strong id="pr-player-status"></strong><span><kbd>SPACE</kbd> JUMP <kbd>SHIFT</kbd> DIVE <kbd>MOUSE / DRAG</kbd> LOOK</span></div>`);
  const results=section("pr-results-screen",`
    <div class="pr-panel pr-results-card"><p class="pr-eyebrow">PLANETRUN · FINAL RESULTS</p><div class="pr-trophy" aria-hidden="true">✦</div><h1 id="pr-winner-title">Run complete</h1><p id="pr-winner-detail" class="pr-lead"></p><ol id="pr-final-roster" class="pr-final-roster"></ol><p id="pr-return-note" class="pr-note"></p><div class="pr-actions"><button id="pr-return" class="pr-primary">BACK TO LOBBY</button><button id="pr-leave-results" class="pr-back">MAIN MENU</button></div></div>`);
  const get=<T extends HTMLElement=HTMLElement>(id:string)=>ui.querySelector<T>(`#${id}`)!;
  const text=(id:string,value:string)=>{const el=get(id);if(el.textContent!==value)el.textContent=value;};
  let rosterKey="",resultKey="",roundRosterKey="",host=false;
  const events=createPrEventUi({lobby,hud,results});
  return {lobby,hud,results,setVisible:events.setVisible,
    render(room,localId){
      host=room.hostId===localId;
      text("pr-code",room.code);text("pr-player-count",`${room.players.length} / ${room.configuration.targetPlayers} ASTRONAUTS`);
      get("pr-host-controls").hidden=!host;get("pr-start").hidden=!host;
      get<HTMLSelectElement>("pr-target").value=String(room.configuration.targetPlayers);
      get<HTMLSelectElement>("pr-difficulty").value=room.configuration.botDifficulty;
      get<HTMLInputElement>("pr-fill").checked=room.configuration.fillBots;
      const ready=room.players.find(p=>p.id===localId)?.ready??false;
      text("pr-ready",ready?"READY ✓ · CANCEL":"READY UP");get("pr-ready").setAttribute("aria-pressed",String(ready));
      text("pr-lobby-note",host?"Everyone here? Ready up, then launch your run.":"Ready up. Your host will launch the run.");
      get("pr-return").hidden=!host;text("pr-return-note",host?"Bring the crew back for another run.":"Your host can bring everyone back to the lobby.");
      const key=JSON.stringify(room.players.map(p=>[p.id,p.name,p.ready,p.connected,p.isBot,p.id===room.hostId,p.id===localId]));
      if(key!==rosterKey){
        rosterKey=key;const rows=room.players.map(p=>{
          const row=createLobbyRosterRow(document,{...p,localId,hostId:room.hostId});row.classList.add("pr-player-row");return row;
        });get("pr-roster").replaceChildren(...rows);
      }
    },
    renderSnapshot(snapshot,localId){
      const round=PR_ROUNDS.find(r=>r.id===snapshot.roundId),me=snapshot.players.find(p=>p.id===localId);
      const seconds=Math.max(0,Math.ceil((snapshot.phaseEndsAt-snapshot.serverTime)/1000));
      const active=snapshot.players.filter(p=>p.status==="active").length;
      const qualified=snapshot.players.filter(p=>p.status==="qualified").length;
      text("pr-round-number",`PLANETRUN · ROUND ${snapshot.roundIndex+1}`);
      text("pr-round-name",round?.name??"Get ready");text("pr-objective",round?.objective??"Your next course is preparing.");
      text("pr-qualification",round?.category==="race"?`${qualified} / ${snapshot.qualificationTarget} QUALIFIED`:`${active} REMAINING`);
      text("pr-timer",`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`);
      text("pr-player-status",me?.status==="qualified"?"QUALIFIED ✓":me?.status==="eliminated"?"ELIMINATED · WATCH THE RUN":"STAY IN THE RUN");
      const announce=snapshot.phase==="intro"||snapshot.phase==="countdown"||snapshot.phase==="round-results";
      get("pr-round-announcement").hidden=!announce;
      text("pr-announcement-label",snapshot.phase==="round-results"?"ROUND COMPLETE":round?.category.toUpperCase()??"NEXT ROUND");
      text("pr-announcement-main",snapshot.phase==="countdown"?String(Math.max(1,seconds)):snapshot.phase==="round-results"?(me?.status==="qualified"?"YOU MADE IT!":me?.status==="eliminated"?"NICE RUN":"ROUND COMPLETE"):round?.name??"Get ready");
      text("pr-announcement-detail",snapshot.phase==="round-results"?"The next stage is on its way.":round?.objective??"");
      get("pr-round-roster").hidden=snapshot.phase!=="round-results";
      if(snapshot.phase==="round-results") {
        const remaining=snapshot.players.filter(p=>p.status==="qualified");
        const eliminated=snapshot.players.filter(p=>p.status==="eliminated").length;
        text("pr-round-roster-summary",`${remaining.length} advancing · ${eliminated} eliminated`);
        const key=JSON.stringify([snapshot.roundIndex,localId,remaining.map(p=>[p.id,p.name])]);
        if(key!==roundRosterKey){roundRosterKey=key;get("pr-round-survivors").replaceChildren(...remaining.map(p=>{
          const item=document.createElement("li");item.textContent=p.name+(p.id===localId?" · YOU":"");if(p.id===localId)item.className="pr-is-you";return item;
        }));}
      }
      if(snapshot.phase==="results"){
        const winner=snapshot.players.find(p=>p.id===snapshot.winnerId);
        text("pr-winner-title",winner?.id===localId?"YOUR ORBIT. YOUR WIN.":winner?`${winner.name} wins!`:"Run complete");
        text("pr-winner-detail",winner?"Last astronaut standing. See you on the next course.":"Thanks for running with the crew.");
        const key=JSON.stringify(snapshot.players.map(p=>[p.id,p.name,p.place,p.qualifiedRounds]));
        if(key!==resultKey){resultKey=key;
          const players=[...snapshot.players].sort((a,b)=>(a.id===snapshot.winnerId?-1:b.id===snapshot.winnerId?1:0)||b.qualifiedRounds-a.qualifiedRounds||(a.place||999)-(b.place||999));
          get("pr-final-roster").replaceChildren(...players.map(p=>{
            const row=document.createElement("li"),name=document.createElement("strong"),detail=document.createElement("span");
            name.textContent=p.name+(p.id===localId?" · YOU":"");detail.textContent=`${p.qualifiedRounds} rounds qualified`;row.append(name,detail);return row;
          }));
        }
      }
      events.update(snapshot,localId);
    },
  };
}
