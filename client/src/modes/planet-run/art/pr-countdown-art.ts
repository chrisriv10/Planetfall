import * as THREE from "three";
import type {PrPhase,PrRoundDefinition} from "@planetfall/shared";
import {PR_ART_PALETTES,type PrArtQuality} from "./pr-art-shared";

/** Countdown values and phase are supplied by authority; only GO's cosmetic fade is local. */
export function createPrCountdownArt(round:PrRoundDefinition){
 const root=new THREE.Group();root.name="planet-run-world-countdown";root.visible=false;
 // Race pilots face -Z; put the overhead display ahead of every spawn row,
 // where the ordinary trailing chase camera can see it during countdown.
 root.position.set(0,round.category==="race"?5:round.category==="final"?29:8,round.category==="race"?-6:round.category==="final"?-33:-24);
 const palette=PR_ART_PALETTES[round.id],backGeometry=new THREE.BoxGeometry(4.8,1.15,.14),lampGeometry=new THREE.SphereGeometry(.18,10,6);
 const backMaterial=new THREE.MeshStandardMaterial({color:palette.dark,metalness:.3,roughness:.5});
 const lampMaterial=new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false});
 const back=new THREE.Mesh(backGeometry,backMaterial);back.name="countdown-display-housing";root.add(back);
 const lamps=new THREE.InstancedMesh(lampGeometry,lampMaterial,3);lamps.name="countdown-three-lamps";root.add(lamps);
 const dummy=new THREE.Object3D(),color=new THREE.Color();
 for(let i=0;i<3;i++){dummy.position.set((i-1)*.62,.29,.14);dummy.updateMatrix();lamps.setMatrixAt(i,dummy.matrix);lamps.setColorAt(i,color.setHex(palette.soft).multiplyScalar(.25));}
 let texture:THREE.CanvasTexture|undefined,textMaterial:THREE.MeshBasicMaterial|undefined,textGeometry:THREE.PlaneGeometry|undefined,canvas:HTMLCanvasElement|undefined,ctx:CanvasRenderingContext2D|null=null;
 if(typeof document!=="undefined"){
  canvas=document.createElement("canvas");canvas.width=512;canvas.height=80;ctx=canvas.getContext("2d");
  if(ctx){texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textMaterial=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false});textGeometry=new THREE.PlaneGeometry(4.3,.67);const text=new THREE.Mesh(textGeometry,textMaterial);text.name="countdown-state-display";text.position.set(0,-.23,.08);root.add(text);}
 }
 root.traverse(node=>{node.userData.cameraCollision=false;});
 let disposed=false,previous:PrPhase="lobby",goAt=-Infinity,lastState="";
 function display(state:string,lit:number,go:boolean){
  if(state===lastState)return;lastState=state;root.userData.display=state;
  for(let i=0;i<3;i++){color.setHex(i<lit?(go?palette.glow:palette.hazard):palette.soft);if(i>=lit)color.multiplyScalar(.25);lamps.setColorAt(i,color);}if(lamps.instanceColor)lamps.instanceColor.needsUpdate=true;
  if(ctx&&canvas&&texture){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle=`#${new THREE.Color(palette.white).getHexString()}`;ctx.font="800 46px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(`${round.category.toUpperCase()}  /  ${state}`,256,41);texture.needsUpdate=true;}
 }
 return {root,
  update(phase:PrPhase,seconds:number,elapsedMs:number){
   if(disposed||!Number.isFinite(elapsedMs))return;
   if(phase==="running"&&previous==="countdown")goAt=elapsedMs;
   if(phase==="countdown"){
    goAt=-Infinity;root.visible=Number.isFinite(seconds);if(root.visible){const remaining=Math.max(1,Math.min(3,Math.ceil(seconds)));display(String(remaining),4-remaining,false);}
   }else if(phase==="running"&&elapsedMs>=goAt&&elapsedMs-goAt<1000){root.visible=true;display("GO",3,true);}
   else {root.visible=false;if(phase!=="running")goAt=-Infinity;}
   previous=phase;
  },
  // Cues remain identical on every quality; the entire module is at most three draws.
  setQuality(_quality:PrArtQuality){},
  dispose(){if(disposed)return;disposed=true;lamps.dispose();backGeometry.dispose();lampGeometry.dispose();backMaterial.dispose();lampMaterial.dispose();texture?.dispose();textGeometry?.dispose();textMaterial?.dispose();root.clear();root.removeFromParent();},
 };
}
