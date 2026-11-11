import {
  BINDING_ACTION_LABELS, BINDING_CONTEXTS, bindingActions, bindingLabel, bindingTokenLabel, getBindingTokens,
  type BindingAction, type BindingContext, type BindingSettings,
} from "./input-bindings";
import {mouseButtonIcon} from "./mouse-button-icon";
import "./controls-editor.css";

export interface ControlsEditorView {
  context: BindingContext;
  settings: BindingSettings;
  capturing: BindingAction | null;
  error: string;
}
const contexts:Record<BindingContext,string>={
  planetfall:"Planetfall", "battle-royale":"PlanetRoyale", "planet-run":"PlanetRun",
  "planet-run:spectator":"PlanetRun · Spectator", "planet-gun":"PlanetGun",
  "planet-gun:planetstrike":"PlanetGun · PlanetStrike", "planet-gun:planetwatch":"PlanetGun · PlanetWatch",
  "planet-gun:planetsiege":"PlanetGun · PlanetSiege", "planet-gun:planetzombies":"PlanetGun · PlanetZombies",
  "planet-gun:spectator":"PlanetGun · Spectator",
};

export function createControlsEditor(doc:Document) {
  const el=<K extends keyof HTMLElementTagNameMap>(tag:K,cls:string,label="")=>{
    const node=doc.createElement(tag);node.className=cls;node.textContent=label;return node;
  };
  const button=(cls:string,label:string,ignore=false)=>{
    const node=el("button",cls,label);node.type="button";
    if(ignore)node.dataset.bindingIgnore="true";
    return node;
  };
  const root=el("details","controls-editor"),summary=el("summary","controls-heading","Controls");
  summary.dataset.bindingIgnore="true";
  const panel=el("div","controls-panel"),toolbar=el("div","controls-toolbar");
  const label=el("label","controls-mode","Game mode"),select=el("select","controls-context");
  select.dataset.bindingIgnore="true";
  for(const context of BINDING_CONTEXTS){
    const option=el("option","",contexts[context]);option.value=context;select.append(option);
  }
  label.append(select);
  const resetAll=button("controls-reset-all","Reset all bindings",true);
  toolbar.append(label,resetAll);
  const feedback=el("div","controls-feedback"),status=el("span","controls-status"),cancel=button("controls-cancel","Cancel",true);
  status.setAttribute("role","status");status.setAttribute("aria-live","polite");
  feedback.hidden=true;cancel.hidden=true;feedback.append(status,cancel);
  const list=el("div","controls-rows");list.setAttribute("role","group");list.setAttribute("aria-label","Keyboard and mouse bindings");
  panel.append(toolbar,feedback,list);root.append(summary,panel);
  let current:BindingContext|null=null,capturing:BindingAction|null=null,disposed=false;
  const rows=new Map<BindingAction,{change:HTMLButtonElement;reset:HTMLButtonElement;signature:string}>();
  function clearRows(){
    for(const {change,reset} of rows.values()){change.onclick=null;reset.onclick=null;}
    rows.clear();list.replaceChildren();
  }
  function build(context:BindingContext){
    clearRows();list.scrollTop=0;
    for(const action of bindingActions(context)){
      const name=BINDING_ACTION_LABELS[action],row=el("div","controls-row"),caption=el("span","controls-action",name);
      const change=button("controls-binding",""),reset=button("controls-reset","Reset",true);
      change.dataset.action=action;reset.setAttribute("aria-label",`Restore default for ${name}`);
      change.onclick=()=>api.onCapture?.(action);reset.onclick=()=>api.onReset?.(action);
      row.append(caption,change,reset);list.append(row);rows.set(action,{change,reset,signature:""});
    }
  }
  function render(view:ControlsEditorView){
    if(disposed)return;
    if(current!==view.context){current=view.context;select.value=current;build(current);}
    capturing=view.capturing;
    for(const [action,row] of rows){
      const tokens=getBindingTokens(view.settings,view.context,action),listening=capturing===action;
      const signature=`${listening}:${tokens.join("|")}`;
      if(signature===row.signature)continue;
      row.signature=signature;row.change.dataset.capturing=String(listening);
      const binding=bindingLabel(view.settings,view.context,action);
      row.change.setAttribute("aria-label",listening ? `Listening for ${BINDING_ACTION_LABELS[action]}` : `Change ${BINDING_ACTION_LABELS[action]} (${binding})`);
      row.change.replaceChildren();
      if(listening || !tokens.length){row.change.textContent=listening?"Listening…":"Unbound";continue;}
      for(const token of tokens){
        const key=el("kbd","controls-key");
        if(token==="Mouse0" || token==="Mouse2")key.innerHTML=mouseButtonIcon(bindingTokenLabel(token));
        else key.textContent=bindingTokenLabel(token);
        row.change.append(key);
      }
    }
    const instructions=capturing ? `Press a key, click a mouse button, or scroll for ${BINDING_ACTION_LABELS[capturing]}.` : "";
    const message=[view.error,instructions].filter(Boolean).join(" ");
    if(status.textContent!==message)status.textContent=message;
    feedback.hidden=!message;cancel.hidden=!capturing;
  }
  const api={
    root,render,
    onContext:null as ((context:BindingContext)=>void)|null,
    onCapture:null as ((action:BindingAction)=>void)|null,
    onCancel:null as (()=>void)|null,
    onReset:null as ((action:BindingAction)=>void)|null,
    onResetAll:null as (()=>void)|null,
    focus(){if(!disposed)(root.open?select:summary).focus();},
    dispose(){
      if(disposed)return;disposed=true;
      clearRows();select.onchange=null;root.ontoggle=null;cancel.onclick=resetAll.onclick=null;
      api.onContext=api.onCapture=api.onCancel=api.onReset=api.onResetAll=null;
      root.remove();root.replaceChildren();
    },
  };
  select.onchange=()=>{const context=select.value as BindingContext;if(BINDING_CONTEXTS.includes(context))api.onContext?.(context);};
  cancel.onclick=()=>api.onCancel?.();resetAll.onclick=()=>api.onResetAll?.();
  root.ontoggle=()=>{if(!root.open&&capturing)api.onCancel?.();};
  return api;
}
