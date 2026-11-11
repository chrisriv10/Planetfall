import {createControlsEditor} from "./controls-editor";
import {bindingSettings,type BindingSettingsStore} from "./binding-settings";
import {BINDING_ACTION_LABELS,bindingTokenLabel,keyboardBindingToken,mouseBindingToken,wheelBindingToken,type BindingAction,type BindingContext,type BindingToken} from "./input-bindings";

/** Settings owns capture before gameplay listeners, and stores only validated
 * contextual bindings. Native browser shortcuts and text input remain native. */
export function createControlsSettingsController(doc:Document,overlay:HTMLElement,store:BindingSettingsStore=bindingSettings){
 const editor=createControlsEditor(doc);let context:BindingContext="planetfall",capturing:BindingAction|null=null,error="",disposed=false,suppressContextMenu=false;
 const render=()=>editor.render({context,settings:store.get(),capturing,error});
 const cancel=()=>{capturing=null;error="";render();};
 const active=()=>!disposed&&!overlay.hidden&&editor.root.open&&capturing!==null;
 const ignored=(target:EventTarget|null)=>!!(target as Element|null)?.closest?.('[data-binding-ignore="true"]');
 function save(token:BindingToken){
  if(!capturing)return;
  const result=store.rebind(context,capturing,[token]);
  if(result.ok){capturing=null;error="";}
  else error=result.reason==="conflict"?`${bindingTokenLabel(token)} is already assigned to ${result.conflicts.map(conflict=>BINDING_ACTION_LABELS[conflict.action]).join(", ")}. Change or clear that action first.`:"This key is reserved for the browser or menu.";
  render();
 }
 const onKey=(event:KeyboardEvent)=>{
  if(!active()||event.repeat||ignored(event.target))return;
  if(event.code==="Escape"){event.preventDefault();event.stopImmediatePropagation();cancel();return;}
  if(event.code==="Delete"||event.code==="Backspace"){
   event.preventDefault();event.stopImmediatePropagation();store.rebind(context,capturing!,null);cancel();return;
  }
  const token=keyboardBindingToken(event);
  if(!token)return;
  event.preventDefault();event.stopImmediatePropagation();save(token);
 };
 const onMouse=(event:MouseEvent)=>{if(!active()||ignored(event.target))return;const token=mouseBindingToken(event.button);if(!token)return;event.preventDefault();event.stopImmediatePropagation();suppressContextMenu=event.button===2;save(token);};
 const onWheel=(event:WheelEvent)=>{if(!active()||ignored(event.target)||event.ctrlKey||event.altKey||event.metaKey)return;const token=wheelBindingToken(event.deltaY);if(!token)return;event.preventDefault();event.stopImmediatePropagation();save(token);};
 const onContextMenu=(event:MouseEvent)=>{if(active()||suppressContextMenu){suppressContextMenu=false;event.preventDefault();event.stopImmediatePropagation();}};
 editor.onContext=next=>{context=next;cancel();};
 editor.onCapture=action=>{capturing=action;error="";doc.exitPointerLock?.();render();};
 editor.onCancel=cancel;
 editor.onReset=action=>{const result=store.rebind(context,action,undefined);capturing=null;error=result.ok?"":"Default binding conflicts with another action. Reset all bindings or clear the conflicting action first.";render();};
 editor.onResetAll=()=>{store.resetAll();cancel();};
 const unsubscribe=store.subscribe(render);
 doc.addEventListener("keydown",onKey,true);doc.addEventListener("mousedown",onMouse,true);doc.addEventListener("wheel",onWheel,{capture:true,passive:false});doc.addEventListener("contextmenu",onContextMenu,true);
 render();
 return {root:editor.root,cancelCapture:cancel,setContext(next:BindingContext){if(!capturing){context=next;render();}},
  dispose(){if(disposed)return;disposed=true;unsubscribe();doc.removeEventListener("keydown",onKey,true);doc.removeEventListener("mousedown",onMouse,true);doc.removeEventListener("wheel",onWheel,true);doc.removeEventListener("contextmenu",onContextMenu,true);editor.dispose();}
 };
}
