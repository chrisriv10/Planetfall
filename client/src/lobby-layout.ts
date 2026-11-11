import type {LobbyAvatarMember} from "./lobby-avatar-stage";

/** Reparent the existing controls once. Room membership/actions remain owned by main.ts. */
export function mountLobbyLayout(screen:HTMLElement,familyName:string,configurationSelectors:readonly string[],leaveId:string){
 const document=screen.ownerDocument,panel=screen.querySelector<HTMLElement>(".mode-panel");
 if(!panel)throw new Error(`Missing lobby panel: ${screen.id}`);
 const actions=panel.querySelector<HTMLElement>(".lobby-actions,.pg-actions,.pr-actions"),leave=document.getElementById(leaveId);
 if(!actions||!leave)throw new Error(`Missing lobby actions: ${screen.id}`);
 const main=document.createElement("div");main.className="lobby-main-area";
 const copy=document.createElement("div");copy.className="lobby-pilot-copy";
 const kicker=document.createElement("small");kicker.className="lobby-pilot-kicker";kicker.textContent=`${familyName.toUpperCase()} · READY ROOM`;
 const name=document.createElement("h2");name.className="lobby-pilot-name";
 const status=document.createElement("p");status.className="lobby-pilot-ready";status.setAttribute("role","status");
 copy.append(kicker,name,status);
 const avatar=document.createElement("div");avatar.className="lobby-avatar-window";avatar.setAttribute("aria-hidden","true");
 main.append(copy,avatar);
 const configuration=document.createElement("details");configuration.className="lobby-configuration";
 const summary=document.createElement("summary");summary.textContent="MATCH SETTINGS";configuration.append(summary);
 const controls=configurationSelectors.flatMap(selector=>[...panel.querySelectorAll<HTMLElement>(selector)]);
 if(controls.length){controls[0].before(configuration);configuration.append(...controls);}
 const footer=document.createElement("footer");footer.className="lobby-footer";footer.setAttribute("aria-label",`${familyName} lobby actions`);footer.append(leave,actions);
 // Old single-card wrappers otherwise impose their obsolete grid/max-width.
 const wrapper=panel.parentElement;screen.append(main,panel,footer);if(wrapper&&wrapper!==screen&&!wrapper.children.length)wrapper.remove();
 panel.classList.add("lobby-side-card");screen.classList.add("ready-room");
 return {screen,panel,avatar,configuration,
  setMember(member:LobbyAvatarMember|undefined,hostId:string){
   configuration.hidden=controls.length===0||controls.every(control=>control.hidden);
   name.textContent=member?.name??"Your pilot";status.textContent=member?`${member.ready?"READY TO LAUNCH":"STANDING BY"}${member.id===hostId?" · HOST":""}`:"Joining crew…";
   status.dataset.ready=String(member?.ready??false);
  }
 };
}
