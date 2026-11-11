import {describe,expect,it} from "vitest";
import {applyIdentityCosmeticPresentation,clearIdentityCosmeticPresentation} from "./identity-cosmetic-presentation";
import {callingCardSvg,emblemSvg} from "./identity-cosmetic-art";

class NodeStub {
  children:NodeStub[]=[];parentElement:NodeStub|null=null;className="";innerHTML="";attrs:Record<string,string>={};
  tokens=new Set<string>();
  classList={add:(v:string)=>this.tokens.add(v),remove:(...values:string[])=>values.forEach(v=>this.tokens.delete(v)),toggle:(v:string,on:boolean)=>on?this.tokens.add(v):this.tokens.delete(v)};
  constructor(readonly ownerDocument:DocStub){}
  setAttribute(k:string,v:string){this.attrs[k]=v;}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);this.parentElement=null;}
  prepend(n:NodeStub){n.remove();n.parentElement=this;this.children.unshift(n);}
  querySelector(){return this.children.find(c=>c.attrs["data-identity-name"]!==undefined)??null;}
}
class DocStub{created=0;createElement(){this.created++;return new NodeStub(this);}}
const equipment={"calling-card":"card-solar-vanguard",emblem:"emblem-ion-runner"};
describe("identity cosmetic surfaces",()=>{
  it("preserves callers' names/actions and reuses owned layers on changes or cached renders",()=>{
    const doc=new DocStub(),row=doc.createElement(),label=doc.createElement(),button=doc.createElement();label.attrs["data-identity-name"]="";row.prepend(button);row.prepend(label);
    const mount=row as unknown as HTMLElement;applyIdentityCosmeticPresentation(mount,equipment);
    const art=row.children[0],badge=label.children[0];
    expect(art.innerHTML).toBe(callingCardSvg(equipment["calling-card"]));expect(badge.innerHTML).toBe(emblemSvg(equipment.emblem));expect(art.attrs["aria-hidden"]).toBe("true");
    const count=doc.created;for(let i=0;i<10;i++)applyIdentityCosmeticPresentation(mount,{...equipment});expect(doc.created).toBe(count);
    applyIdentityCosmeticPresentation(mount,{...equipment,emblem:"emblem-crown-collector"});expect(label.children[0]).toBe(badge);expect(badge.innerHTML).toBe(emblemSvg("emblem-crown-collector"));
    applyIdentityCosmeticPresentation(mount,{"calling-card":"<img src=x>",emblem:"default"});
    expect(row.children).toEqual([label,button]);expect(label.children).toHaveLength(0);expect(row.tokens.size).toBe(0);
  });
  it("uses a compact gutter without a name slot, reattaches detached art and clears only its own layers",()=>{
    const doc=new DocStub(),row=doc.createElement(),name=doc.createElement(),mount=row as unknown as HTMLElement;row.prepend(name);
    applyIdentityCosmeticPresentation(mount,equipment);expect(row.tokens.has("pf-identity-emblem-gutter")).toBe(true);
    const badge=row.children[0],art=row.children[1];badge.remove();art.remove();applyIdentityCosmeticPresentation(mount,equipment);
    expect(row.children).toEqual([badge,art,name]);
    applyIdentityCosmeticPresentation(mount,{"calling-card":equipment["calling-card"]});expect(row.tokens.has("pf-identity-emblem-gutter")).toBe(false);expect(row.children).toEqual([art,name]);
    clearIdentityCosmeticPresentation(mount);clearIdentityCosmeticPresentation(mount);expect(row.children).toEqual([name]);
  });
});
