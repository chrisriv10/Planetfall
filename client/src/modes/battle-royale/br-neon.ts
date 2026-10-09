import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import type { GraphicsQuality } from "../../settings";

/** HDR glow, BR-owned and released when lowering quality or
 * leaving the mode. Low/Medium retain bright LED cores with direct rendering.
 * Count every postprocess draw in renderer.info, not only the final quad. */
export class BrNeonRenderer {
  private composer:EffectComposer|null=null;
  private bloom:UnrealBloomPass|null=null;
  private output:OutputPass|null=null;
  constructor(private renderer:THREE.WebGLRenderer,private scene:THREE.Scene,private camera:THREE.Camera){}
  setQuality(quality:GraphicsQuality):void{
    if(quality!=="high"){this.dispose();return;}
    if(this.composer)return;
    this.composer=new EffectComposer(this.renderer);
    // Preserve the scene's native resolution. UnrealBloomPass downsamples its
    // own blur targets; shrinking the composer also blurs paving and glazing.
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.addPass(new RenderPass(this.scene,this.camera));
    this.bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.4,.32,1.15);
    this.output=new OutputPass();
    this.composer.addPass(this.bloom);this.composer.addPass(this.output);
    this.resize();
  }
  resize():void{
    const size=this.renderer.getSize(new THREE.Vector2());
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.composer?.setSize(size.x,size.y);
  }
  render():void{
    if(!this.composer){this.renderer.render(this.scene,this.camera);return;}
    const automatic=this.renderer.info.autoReset;
    this.renderer.info.autoReset=false;this.renderer.info.reset();
    try{this.composer.render();}finally{this.renderer.info.autoReset=automatic;}
  }
  dispose():void{
    this.bloom?.dispose();this.output?.dispose();this.composer?.dispose();
    this.composer=null;this.bloom=null;this.output=null;
  }
}
