import type { FacadePart } from "./br-facades";

export interface BrFacadeIntersection {
  pane:number; decoration:number; face:FacadePart["face"];
  width:number; height:number; penetration:number;
}
/** Check actual boxes against the outward glazing face, rather than treating
 * the intentional backing panel behind each window as an intersection.
 * Thin mullions/edge seals are deliberate joins; broad trim cutting through
 * the glass face needs review. Inputs and geometry are never modified. */
export function brFacadeIntersections(parts:readonly FacadePart[]):BrFacadeIntersection[]{
  const issues:BrFacadeIntersection[]=[];
  for(const [paneIndex,pane] of parts.entries()){
    if(pane.finish!=="glass"&&pane.finish!=="lit")continue;
    const along=pane.face==="north"||pane.face==="south"?"x":"z",normal=along==="x"?"z":"x";
    const sign=pane.face==="north"||pane.face==="east"?1:-1;
    const front=sign*pane.position[normal]+pane.scale[normal]/2;
    for(const [decorationIndex,decoration] of parts.entries()){
      if(decoration.face!==pane.face||["glass","lit","foliage"].includes(decoration.finish))continue;
      const near=sign*decoration.position[normal]-decoration.scale[normal]/2;
      const far=sign*decoration.position[normal]+decoration.scale[normal]/2;
      if(near>=front-.01||far<=front+.01)continue;
      const overlap=(axis:"x"|"y"|"z")=>Math.min(pane.position[axis]+pane.scale[axis]/2,decoration.position[axis]+decoration.scale[axis]/2)
        -Math.max(pane.position[axis]-pane.scale[axis]/2,decoration.position[axis]-decoration.scale[axis]/2);
      const width=overlap(along),height=overlap("y");
      if(width>.12&&height>.12)issues.push({pane:paneIndex,decoration:decorationIndex,face:pane.face,width,height,penetration:Math.min(front-near,far-front)});
    }
  }
  return issues;
}
