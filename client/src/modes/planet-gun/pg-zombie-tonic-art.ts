import * as THREE from "three";
import type {GraphicsQuality} from "../../settings";

export interface PgTonicSite {
  id:string; name:string; color:number; price:number;
  position:{x:number;y:number;z:number}; yaw:number;
}

/** Front-facing cabinet readout shared by the Forge and tonic dispensers. */
export function createPgMachineReadout(heading:string,accent:number) {
  const canvas=typeof document==="undefined"?null:document.createElement("canvas");
  if(canvas){canvas.width=768;canvas.height=192;}
  const ctx=canvas?.getContext("2d"),texture=canvas&&ctx?new THREE.CanvasTexture(canvas):null;
  if(texture) texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshBasicMaterial({color:texture?0xffffff:0x152832,map:texture,toneMapped:false});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(),material);
  mesh.name="machine-readout";mesh.rotation.y=Math.PI;
  const accentCss=new THREE.Color(accent).getStyle();
  let previous:string|undefined;
  return {mesh,
    write(detail:string) {
      if(detail===previous)return;
      previous=detail;mesh.userData.status=detail;
      if(!ctx||!texture)return;
      ctx.fillStyle="#101c27";ctx.fillRect(0,0,768,192);
      ctx.fillStyle=accentCss;ctx.fillRect(0,0,9,192);
      ctx.font="bold 60px sans-serif";ctx.fillText(heading,26,82,713);
      ctx.fillStyle="#e5f5f2";ctx.font="bold 39px monospace";ctx.fillText(detail,27,153,713);
      texture.needsUpdate=true;
    },
    dispose(){mesh.geometry.dispose();material.dispose();texture?.dispose();}
  };
}

/** Bake repeated rigid components into a draw per shape and finish, keeping geometry shared. */
export function createPgMachineShell(parent:THREE.Group) {
  const batches=new Map<THREE.BufferGeometry,Map<THREE.Material,THREE.Matrix4[]>>();
  const pose=new THREE.Object3D(),instances:THREE.InstancedMesh[]=[];
  return {
    part(shape:THREE.BufferGeometry,finish:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number,roll=0){
      let finishes=batches.get(shape);
      if(!finishes){finishes=new Map();batches.set(shape,finishes);}
      let transforms=finishes.get(finish);
      if(!transforms){transforms=[];finishes.set(finish,transforms);}
      pose.position.set(x,y,z);pose.scale.set(w,h,d);pose.rotation.set(0,0,roll);pose.updateMatrix();
      transforms.push(pose.matrix.clone());
    },
    build(){
      for(const [shape,finishes] of batches)for(const [finish,list] of finishes){
        const mesh=new THREE.InstancedMesh(shape,finish,list.length);
        list.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;
        mesh.computeBoundingBox();mesh.computeBoundingSphere();parent.add(mesh);instances.push(mesh);
      }
      batches.clear();
    },
    dispose(){for(const mesh of instances)mesh.dispose();}
  };
}

export function createPgZombieTonicArt(sites:readonly PgTonicSite[]) {
  const root=new THREE.Group();root.name="pg-zombie-ion-tonics";
  const box=new THREE.BoxGeometry(),tube=new THREE.CylinderGeometry(1,1,1,16);
  const alloy=new THREE.MeshStandardMaterial({color:0xa2b5ae,metalness:.42,roughness:.48});
  const navy=new THREE.MeshStandardMaterial({color:0x273342,roughness:.65});
  const inset=new THREE.MeshStandardMaterial({color:0x111c29,roughness:.72});
  const fallbackLight=new THREE.Color(0x4e5960);
  const dispenseLight=new THREE.Color(0xffffff);
  const dispenseDuration=440;
  const machines=sites.slice(0,3).map(site=>{
    const machine=new THREE.Group();machine.name=site.id;machine.position.copy(site.position);machine.rotation.y=site.yaw;root.add(machine);
    const body=new THREE.Group();body.name="fixed-body-group";machine.add(body);
    const shell=createPgMachineShell(body),part=shell.part;
    const accent=new THREE.MeshBasicMaterial({color:site.color}),stationColor=accent.color.clone();
    const finish=new THREE.MeshStandardMaterial({color:site.color,metalness:.32,roughness:.54});
    part(box,navy,0,.08,0,.95,.16,.75);
    part(box,alloy,0,.42,.025,.82,.53,.62);
    part(box,navy,0,.88,.10,.81,.55,.46);
    part(box,inset,0,.86,-.145,.62,.41,.05);
    part(box,alloy,0,.622,-.19,.73,.047,.33);
    part(tube,finish,0,.73,-.185,.072,.16,.072);
    part(box,finish,0,1.18,-.015,.88,.18,.62);
    part(box,navy,0,1.52,.232,.79,.55,.18);
    const id=site.id.toLowerCase();
    if(id.includes("core")||id.includes("vital")){
      // Core Reserve: one broad pressure vessel with compression bands.
      part(tube,finish,0,1.52,-.045,.248,.45,.20);
      for(const y of [1.35,1.66])part(tube,alloy,0,y,-.045,.253,.047,.21);
      part(box,accent,0,1.50,-.245,.24,.09,.025);
      part(box,accent,0,1.50,-.246,.085,.24,.025);
    }else if(id.includes("quick")||id.includes("reload")||id.includes("circuit")){
      // Quick Circuit: paired narrow cells bridged by a conductive bus.
      for(const x of [-.18,.18]){
        part(tube,finish,x,1.50,-.065,.128,.46,.132);
        part(tube,alloy,x,1.71,-.065,.139,.05,.14);
        part(box,accent,x,1.50,-.20,.04,.29,.018);
      }
      part(box,alloy,0,1.66,-.08,.38,.04,.08);
    }else{
      // Velocity Blend: a three-fin manifold leans into the flow.
      for(let i=0;i<3;i++){
        const x=-.22+i*.19;
        part(box,finish,x,1.50,-.07,.125,.42,.22,-.17);
        part(box,accent,x,1.50,-.185,.035,.33,.02,-.17);
      }
    }
    part(box,navy,0,1.834,.025,.93,.30,.64);
    shell.build();
    const readout=createPgMachineReadout(site.name,site.color);
    readout.mesh.position.set(0,1.834,-.299);readout.mesh.scale.set(.87,.237,1);body.add(readout.mesh);
    const indicator=new THREE.Mesh(box,accent);
    indicator.name="tonic-flow";indicator.position.set(0,.43,-.293);indicator.scale.set(.36,.024,.023);body.add(indicator);
    return {site,shell,readout,accent,stationColor,finish,indicator,powered:null as boolean|null,owned:null as boolean|null,dispensedAt:-Infinity};
  });
  let disposed=false;
  return {root,
    update(powered:boolean,owned:readonly string[],time:number,quality:GraphicsQuality,reduced:boolean){
      if(disposed)return;
      const motion=!reduced&&quality!=="low"&&Number.isFinite(time);
      for(const machine of machines){
        const has=owned.includes(machine.site.id);
        if(powered!==machine.powered||has!==machine.owned){
          if(has&&machine.owned===false&&powered&&motion)machine.dispensedAt=time;
          machine.powered=powered;machine.owned=has;
          const status=has?"PURCHASED":powered?"AVAILABLE":"NO POWER";
          machine.readout.write(`ION TONIC  /  ${machine.site.price} PTS  /  ${status}`);
        }
        if(!motion||!powered||!has||time<machine.dispensedAt)machine.dispensedAt=-Infinity;
        const elapsed=time-machine.dispensedAt;
        const pulse=elapsed<dispenseDuration?Math.sin(Math.PI*elapsed/dispenseDuration):0;
        const idle=powered&&motion?Math.sin(time*.002)*.045:0;
        machine.indicator.scale.x=.36+idle+pulse*.30;
        machine.indicator.scale.y=.024+pulse*.038;
        machine.accent.color.copy(powered?machine.stationColor:fallbackLight).lerp(dispenseLight,pulse*.55);
      }
    },
    dispose(){
      if(disposed)return;disposed=true;
      for(const m of machines){m.shell.dispose();m.readout.dispose();m.accent.dispose();m.finish.dispose();}
      root.removeFromParent();root.clear();box.dispose();tube.dispose();alloy.dispose();navy.dispose();inset.dispose();
    }
  };
}
