import * as THREE from "three";

export interface PgWeaponFinishDescriptor {
  id:string;body:string;inset:string;accent:string;metalness:number;roughness:number;
  pattern:"brushed"|"ceramic"|"circuit"|"starfield"|"glass"|"champion";
}
type Channel="body"|"inset"|"accent";
type Subject={mesh:THREE.Mesh;original:THREE.MeshStandardMaterial;channel:Channel;patterned:boolean;local?:THREE.MeshStandardMaterial};

function channelFor(mesh:THREE.Mesh,root:THREE.Group):Channel|null{
  const name=mesh.name;
  if(!name && mesh.parent===root){
    // Unnamed canonical barrel/receiver shells sit on the action centerline.
    // Above it are sight mounts; below it are the unpainted pistol grips.
    if(mesh.position.y < -.16 || mesh.position.y > .14)return null;
    return mesh.position.z>0?"inset":"body";
  }
  if(/^(?:receiver-metal-edge|stock-cheek-inlay|orbit-slide-top-inlay)$|-(?:service-serial|action-inlay|emitter-service-vane)$/.test(name))return "accent";
  if(/^(?:receiver-composite-panel|cell-composite-shell|stock-receiver-collar|rail-receiver-cheek|stock-pad-inset|orbit-rear-striker-inset|orbit-slide-serration|shotgun-pump-rib|smg-stock-strut)$/.test(name))return "inset";
  if(/^(?:prism-receiver|comet-slide|orbit-(?:light-slide|composite-frame|barrel)|quasar-handguard|shotgun-pump|helix-split-rail|receiver-action-spine|stock-sculpted-housing)$/.test(name))return "body";
  return null;
}

// Small repeating reflectance variations keep the catalog colors legible under game lighting.
function fillPattern(data:Uint8Array,pattern:PgWeaponFinishDescriptor["pattern"]){
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){
    const grain=((x*71+y*157+x*y*17)>>>0)%29;
    let shade:number;
    switch(pattern){
      case "brushed":shade=226+((y*19)%22)+grain/5;break;
      case "ceramic":shade=(x+y)%16===0?226:245+grain/5;break;
      case "circuit":shade=(y%16===4 && x%16<10)||(x%16===9 && y%16>=4 && y%16<11)||(y%16===10&&x%16>=9)?207:246;break;
      case "starfield":shade=grain===0?255:214+Math.round(12*Math.cos((x+y)*Math.PI/16))+grain/3;break;
      case "glass":shade=229+Math.round(12*Math.cos((x-y)*Math.PI/16));break;
      case "champion":shade=(y+Math.abs(x-16))%16<3?211:247;break;
    }
    const i=(32*y+x)*4;data[i]=data[i+1]=data[i+2]=Math.round(shade);data[i+3]=255;
  }
}

/** Attach after ordinary weapon assembly. This layer owns only its material clones and swatch. */
export function createPgWeaponFinishArt(root:THREE.Group) {
  const subjects:Subject[]=[];
  root.traverse(node=>{
    if(!(node instanceof THREE.Mesh) || !(node.material instanceof THREE.MeshStandardMaterial))return;
    const material=node.material;
    if(material.transparent || material.emissive.getHex()!==0)return;
    const channel=channelFor(node,root);
    if(channel)subjects.push({mesh:node,original:material,channel,patterned:channel!=="accent" && !!node.geometry.getAttribute("uv") && !material.map});
  });
  const variants=new Map<THREE.MeshStandardMaterial,Map<string,THREE.MeshStandardMaterial>>();
  let texture:THREE.DataTexture|null=null,currentPattern:PgWeaponFinishDescriptor["pattern"]|null=null;
  let current:PgWeaponFinishDescriptor|null=null,disposed=false;
  const canPattern=subjects.some(subject=>subject.patterned);

  function setFinish(finish:PgWeaponFinishDescriptor|null){
    if(disposed || current===finish)return;
    if(current && finish && current.id===finish.id && current.pattern===finish.pattern &&
      current.body===finish.body && current.inset===finish.inset && current.accent===finish.accent &&
      current.metalness===finish.metalness && current.roughness===finish.roughness)return;
    current=finish;
    if(!finish){
      for(const subject of subjects)if(subject.mesh.material===subject.local)subject.mesh.material=subject.original;
      return;
    }
    if(canPattern && currentPattern!==finish.pattern){
      if(!texture){
        texture=new THREE.DataTexture(new Uint8Array(32*32*4),32,32);
        texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.minFilter=THREE.LinearMipmapLinearFilter;
        texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=true;texture.colorSpace=THREE.SRGBColorSpace;
      }
      fillPattern(texture.image.data as Uint8Array,finish.pattern);texture.needsUpdate=true;currentPattern=finish.pattern;
    }
    for(const subject of subjects){
      const {mesh,original,channel,patterned}=subject;
      if(mesh.material!==original && mesh.material!==subject.local)continue;
      if(!subject.local){
        let group=variants.get(original);if(!group){group=new Map();variants.set(original,group);}
        const key=patterned ? channel+"-pattern" : channel;
        let local=group.get(key);
        if(!local){local=original.clone();if(patterned)local.map=texture;group.set(key,local);}
        subject.local=local;
      }
      const local=subject.local;
      local.color.set(finish[channel]);
      local.metalness=THREE.MathUtils.clamp(finish.metalness+(channel==="accent" ? .08 : 0),0,1);
      local.roughness=THREE.MathUtils.clamp(finish.roughness+(channel==="inset" ? .10 : 0),.12,1);
      mesh.material=local;
    }
  }
  return {setFinish,dispose(){
    if(disposed)return;
    setFinish(null);disposed=true;
    for(const group of variants.values())for(const local of group.values())local.dispose();
    texture?.dispose();variants.clear();subjects.length=0;
  }};
}
