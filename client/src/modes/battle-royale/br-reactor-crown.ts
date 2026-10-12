import * as THREE from "three";
export type BrReactorCrownResources={
 geometry:<T extends THREE.BufferGeometry>(geometry:T)=>T;box:THREE.BufferGeometry;
 dark:THREE.Material;energy:THREE.Material;orange:THREE.Material;metal:THREE.Material;
 makeTurbine?:(x:number,z:number,color:string)=>THREE.Object3D;
};
/** A centered roof emitter projects a transparent containment readout. Geometry
 * is caller-owned; invoke returned disposers once during world cleanup (safe to
 * repeat). Instanced meshes use the world's usual instance-buffer disposal. */
export function createBrReactorCrown(_color:string,r:BrReactorCrownResources){
 const group=new THREE.Group();group.name="helios-reactor-presentation";group.userData.cameraCollision=false;
 // The authored tower has two roof tiers. Mount on the upper tier, whose
 // center is offset from the main tower; the landmark parent supplies 6.45m.
 // Base underside: 42.35 + 8.4 + 6.45 = 57.2m, exactly the cap surface.
 group.position.set(2.72,8.4,-2.04);
 group.scale.set(.88,1,.88);
 const add=(name:string,material:THREE.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>{
  const m=new THREE.Mesh(r.box,material);m.name=name;m.position.set(x,y,z);m.scale.set(sx,sy,sz);group.add(m);return m;
 };
 // Low square emitter follows the tower roof rather than enclosing it in a cage.
 add("helios-projector-base",r.dark,0,43.1,0,17,1.5,17);
 add("helios-projector-deck",r.metal,0,43.95,0,15.6,.2,15.6);
 for(const [x,z] of [[-9,-9],[-9,9],[9,-9],[9,9]]){
  add("helios-projector-pylon",r.dark,x,44.35,z,1.25,4,1.25);
  add("helios-projector-cap",r.orange,x,46.4,z,1.45,.1,1.45);
 }
 for(const side of [-1,1])for(const axis of ["x","z"] as const){
  add("helios-projector-brace",r.metal,axis==="x"?0:side*9,43,axis==="z"?0:side*9,axis==="x"?18:.5,.45,axis==="z"?18:.5);
  add("helios-emitter-index",r.orange,axis==="x"?0:side*7.5,44.08,axis==="z"?0:side*7.5,axis==="x"?3.2:.08,.025,axis==="z"?3.2:.08);
 }
 const light=new THREE.PointLight(0xffd84d,7,115,1.7);light.position.y=48;group.add(light);
 const veil=new THREE.MeshBasicMaterial({color:0x43cddd,transparent:true,opacity:.009,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:true,side:THREE.DoubleSide,toneMapped:false});
 const scan=new THREE.MeshBasicMaterial({color:0x79e8f2,transparent:true,opacity:.38,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:true,side:THREE.DoubleSide,toneMapped:false});
 const plane=r.geometry(new THREE.PlaneGeometry(1,1));
 const skinMatrices:THREE.Matrix4[]=[],scanMatrices:THREE.Matrix4[]=[];
 const pose=new THREE.Object3D();
 // Six open-ended planes, not an opaque cylinder. Each is centered above its
 // matching base sector; thin broken bands imply a projected containment field.
 for(let face=0;face<6;face++){
  const angle=face*Math.PI/3,apothem=6.35,span=7.1;
  const matrix=(along:number,y:number,w:number,h:number)=>{
   pose.position.set(Math.sin(angle)*apothem+Math.cos(angle)*along,y,Math.cos(angle)*apothem-Math.sin(angle)*along);
   pose.rotation.set(0,angle,0);pose.scale.set(w,h,1);pose.updateMatrix();return pose.matrix.clone();
  };
  skinMatrices.push(matrix(0,54.6,span,19));
  for(let row=0;row<10;row++)for(const side of [-1,1])scanMatrices.push(matrix(side*1.9,45.35+row*2.05,3.1,.045));
  for(let tick=0;tick<3;tick++)scanMatrices.push(matrix(span*.43,50+tick*.48,.22,.09));
 }
 for(const [name,material,matrices]of [["helios-hologram-veil",veil,skinMatrices],["helios-hologram-scan",scan,scanMatrices]] as const){
  const batch=new THREE.InstancedMesh(plane,material,matrices.length);batch.name=name;
  matrices.forEach((m,i)=>batch.setMatrixAt(i,m));batch.instanceMatrix.needsUpdate=true;batch.computeBoundingBox();batch.computeBoundingSphere();group.add(batch);
 }
 let disposed=false;
 const dispose=()=>{if(disposed)return;disposed=true;veil.dispose();scan.dispose();};
 return {group,animated:[] as THREE.Object3D[],disposers:[dispose]};
}
