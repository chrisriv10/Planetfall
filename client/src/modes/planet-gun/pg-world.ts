import * as THREE from "three";
import { PG_MAP } from "@planetfall/shared";

type Quality = "low" | "medium" | "high";
type Box = readonly [number, number, number, number, number, number];
/** All traversable silhouettes come from PG_MAP. Surface dressing is flush;
 * distant station scenery is outside the arena and never implies playable cover. */
export class PgWorldRenderer {
  readonly root = new THREE.Group();
  private readonly detail = new THREE.Group();
  private readonly skyline = new THREE.Group();
  private readonly geometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
  private readonly batches = new Map<string, { material: THREE.Material; boxes: Box[]; parent: THREE.Group }>();
  private readonly hologram = new THREE.Group();
  private disposed = false;

  constructor() {
    this.root.name = "nova-block";
    this.root.add(this.detail, this.skyline, this.hologram);
    this.resources.add(this.geometry);
    const material = (color: number, emissive = 0) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: .68, metalness: .24, emissive: color, emissiveIntensity: emissive });
      this.resources.add(m); return m;
    };
    const deck = material(0x243549), west = material(0x96a9b6), east = material(0x8b9eaf);
    const ivory = material(0xd1e1da), trim = material(0x182538), garden = material(0x344f53), maintenance=material(0x7f8b91);
    const solarPaving=material(0x35414b),voidPaving=material(0x35414b),hydroPaving=material(0x35464b),servicePaving=material(0x3b444b),plazaPaving=material(0x3b4b5b);
    const cyan = material(0x62ffdc, 1.15), amber = material(0xffcd76, 1), violet = material(0xc2a0ff, 1);
    const glass = material(0x36778c, .16), runPanel=material(0x253c45,.025);
    glass.roughness=.22;glass.metalness=.58;trim.roughness=.42;trim.metalness=.48;
    deck.roughness=.93;deck.metalness=.08;ivory.roughness=.57;garden.roughness=.86;
    const add = (key: string, mat: THREE.Material, b: Box, parent = this.root) => {
      key = `${key}:${mat.uuid}`;
      let batch = this.batches.get(key);
      if (!batch) { batch = { material: mat, boxes: [], parent }; this.batches.set(key, batch); }
      batch.boxes.push(b);
    };
    for (const s of PG_MAP.solids) {
      const c = s.center, h = s.half;
      const color = s.kind === "rail" ? ivory : s.id.startsWith("maintenance-") ? maintenance : s.kind === "wall-run" || s.kind === "planter" ? garden : s.kind === "habitat" ? c.x < 0 ? west : east : s.kind === "transit" ? ivory : deck;
      add(`body-${color.uuid}`, color, [c.x,c.y,c.z,h.x*2,h.y*2,h.z*2]);
      if (s.id === "orbital-deck") continue;
      if (s.kind === "habitat" || s.kind === "wall-run") {
        const wide = h.x > h.z, length = wide ? h.x * 2 : h.z * 2;
        // Insets sit on opaque collision-backed walls, never across an opening.
        for (const sign of [-1,1]) {
          const face = (along: number, y: number, width: number, height: number, m: THREE.Material, name: string, offset=.008) => {
            // Service panels remain nearly flush against a smooth run face.
            if(s.kind==="wall-run")offset=Math.min(offset*.62,.033);
            add(name, m, wide ? [c.x+along,y,c.z+sign*(h.z+offset),width,height,.012] : [c.x+sign*(h.x+offset),y,c.z+along,.012,height,width]);
          };
          const service=s.kind === "wall-run";
          const accent=service?cyan:c.x<0?amber:violet;
          // Layered structural cassette: dark reveal behind glass/door, then
          // a shallow frame. Smooth run faces project only centimetres.
          face(0,c.y+h.y-.14,length,.28,trim,"roof-fascia",.018);
          face(0,c.y+h.y-.06,length-.15,.055,ivory,"roof-coping",.042);
          face(0,.14,length,.28,trim,"wall-plinth",.018);
          face(0,c.y+h.y-.34,length-.3,.045,accent,"wall-light",.026);
          for(let along=-length/2+.23;along<length/2;along+=3.4)
            face(along,c.y,.18,h.y*2-.12,ivory,"structural-pilaster",.052);
          const step=service?3.4:2.5;
          for(let along=-length/2+step*.56;along<length/2-step*.32;along+=step){
            const ph=service?2.65:Math.min(1.75,h.y*1.1),pw=service?2.75:2.05;
            const py=service?2.55:c.y+.04;
            face(along,py,pw+.16,ph+.18,trim,"bay-shadow",.010);
            face(along,py,pw,ph,service?runPanel:glass,"panel",.023);
            face(along,py-ph/2-.06,pw+.23,.1,ivory,"window-sill",.048);
            face(along,py+ph/2+.06,pw+.23,.1,ivory,"bay-header",.048);
            for(const side of[-1,1])face(along+side*(pw/2+.04),py,.07,ph,ivory,"bay-jamb",.048);
            if(service){
              face(along,1.05,pw*.8,.045,cyan,"run-guide",.041);
              face(along,py,.028,ph,trim,"run-panel-seam",.045);
              for(let v=0;v<4;v++)face(along,py+.65+v*.12,pw*.6,.035,trim,"service-vent",.041);
              face(along+pw*.35,py-.4,.08,.22,amber,"bay-status",.043);
            }else{
              face(along,py,.035,ph,ivory,"window-mullion",.048);
              face(along,py+ph*.22,pw,.028,ivory,"window-transom",.065);
              face(along-pw*.32,py+.15,.12,ph*.65,ivory,"glass-reflection",.034);
            }
          }
          // Crown equipment stays within the existing solid silhouette, so it
          // never masquerades as extra cover on a traversable roof.
          if(service)for(let along=-length/2+2;along<length/2-1;along+=4.5){
            face(along,4.55,1.5,.32,trim,"roof-service-recess",.027);
            for(let q=0;q<5;q++)face(along-.5+q*.25,4.55,.1,.24,ivory,"roof-service-fin",.054);
          }

        }
      }
      if (s.kind === "stair") add("tread",amber,[c.x,c.y+h.y+.008,c.z-h.z+.08,h.x*2-.16,.012,.08]);
      if (s.kind === "floor") {
        add("gallery-edge",cyan,[c.x,c.y+h.y+.008,c.z+h.z-.08,h.x*2,.012,.08]);
        for(const side of[-1,1]){
          add("gallery-fascia",ivory,[c.x,c.y,c.z+side*(h.z+.012),h.x*2,.32,.018]);
          add("gallery-reveal",trim,[c.x,c.y-.12,c.z+side*(h.z+.023),h.x*2,.045,.012]);
          for(let x=-h.x+.5;x<h.x-.4;x+=2)add("gallery-bolt",trim,[c.x+x,c.y+.04,c.z+side*(h.z+.024),.055,.055,.012],this.detail);
        }
        add("gallery-under",ivory,[c.x,c.y-h.y-.008,c.z,h.x*1.7,.012,.13],this.detail);
      }
      if (s.kind === "utility" || s.kind === "transit") {
        for(const sign of[-1,1]){
          add("cover-base",trim,[c.x,c.y-h.y+.1,c.z+sign*(h.z+.012),h.x*2,.2,.018]);
          add("cover-shoulder",ivory,[c.x,c.y+h.y-.13,c.z+sign*(h.z+.02),h.x*2,.16,.025]);
          for(const side of[-1,1])add("cover-corner",trim,[c.x+side*(h.x-.13),c.y,c.z+sign*(h.z+.023),.18,h.y*2-.2,.03]);
          add("cover-recess",trim,[c.x,c.y,c.z+sign*(h.z+.012),h.x*1.5,h.y*1.3,.016]);
          add("cover-panel",deck,[c.x,c.y,c.z+sign*(h.z+.024),h.x*1.4,h.y*1.15,.012]);
        }
        // Equipment enclosures have authored end faces too: the ticket bank
        // presents its long X-facing flank to the main plaza approach.
        for(const sign of[-1,1]){
          const x=c.x+sign*h.x;
          add("cover-end-base",trim,[x+sign*.011,c.y-h.y+.09,c.z,.014,.16,h.z*2-.08]);
          add("cover-end-frame",ivory,[x+sign*.012,c.y,c.z,.014,h.y*1.5,h.z*1.82]);
          add("cover-end-panel",deck,[x+sign*.024,c.y,c.z,.010,h.y*1.3,h.z*1.68]);
          const bays=Math.max(1,Math.floor(h.z*2/2));
          for(let i=0;i<bays;i++){
            const z=c.z+(i-(bays-1)/2)*(h.z*1.6/bays),width=h.z*1.2/bays;
            for(let row=0;row<3;row++)add("cover-end-vent",trim,[x+sign*.033,c.y+(row-1)*h.y*.18,z,.008,.045,width],this.detail);
            add("cover-end-status",amber,[x+sign*.033,c.y-h.y*.4,z,.008,.035,Math.min(.16,width)]);
          }
        }
        // Covers read as machinery/terminals, with vents and maintenance panels.
        for (let x=-h.x+.3;x<h.x-.2;x+=.32) add("vents",trim,[c.x+x,c.y,c.z+h.z+.041,.12,h.y*1.35,.014],this.detail);
        add("machine-screen",glass,[c.x,c.y+h.y*.25,c.z-h.z-.041,h.x*1.5,h.y*.75,.014]);
        add("machine-status",cyan,[c.x,c.y+h.y*.4,c.z-h.z-.057,h.x*.9,.065,.014]);
        add("machine-cap",ivory,[c.x,c.y+h.y+.006,c.z,h.x*2,.008,h.z*2]);
      }
      if (s.kind === "planter") {
        // Inlaid hydroponic trays preserve the exact mantle/support surface.
        add("plant-bed",trim,[c.x,c.y+h.y+.006,c.z,h.x*2-.2,.01,h.z*2-.2]);
        for(let x=-h.x+.4;x<h.x-.2;x+=.6)for(let z=-h.z+.4;z<h.z-.2;z+=.6)
          add("plant-rosettes",garden,[c.x+x,c.y+h.y+.014,c.z+z,.42,.016,.42],this.detail);
        add("planter-light",cyan,[c.x,c.y+h.y-.12,c.z+h.z+.008,h.x*2-.3,.055,.012]);
      }
      if(s.kind==="rail"){
        const wide=h.x>h.z;
        // Opaque crash barrier with inset panels and a continuous coping. All
        // substantial surfaces remain inside its authoritative solid volume.
        add("barrier-coping",trim,[c.x,c.y+h.y-.06,c.z,h.x*2,.12,h.z*2]);
        for(const sign of[-1,1]){
          add("barrier-inset",deck,wide?[c.x,.62,c.z+sign*(h.z+.008),h.x*2-.1,.57,.012]:[c.x+sign*(h.x+.008),.62,c.z,.012,.57,h.z*2-.1]);
          for(let along=-(wide?h.x:h.z)+1;along<(wide?h.x:h.z);along+=3.2){
            add("barrier-rib",ivory,wide?[c.x+along,.62,c.z+sign*(h.z+.018),.12,1.02,.015]:[c.x+sign*(h.x+.018),.62,c.z+along,.015,1.02,.12]);
            add("barrier-reflector",amber,wide?[c.x+along,1.1,c.z+sign*(h.z+.029),.28,.055,.012]:[c.x+sign*(h.x+.029),1.1,c.z+along,.012,.055,.28]);
          }
        }
      }
    }
    // Existing door openings retain their entire clear width. These are
    // threshold inlays and jamb strips on their adjacent solid faces.
    for(const [x,z,width,axis]of [[-25,-1,4,"x"],[-35,-11,4,"z"],[19,15,8,"z"],[35,15,8,"z"],[-2,29,2,"x"]] as const){
      const acrossX=axis==="x";
      add("entrance-threshold",trim,[x,.011,z,acrossX?width:.45,.012,acrossX?.45:width]);
      for(const side of[-1,1]){
        add("entrance-jamb",ivory,[x+(acrossX?side*(width/2+.07):.42),1.22,z+(acrossX?.42:side*(width/2+.07)),acrossX?.12:.024,2.4,acrossX?.024:.12]);
        add("entrance-status",cyan,[x+(acrossX?side*(width/2+.07):.44),1.38,z+(acrossX?.44:side*(width/2+.07)),acrossX?.04:.012,.62,acrossX?.012:.04]);
      }
    }
    // Embedded district paving: continuous authored routes connect the three
    // interior identities rather than isolated islands of decorative scatter.
    for(const [mat,x,z,sx,sz]of [[solarPaving,-25,-11,20,20],[voidPaving,27,17,16,20],[hydroPaving,-3,-26,34,7],[servicePaving,-2,25,10,8],[plazaPaving,0,0,24,18]]as const)
      add("district-paving",mat,[x,.002,z,sx,.003,sz]);
    for(const [mat,x,z,sx,sz]of [[solarPaving,-24,5,22,3],[voidPaving,24,-8,22,3],[hydroPaving,-25,-26,12,2],[hydroPaving,21,-26,17,2],[servicePaving,-2,18,18,2],[servicePaving,7,24,4,2]]as const)
      add("connector-paving",mat,[x,.002,z,sx,.003,sz]);
    for(const [x,z,sx,sz]of [[-24,3.6,20,.07],[24,-6.6,20,.07],[-3,-29.1,32,.07],[-2,17.1,18,.07]])
      add("route-inlay",ivory,[x,.009,z,sx,.008,sz]);
    // Contact bands are thin opaque inlays at the base of actual solids, not
    // transparent shadow planes spanning entrances or new walkable obstacles.
    for(const s of PG_MAP.solids)if(s.kind!=="floor"&&s.kind!=="stair"&&s.center.y-s.half.y<.05){
      const c=s.center,h=s.half;
      add("contact-footprint",trim,[c.x,.006,c.z,h.x*2+.14,.008,h.z*2+.14]);
    }
    this.buildHydroFoliage();
    // Flat paving bands, expansion joints and route identity; no extra collision.
    for(let x=-44;x<=44;x+=4) add("deck-joints",trim,[x,.006,0,.018,.01,74],this.detail);
    for(let z=-36;z<=36;z+=4) add("deck-joints",trim,[0,.006,z,90,.01,.018],this.detail);
    for(const z of [-35,35])add("perimeter",amber,[0,.016,z,90,.018,.13]);
    for(const x of [-44,44])add("perimeter",amber,[x,.016,0,.13,.018,70]);
    for(const [x,z,sx,sz]of [[-40,0,2,56],[40,0,2,56],[0,-27,29,2],[0,17,22,2]])
      {
        const alongX=sx>sz;
        for(const side of[-1,1])add("wayfinding-edge",ivory,[x+(alongX?0:side*sx*.5),.012,z+(alongX?side*sz*.5:0),alongX?sx:.045,.008,alongX?.045:sz]);
      }
    // Underside structure and distant station are clearly beyond the playable deck.
    add("foundation",trim,[0,-2.7,0,88,4.4,72]);
    for(const x of [-34,0,34])add("foundation-lights",cyan,[x,-3.8,36.01,13,.12,.03]);
    for(let i=0;i<9;i++) {
      const x=-120+i*30,z=-110-Math.sin(i*1.7)*20,height=12+(i%3)*9;
      add("skyline",deck,[x,height/2-8,z,10,height,12],this.skyline);
      add("skyline-lights",violet,[x,height-9,z+6.01,8,.5,.03],this.skyline);
    }
    const planetGeometry=new THREE.SphereGeometry(82,32,18);
    const planetMaterial=new THREE.MeshBasicMaterial({color:0x345e86,fog:false});
    const planet=new THREE.Mesh(planetGeometry,planetMaterial);planet.position.set(80,-40,-210);planet.name="distant-planet";
    this.resources.add(planetGeometry);this.resources.add(planetMaterial);this.root.add(planet);
    const atmosphereGeometry=new THREE.TorusGeometry(83,.9,5,80);
    const atmosphereMaterial=new THREE.MeshBasicMaterial({color:0x6bafd5,transparent:true,opacity:.5,fog:false,depthWrite:false,blending:THREE.AdditiveBlending});
    const atmosphere=new THREE.Mesh(atmosphereGeometry,atmosphereMaterial);atmosphere.position.copy(planet.position);atmosphere.lookAt(0,0,0);
    this.resources.add(atmosphereGeometry);this.resources.add(atmosphereMaterial);this.root.add(atmosphere);
    this.buildOrbitalBackdrop();
    this.buildLabels();
    // A lightweight open hologram above the collision-backed transit console.
    const ringGeometry = new THREE.TorusGeometry(1.45,.018,4,48);
    const holo = new THREE.MeshBasicMaterial({color:0x6cffe4,transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending});
    this.resources.add(ringGeometry); this.resources.add(holo);
    for(let i=0;i<3;i++){const ring=new THREE.Mesh(ringGeometry,holo);ring.rotation.set(i*.7,0,i*.45);this.hologram.add(ring);}
    this.hologram.position.set(-2,5.8,-7);
    this.hologram.userData.cameraCollision=false;
    for(const [key,batch]of this.batches){
      const mesh=new THREE.InstancedMesh(this.geometry,batch.material,batch.boxes.length),matrix=new THREE.Matrix4();
      batch.boxes.forEach(([x,y,z,sx,sy,sz],i)=>{matrix.makeScale(sx,sy,sz);matrix.setPosition(x,y,z);mesh.setMatrixAt(i,matrix);});
      mesh.name=key;mesh.receiveShadow=true;mesh.castShadow=key.startsWith("body-");mesh.computeBoundingSphere();batch.parent.add(mesh);
    }
    this.batches.clear();
    this.root.traverse(o=>{o.userData.cameraCollision=false;});
    this.setQuality("medium");
  }

  private buildOrbitalBackdrop():void {
    // A single star draw plus two ring draws: visible from player height and
    // retained on Low. No depth-tested scenery enters the gameplay arena.
    const positions:number[]=[];
    for(let i=0;i<170;i++){
      const az=i*2.39996323,el=.08+(i%37)/37*1.2,r=260;
      positions.push(Math.cos(az)*Math.cos(el)*r,Math.sin(el)*r,Math.sin(az)*Math.cos(el)*r);
    }
    const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
    const m=new THREE.PointsMaterial({color:0xa9c4df,size:.55,sizeAttenuation:true,fog:false});
    const stars=new THREE.Points(g,m);stars.name="orbital-starfield";this.root.add(stars);this.resources.add(g);this.resources.add(m);
    for(const [radius,color,tube]of [[115,0x45647d,1.2],[117,0x82c5db,.16]]){
      const geometry=new THREE.TorusGeometry(radius,tube,4,96,Math.PI*1.3);
      const material=new THREE.MeshBasicMaterial({color,fog:false});
      const ring=new THREE.Mesh(geometry,material);ring.name="distant-station-arc";ring.position.set(-55,-42,170);ring.rotation.set(.25,.35,.15);
      this.root.add(ring);this.resources.add(geometry);this.resources.add(material);
    }
  }
  private buildLabels():void {
    if(typeof document==="undefined")return;
    for(const [text,x,y,z,color]of [["SOLAR / HABITAT 01",-25,2.35,-20.515,"#ffd5a1"],["VOID / OBSERVATORY",27,2.35,26.515,"#d9c5ff"],["HYDROPONICS  /  ION RUN",-6,4.45,-30.565,"#a1ffe2"],["NOVA BLOCK / TRANSIT",-2,1.6,-9.065,"#a1ffe2"],["ION SERVICE / 04",12.60,4.32,25,"#a1ffe2"],["MAINTENANCE / 03",-5,2.25,29.435,"#ffe3a3"]] as const){
      const canvas=document.createElement("canvas");canvas.width=1024;canvas.height=128;const ctx=canvas.getContext("2d");if(!ctx)continue;
      ctx.fillStyle="#10232d";ctx.fillRect(0,0,1024,128);ctx.fillStyle=color;ctx.font="600 54px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(text,512,64);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
      const mat=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});const width=text.startsWith("MAINTENANCE")?3.6:text.startsWith("NOVA")?5:9;const geometry=new THREE.PlaneGeometry(width,width/8);
      const mesh=new THREE.Mesh(geometry,mat);mesh.name=`district-sign:${text}`;mesh.position.set(x,y,z);if(text.startsWith("ION"))mesh.rotation.y=-Math.PI/2;if(text.startsWith("VOID")||text.startsWith("NOVA"))mesh.rotation.y=Math.PI;
      this.resources.add(texture);this.resources.add(mat);this.resources.add(geometry);this.root.add(mesh);
    }
  }
  private buildHydroFoliage():void{
    const leaves: {x:number;y:number;z:number;angle:number}[]=[];
    for(const s of PG_MAP.solids.filter(s=>s.kind==="planter"))for(let x=-s.half.x+.45;x<s.half.x-.45;x+=.65)for(let z=-s.half.z+.35;z<s.half.z-.35;z+=.6)
      for(let leaf=0;leaf<4;leaf++){const angle=leaf*Math.PI/2;leaves.push({x:s.center.x+x+Math.sin(angle)*.09,y:s.center.y+s.half.y+.04,z:s.center.z+z+Math.cos(angle)*.09,angle});}
    const geometry=new THREE.SphereGeometry(1,6,4),mat=new THREE.MeshStandardMaterial({color:0x8dcf83,roughness:.9,emissive:0x33562c,emissiveIntensity:.15});
    this.resources.add(geometry);this.resources.add(mat);
    const mesh=new THREE.InstancedMesh(geometry,mat,leaves.length),dummy=new THREE.Object3D(),color=new THREE.Color();mesh.name="hydroponic-low-rosettes";
    leaves.forEach((leaf,i)=>{dummy.position.set(leaf.x,leaf.y,leaf.z);dummy.rotation.y=leaf.angle;dummy.scale.set(.105,.035,.2);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);color.setHex(i%3===0?0xa8cb6c:i%3===1?0x73bb91:0x9bc59b);mesh.setColorAt(i,color);});
    mesh.computeBoundingSphere();this.root.add(mesh);
  }
  setQuality(quality:Quality):void {this.detail.visible=quality!=="low";this.skyline.visible=quality!=="low";this.hologram.visible=quality!=="low";this.root.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.castShadow=quality==="high"&&o.name.startsWith("body-");});}
  update(time:number):void {if(Number.isFinite(time))this.hologram.rotation.y=time*.00016;}
  dispose():void {if(this.disposed)return;this.disposed=true;for(const resource of this.resources)resource.dispose();this.resources.clear();this.root.clear();}
}
