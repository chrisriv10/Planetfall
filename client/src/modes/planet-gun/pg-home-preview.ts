import * as THREE from "three";
import {homeIslandLayout} from "../../home-island-layout";
import {PgWorldRenderer} from "./pg-world";
import {PG_HOME_COMPOSITION,pgHomeAmbientTime} from "./pg-home-composition";

/** A miniature of the actual arena. Uses the established home camera composition. */
export class PgHomePreview {
  readonly root=new THREE.Group();
  private readonly world=new PgWorldRenderer();
  private readonly camera=new THREE.PerspectiveCamera(58,1,.1,500);
  private readonly forward=new THREE.Vector3();
  private readonly right=new THREE.Vector3();
  private readonly up=new THREE.Vector3();
  private readonly reduced=typeof matchMedia!=="undefined"?matchMedia("(prefers-reduced-motion: reduce)"):null;
  private disposed=false;
  constructor(){
    this.root.name="planet-gun-home-preview";this.world.setQuality("low");this.root.add(this.world.root);
    // Keep the established home backdrop, with world-up architecture in a fixed shot.
    for(const name of ["neighborhood-planet","planet-atmospheric-limb"]){
      const backdrop=this.world.root.getObjectByName(name);if(backdrop)backdrop.visible=false;
    }
  }
  update(time:number,aspect:number):void{
    if(this.disposed)return;
    const width=typeof innerWidth==="number"?innerWidth:1280,height=typeof innerHeight==="number"?innerHeight:width/Math.max(.4,aspect);
    const card=typeof document!=="undefined"?document.querySelector<HTMLElement>("#home-screen .home-card")?.getBoundingClientRect():undefined;
    const layout=homeIslandLayout(width,height,card?.right??width*.46);
    this.camera.aspect=aspect;
    if(width<820){this.camera.position.set(0,8,36);this.camera.lookAt(0,2,0);}else{this.camera.position.set(20,10,32);this.camera.lookAt(0,0,-4);}
    this.camera.updateMatrixWorld();this.camera.getWorldDirection(this.forward);
    this.right.setFromMatrixColumn(this.camera.matrixWorld,0);this.up.setFromMatrixColumn(this.camera.matrixWorld,1);
    const distance=PG_HOME_COMPOSITION.distance,worldWidth=2*distance*Math.tan(THREE.MathUtils.degToRad(29))*aspect;
    this.root.position.copy(this.camera.position).addScaledVector(this.forward,distance).addScaledVector(this.right,layout.centerX*worldWidth/2).addScaledVector(this.up,layout.centerY*worldWidth/(2*aspect));
    this.root.scale.setScalar(worldWidth*layout.radiusFraction/PG_HOME_COMPOSITION.referenceRadius);
    this.world.root.rotation.y=PG_HOME_COMPOSITION.yaw;
    this.world.root.rotation.x=PG_HOME_COMPOSITION.pitch;
    this.root.visible=width>=760;
    this.world.update(pgHomeAmbientTime(time,this.reduced?.matches??false));
  }
  dispose():void{if(this.disposed)return;this.disposed=true;this.world.dispose();this.root.clear();this.root.removeFromParent();}
}
