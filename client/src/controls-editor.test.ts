import {describe,it,expect,vi} from "vitest";
import {createControlsEditor} from "./controls-editor";
import {bindingActions,BINDING_CONTEXTS,emptyBindingSettings} from "./input-bindings";

class Stub {
  children:Stub[]=[]; dataset:Record<string,string>={}; attrs:Record<string,string>={};
  className="";value="";textContent="";innerHTML="";hidden=false;open=false;removed=false;focused=false;
  onclick:(()=>void)|null=null;onchange:(()=>void)|null=null;ontoggle:(()=>void)|null=null;
  append(...nodes:Stub[]){this.children.push(...nodes);}
  replaceChildren(...nodes:Stub[]){this.children=nodes;this.textContent="";}
  setAttribute(k:string,v:string){this.attrs[k]=v;}
  remove(){this.removed=true;}
  focus(){this.focused=true;}
  walk():Stub[]{return [this,...this.children.flatMap(node=>node.walk())];}
  find(cls:string){return this.walk().find(node=>node.className===cls)!;}
}
function setup(){
  const editor=createControlsEditor({createElement:()=>new Stub()} as unknown as Document),root=editor.root as unknown as Stub;
  const view={context:"planetfall" as const,settings:emptyBindingSettings(),capturing:null,error:""};editor.render(view);
  return {editor,root,view};
}
describe("Settings controls editor",()=>{
  it("starts closed, renders actual context actions and retains rows and mouse icons across unchanged views",()=>{
    const {editor,root,view}=setup(),list=root.find("controls-rows"),select=root.find("controls-context");
    expect(root.open).toBe(false);expect(select.children.map(x=>x.value)).toEqual(BINDING_CONTEXTS);
    expect(list.children.length).toBe(bindingActions("planetfall").length);
    const fire=root.walk().find(n=>n.dataset.action==="fire")!,icon=fire.children[0];expect(icon.innerHTML).toContain("Left mouse button");
    expect(root.walk().find(n=>n.dataset.action==="aim")!.children[0].innerHTML).toContain("Right mouse button");
    for(let i=0;i<20;i++)editor.render({...view});expect(fire.children[0]).toBe(icon);
    editor.render({...view,context:"planet-gun:spectator"});
    expect(list.children.length).toBe(bindingActions("planet-gun:spectator").length);expect(fire.onclick).toBeNull();
    editor.focus();expect(root.find("controls-heading").focused).toBe(true);root.open=true;editor.focus();expect(select.focused).toBe(true);
    editor.dispose();
  });
  it("emits capture, reset, cancel and context intents while preserving supplied settings and rendering conflict text literally",()=>{
    const {editor,root,view}=setup(),ctx=vi.fn(),capture=vi.fn(),reset=vi.fn(),all=vi.fn(),cancel=vi.fn();
    editor.onContext=ctx;editor.onCapture=capture;editor.onReset=reset;editor.onResetAll=all;editor.onCancel=cancel;
    const select=root.find("controls-context");select.value="planet-gun:planetsiege";select.onchange!();
    expect(ctx).toHaveBeenCalledWith("planet-gun:planetsiege");
    const row=root.find("controls-rows").children[0];row.children[1].onclick!();expect(capture).toHaveBeenCalledWith("moveForward");
    editor.render({...view,capturing:"moveForward",error:"<b>Already bound</b>"});expect(row.children[1].dataset.capturing).toBe("true");expect(root.find("controls-status").textContent).toContain("<b>Already bound</b>");
    const stop=root.find("controls-cancel"),resetAll=root.find("controls-reset-all");
    for(const control of [stop,resetAll,select,row.children[2]])expect(control.dataset.bindingIgnore).toBe("true");
    stop.onclick!();row.children[2].onclick!();resetAll.onclick!();expect(cancel).toHaveBeenCalledOnce();expect(reset).toHaveBeenCalledWith("moveForward");expect(all).toHaveBeenCalledOnce();
    const settings={...view.settings,overrides:{planetfall:{moveForward:["KeyU"]}}};
    editor.render({...view,settings});expect(row.children[1].children[0].textContent).toBe("U");expect(stop.hidden).toBe(true);
    editor.render({...view,settings:{...settings,overrides:{planetfall:{moveForward:null}}}});expect(row.children[1].textContent).toBe("Unbound");
    editor.dispose();editor.dispose();editor.render(view);
    expect(root.removed).toBe(true);expect(root.children).toHaveLength(0);expect(row.children[1].onclick).toBeNull();expect(stop.onclick).toBeNull();expect(select.onchange).toBeNull();
  });
});
