import {describe, expect, it} from "vitest";
import {createPgWorldInteractionPrompt} from "./pg-world-interaction-prompt";

class Stub {
  hidden = false; className = ""; removed = false; writes = 0;
  children: Stub[] = []; dataset: Record<string,string> = {}; attrs: Record<string,string> = {};
  private value = "";
  get textContent() { return this.value; }
  set textContent(next:string) { this.value=next; this.writes++; }
  setAttribute(k:string,v:string) { this.attrs[k]=v; }
  append(...nodes:Stub[]) { this.children.push(...nodes); }
  replaceChildren(...nodes:Stub[]) { this.children=nodes; }
  remove() { this.removed=true; }
}
function setup() {
  const prompt=createPgWorldInteractionPrompt({createElement:()=>new Stub()} as unknown as Document);
  return {prompt,root:prompt.root as unknown as Stub};
}
const view={key:"E",title:"Anomaly Arsenal",detail:"850 RUN POINTS",available:true};

describe("World interaction prompt",()=>{
  it("patches existing elements and leaves the live status untouched between changes",()=>{
    const {prompt,root}=setup();
    expect(root.hidden).toBe(true);prompt.render(view);
    const [key,copy]=root.children,[title,detail]=copy.children;
    expect(root.hidden).toBe(false);expect(root.dataset.available).toBe("true");
    expect([key.textContent,title.textContent,detail.textContent]).toEqual(["E","Anomaly Arsenal","850 RUN POINTS"]);
    expect(detail.attrs["aria-live"]).toBe("polite");
    for(let i=0;i<30;i++)prompt.render({...view});
    expect(root.children[1]).toBe(copy);expect([key.writes,title.writes,detail.writes]).toEqual([1,1,1]);
    prompt.render({...view,key:"R3",detail:"REVEALING",available:false});
    expect(root.dataset.available).toBe("false");expect(detail.textContent).toBe("REVEALING");expect(key.textContent).toBe("R3");
    expect([key.writes,title.writes,detail.writes]).toEqual([2,1,2]);prompt.dispose();
  });
  it("hides when the interaction goes away and ignores new updates after removal",()=>{
    const {prompt,root}=setup();
    prompt.render(view);prompt.render(null);expect(root.hidden).toBe(true);
    prompt.render({...view,title:"<b>Console</b>"});expect(root.children[1].children[0].textContent).toBe("<b>Console</b>");
    prompt.dispose();prompt.dispose();prompt.render(view);
    expect(root.hidden).toBe(true);expect(root.removed).toBe(true);expect(root.children).toHaveLength(0);
  });
});
