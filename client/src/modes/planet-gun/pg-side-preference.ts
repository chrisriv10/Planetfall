import type {PgRoomView,PgSidePreference} from "@planetfall/shared";

/** Lobby input only: server acknowledgement owns the preferred and assigned sides. */
export function createPgSidePreference(document:Document,change:(side:PgSidePreference)=>Promise<{ok:boolean;error?:string}>,notify:(message:string)=>void){
 const root=document.createElement("section");root.className="pg-side-preference mode-fields";root.hidden=true;
 const label=document.createElement("label");label.textContent="STARTING SIDE";
 const select=document.createElement("select");select.setAttribute("aria-label","Preferred starting side");
 for(const [value,text]of [["auto","Auto · balance teams"],["attack","Attack"],["defend","Defend"]]){const option=document.createElement("option");option.value=value;option.textContent=text;select.append(option);}
 label.append(select);const status=document.createElement("p");status.className="pg-mode-summary";root.append(label,status);
 let room:PgRoomView|null=null,localId="",saving=false;
 function render(next:PgRoomView,id:string){
  room=next;localId=id;root.hidden=next.phase!=="lobby"||next.configuration.mode!=="planetstrike";
  const me=next.players.find(p=>p.id===id);select.value=me?.preferredSide??"auto";select.disabled=saving||root.hidden||!me;
  status.textContent=me?`STARTING ${me.team==="solar"?"ATTACK":"DEFEND"} · Sides switch at halftime.`:"Joining team…";
 }
 select.addEventListener("change",async()=>{
  const side=select.value as PgSidePreference;saving=true;select.disabled=true;
  try{const result=await change(side);if(!result.ok)notify(result.error??"Could not change starting side.");}
  catch{notify("Starting side was not confirmed. Try again.");}
  finally{saving=false;if(room)render(room,localId);}
 });
 return {root,render};
}
