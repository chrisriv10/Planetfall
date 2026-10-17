import * as THREE from "three";
import { BR_VEHICLE_DEFINITIONS } from "@planetfall/shared";
import { disposeBrHoverSkimmer, type BrHoverSkimmerVisual, type BrHoverSkimmerFrame } from "./br-hover-skimmer";
import { batchBrSkimmerStaticParts } from "./br-skimmer-static-batching";

export type BrTeamVehicleKind="relay-rover"|"ion-shuttle";
export interface BrTeamVehicleVisual extends BrHoverSkimmerVisual {
  readonly kind:BrTeamVehicleKind;
  /** Player group origins, in canonical seat order. */
  readonly seatAnchors:readonly THREE.Object3D[];
}

/** Local +Z forward. The open cabin has no glass roof obscuring seated players. */
export function createBrTeamVehicle(kind:BrTeamVehicleKind):BrTeamVehicleVisual {
  const shuttle=kind==="ion-shuttle";
  const group=new THREE.Group();group.name=kind;
  const model=new THREE.Group();group.add(model);
  const box=new THREE.BoxGeometry(1,1,1),cylinder=new THREE.CylinderGeometry(1,1,1,10);
  const armor=new THREE.MeshStandardMaterial({color:shuttle?0xd9e9f1:0xd6c49b,metalness:.32,roughness:.42});
  const dark=new THREE.MeshStandardMaterial({color:0x182b40,metalness:.4,roughness:.5});
  const accent=new THREE.MeshStandardMaterial({color:shuttle?0x65e4ff:0xffb55b,emissive:shuttle?0x65e4ff:0xffb55b,emissiveIntensity:.3});
  const head=new THREE.MeshBasicMaterial({color:0xc3f8ff,toneMapped:false});
  const tail=new THREE.MeshBasicMaterial({color:0xff755d,toneMapped:false});
  const add=(name:string,size:[number,number,number],at:[number,number,number],material:THREE.Material=armor,parent:THREE.Group=model,geometry:THREE.BufferGeometry=box)=>{
    const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.scale.set(...size);mesh.position.set(...at);mesh.castShadow=true;mesh.userData.cameraCollision=false;parent.add(mesh);return mesh;
  };
  const width=shuttle?2.4:3,length=shuttle?4.8:5.6;
  // The main low deck stays below seated hips; front/rear caps carry the height.
  add("vehicle-floor",[shuttle?width:width-.04,.22,shuttle?length:length-.04],[0,shuttle?.56:.76,0],dark);
  add("vehicle-nose",[width,shuttle?.45:.28,shuttle?.65:.63],[0,shuttle?.975:.78,length/2-.325]);
  add("vehicle-tail",[width,.35,.5],[0,shuttle?.87:.945,-length/2+.25]);
  for(const side of [-1,1]){
    add("vehicle-side-sill",[.18,.27,length-1.1],[side*(width/2-(shuttle?.09:.12)),shuttle?.8:.95,0],shuttle?armor:dark);
    if(shuttle)add("vehicle-side-inset",[.025,.06,length-1.4],[side*(width/2+.013),.85,0],accent);
  }
  const seatAnchors:THREE.Object3D[]=[];
  for(const [index,seat] of BR_VEHICLE_DEFINITIONS[kind].seats.entries()){
    const anchor=new THREE.Object3D();anchor.name=`vehicle-occupant-${index}`;anchor.position.set(seat.x,seat.y,seat.z);model.add(anchor);seatAnchors.push(anchor);
    // Canonical astronaut torso bottom is .24 above its player origin.
    add("vehicle-seat-base",[1.02,.16,.72],[seat.x,seat.y+.16,seat.z],dark);
    add("vehicle-seat-back",[1.02,.62,.13],[seat.x,seat.y+.48,seat.z-.43],dark);
    add("vehicle-seat-index",[.18,.04,.016],[seat.x,seat.y+.68,seat.z-.355],accent);
  }
  const first=BR_VEHICLE_DEFINITIONS[kind].seats[0];
  add("vehicle-driver-console",[.6,.12,.24],[first.x,first.y+.52,first.z+.72],dark);
  add("vehicle-driver-display",[.36,.02,.15],[first.x,first.y+.59,first.z+.72],accent);
  if(shuttle){
    for(const side of [-1,1]){
      add("shuttle-wing",[2.2,.2,1.3],[side*2.3,.85,-.35]);
      add("shuttle-wing-tip",[.14,.25,1.35],[side*3.33,.87,-.35],dark);
      add("shuttle-wing-inset",[1.65,.025,.09],[side*2.25,.963,-.35],accent);
      add("shuttle-tail-fin",[.12,.8,.7],[side*.9,1.35,-1.9],dark);
    }
  }else{
    // Deep drive chassis and interrupted side armor keep the open four-seat
    // cabin readable as a transport. All body parts fit the existing hull boxes.
    add("rover-drive-chassis",[2.6,.3,4.8],[0,.55,0],dark);
    add("rover-stepped-hood",[2.22,.19,.86],[0,1.015,2.02]);
    add("rover-hood-center",[.5,.08,.7],[0,1.08,2.05],dark);
    for(const side of [-1,1]){
      for(const z of [-1.95,1.85]){
        add("rover-drive-armor",[.34,.43,.95],[side*1.32,.905,z]);
        add("rover-drive-vent",[.018,.19,.64],[side*1.491,.9,z],dark);
        add("rover-drive-status",[.02,.035,.34],[side*1.489,1.035,z],accent);
      }
      add("rover-cabin-step",[.32,.12,1.16],[side*1.32,.7,-.05],dark);
      add("rover-front-grille",[.62,.12,.018],[side*.64,.77,2.791],dark);
    }
    // An open utility rack behind passengers distinguishes the rover from a jet.
    for(const side of [-1,1])add("rover-cargo-rail",[.1,.3,.75],[side*1.1,1.2,-2.1],dark);
    add("rover-cargo-crossbar",[2.3,.1,.1],[0,1.35,-2.45],accent);
  }
  const hoverModules:THREE.Group[]=[];
  for(const x of shuttle?[-2.55,2.55]:[-1.13,1.13])for(const z of shuttle?[-.7,.15]:[-1.95,1.85]){
    const pod=new THREE.Group();pod.name="team-hover-module";pod.position.set(x,shuttle?.68:.6,z);model.add(pod);hoverModules.push(pod);
    add("team-thruster",[.28,.25,.28],[0,0,0],dark,pod,cylinder);
    add("team-thruster-emitter",[.21,.035,.21],[0,-.14,0],accent,pod,cylinder);
  }
  const headLights:THREE.Mesh[]=[],tailLights:THREE.Mesh[]=[];
  for(const x of [-width*.32,width*.32]){
    headLights.push(add("team-headlight",[.3,.12,.03],[x,1,length/2+.02],head));
    tailLights.push(add("team-tail-light",[.28,.1,.03],[x,.95,-length/2-.02],tail));
  }
  const seatAnchor=new THREE.Object3D();seatAnchor.position.copy(seatAnchors[0].position);seatAnchor.position.y+=.24;model.add(seatAnchor);
  const animated=new Set<THREE.Object3D>([...headLights,...tailLights]);
  batchBrSkimmerStaticParts(model,animated);
  for(const pod of hoverModules)batchBrSkimmerStaticParts(pod,animated);
  return {kind,group,model,driverAnchor:seatAnchors[0],seatAnchor,seatAnchors,hoverModules,headLights,tailLights,resources:{geometries:[box,cylinder],materials:[armor,dark,accent,head,tail]},disposed:false};
}

/** Keep occupant anchors fixed to canonical positions; only emitter intensity pulses. */
export function updateBrTeamVehicle(visual:BrTeamVehicleVisual,frame:Readonly<BrHoverSkimmerFrame>):void {
  if(visual.disposed)return;
  const time=Number.isFinite(frame.time)?frame.time:0;
  const material=visual.resources.materials[2] as THREE.MeshStandardMaterial;
  material.emissiveIntensity=.28+.04*Math.sin(time*2);
}
export const disposeBrTeamVehicle=disposeBrHoverSkimmer;
