import {describe,expect,it} from "vitest";
import * as THREE from "three";
import {PG_WEAPONS} from "@planetfall/shared";
import {createPgViewmodel,PG_VIEWMODEL_LAYER} from "./pg-viewmodel";
import {PG_RELOAD_PROFILES,type PgPresentationWeapon} from "./pg-reload-art";
import {createPgSleeveGeometry,extendPgSleeveElbow,pgSleeveRadius,routePgAdsElbow} from "./pg-viewmodel-arm-art";

describe("camera-safe first-person sleeve span",()=>{
  it("keeps hip routing unchanged and routes support and trigger elbows toward distinct lower corners",()=>{
    for(const side of [-1,1]as const){
      const elbow=new THREE.Vector3(side*.2,-.19,.1),initial=elbow.clone();
      expect(routePgAdsElbow(elbow,side,0)).toBe(elbow);expect(elbow).toEqual(initial);
      routePgAdsElbow(elbow,side,1);expect(elbow.x).toBeCloseTo(side<0?-.38:.34);expect(elbow.y).toBeCloseTo(side<0?-.26:-.30);expect(elbow.z).toBe(.1);
      for(const ads of [0,.1,.5,.9,1]){
        const radius=pgSleeveRadius(ads);expect(radius).toBeGreaterThanOrEqual(.048);expect(radius).toBeLessThanOrEqual(.055);
      }
    }
  });
  it("gives the sleeve a rounded forearm belly, narrow wrist, and a bounded oval section",()=>{
    const geometry=createPgSleeveGeometry();
    try{
      const position=geometry.getAttribute("position"),normal=geometry.getAttribute("normal");
      let wristRadius=0,bellyRadius=0;
      for(let i=0;i<position.count;i++){
        const x=position.getX(i),y=position.getY(i),z=position.getZ(i),r=Math.hypot(x,z);
        expect(r).toBeLessThanOrEqual(1.000001);
        expect(y).toBeGreaterThanOrEqual(-.5);expect(y).toBeLessThanOrEqual(.5);
        expect(Math.abs(z)).toBeLessThanOrEqual(.840001);
        expect(Number.isFinite(normal.getX(i)+normal.getY(i)+normal.getZ(i))).toBe(true);
        if(y>.49)wristRadius=Math.max(wristRadius,r);
        if(y>.1&&y<.3)bellyRadius=Math.max(bellyRadius,r);
      }
      expect(wristRadius).toBeCloseTo(.70);expect(bellyRadius).toBeCloseTo(1);
      expect(geometry.index!.count/3).toBeLessThan(400);
    }finally{geometry.dispose();}
  });
  for(const weapon of Object.keys(PG_RELOAD_PROFILES)as PgPresentationWeapon[])it(`${weapon} keeps both sleeves visible while leaving the central ADS aim corridor clear`,()=>{
    const vm=createPgViewmodel(),camera=new THREE.PerspectiveCamera(PG_WEAPONS[weapon].adsFov,16/9,.01,10);
    try{
      for(let frame=0;frame<180;frame++)vm.update({weapon,ads:1,reload:0,recoil:0,speed:0,mode:"ground",time:frame*16});
      vm.root.updateMatrixWorld(true);
      const sleeves:THREE.Object3D[]=[];
      vm.root.traverseVisible(o=>{if(o.name==="astronaut-sleeve")sleeves.push(o);});
      const ray=new THREE.Raycaster(),point=new THREE.Vector2();ray.layers.set(PG_VIEWMODEL_LAYER);
      let covered=0,minX=1,maxX=-1,minY=1,maxY=-1;const visibleSleeves=new Set<THREE.Object3D>();
      // Screen-space sampling measures the rendered silhouette, including camera
      // FOV and rig transforms; no assumptions about the helper's own math.
      for(let y=0;y<45;y++)for(let x=0;x<80;x++){
        point.set((x+.5)/40-1,(y+.5)/22.5-1);ray.setFromCamera(point,camera);
        const hits=ray.intersectObjects(sleeves,false),hit=hits.length>0;
        if(hit){covered++;minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);}
        for(const intersection of hits)visibleSleeves.add(intersection.object);
        if(Math.abs(point.x)<.1&&point.y>-.1&&point.y<.2)expect(hit).toBe(false);
      }
      expect(visibleSleeves.size).toBe(2);
      expect(covered/(80*45),`${weapon} sleeve viewport fraction`).toBeLessThan(.075);
      // Screen area is diagnostic, not an aesthetic acceptance threshold: the
      // rejected straight tubes occupied little screen space but looked wrong.
      if(process.env.PG_ARM_REPORT)console.info(JSON.stringify({weapon,fov:camera.fov,coverage:covered/(80*45),ndcExtent:[minX,minY,maxX,maxY]}));
    }finally{vm.dispose();}
  });
  it("extends the exposed Photon elbow without moving its wrist or changing its axis",()=>{
    const wrist=new THREE.Vector3(-.07,-.034,-1.12*.34),originalWrist=wrist.clone();
    const elbow=new THREE.Vector3(-.20,-.19,.10),originalAxis=elbow.clone().sub(wrist).normalize();
    const rig=new THREE.Matrix4().makeTranslation(0,-.215*.34,-.49);
    expect(extendPgSleeveElbow(wrist,elbow,rig)).toBe(elbow);
    expect(wrist).toEqual(originalWrist);
    expect(elbow.clone().sub(wrist).normalize().distanceTo(originalAxis)).toBeLessThan(1e-12);
    expect(elbow.clone().applyMatrix4(rig).z).toBeCloseTo(.065,12);
    const extended=elbow.clone();extendPgSleeveElbow(wrist,elbow,rig);expect(elbow.distanceTo(extended)).toBeLessThan(1e-12);
  });
  for(const weapon of Object.keys(PG_RELOAD_PROFILES)as PgPresentationWeapon[])it(`${weapon} hides both sleeve caps at its actual ADS FOV, including recoil and reload poses`,()=>{
    const vm=createPgViewmodel(),camera=new THREE.PerspectiveCamera(PG_WEAPONS[weapon].adsFov,16/9,.01,10);
    const frustum=new THREE.Frustum().setFromProjectionMatrix(camera.projectionMatrix);
    try{
      let time=0;
      for(const [ads,reload,recoil]of [[1,0,0],[1,0,1],[1,.45,0],[0,.45,0]]){
        for(let frame=0;frame<90;frame++)vm.update({weapon,ads,reload,recoil,speed:0,mode:"ground",time:time+=16});
        vm.root.updateMatrixWorld(true);
        for(const name of ["support-forearm","trigger-forearm"]){
          const group=vm.root.getObjectByName(name)!,sleeve=group.getObjectByName("astronaut-sleeve")as THREE.Mesh;
          const wrist=group.children.find(o=>o.name.endsWith("-glove"))!.position.clone(),before=wrist.clone();
          const oldAxis=new THREE.Vector3(0,1,0).applyQuaternion(sleeve.quaternion);
          const elbow=sleeve.position.clone().addScaledVector(oldAxis,-sleeve.scale.y*.5);
          expect(wrist).toEqual(before);
          const axis=wrist.clone().sub(elbow).normalize(),rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),axis);
          for(let segment=0;segment<32;segment++){
            const a=segment*Math.PI/16,cap=new THREE.Vector3(Math.cos(a)*sleeve.scale.x,0,Math.sin(a)*sleeve.scale.z).applyQuaternion(rotation).add(elbow).applyMatrix4(group.matrixWorld);
            expect(cap.z).toBeGreaterThan(0);expect(frustum.containsPoint(cap)).toBe(false);
          }
        }
      }
    }finally{vm.dispose();}
  });
});
