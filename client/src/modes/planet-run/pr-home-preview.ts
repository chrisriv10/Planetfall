import {createPrShowcaseArt} from "./art/pr-showcase-art";

/** Purpose-built six-course miniature; reuses the owning menu renderer. */
export class PrHomePreview {
  private readonly art=createPrShowcaseArt();
  readonly root=this.art.root;
  update(timeSeconds:number):void{this.art.update(timeSeconds);}
  dispose():void{this.art.dispose();}
}
