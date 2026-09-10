import RAPIER from "@dimforge/rapier3d-compat";
import { BR_BALANCE, BR_ISLAND_OUTLINE, BR_MAP_BLOCKS, brBlocksNear, isInsideBrIsland, type BrCollisionResult, type Vec3 } from "@planetfall/shared";

await RAPIER.init();

const STANDING_HALF_HEIGHT=Math.max(.02,(BR_BALANCE.playerHeight-BR_BALANCE.playerRadius*2)/2);
const CROUCHED_HALF_HEIGHT=.06;
const centerY=(crouched:boolean)=>BR_BALANCE.playerRadius+(crouched?CROUCHED_HALF_HEIGHT:STANDING_HALF_HEIGHT);

/** One-character Rapier prediction world built from the exact authoritative collider schema. */
export class BrPredictionPhysics {
  readonly world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  private body: RAPIER.RigidBody;
  private collider: RAPIER.Collider;
  private controller: RAPIER.KinematicCharacterController;
  private crouched=false;

  constructor() {
    const vertices = new Float32Array((BR_ISLAND_OUTLINE.length + 1) * 3); vertices.set([0,0,0]);
    BR_ISLAND_OUTLINE.forEach(([x,z],index) => vertices.set([x,0,z],(index+1)*3));
    const indices = new Uint32Array(BR_ISLAND_OUTLINE.length * 3);
    for(let index=0;index<BR_ISLAND_OUTLINE.length;index++) indices.set([0,(index+1)%BR_ISLAND_OUTLINE.length+1,index+1],index*3);
    this.world.createCollider(RAPIER.ColliderDesc.trimesh(vertices,indices));
    for(const block of BR_MAP_BLOCKS){const collider=RAPIER.ColliderDesc.cuboid(block.size.x/2,block.size.y/2,block.size.z/2).setTranslation(block.position.x,block.position.y,block.position.z);if(block.rotation)collider.setRotation(eulerQuaternion(block.rotation));this.world.createCollider(collider);}
    this.body=this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    this.collider=this.world.createCollider(RAPIER.ColliderDesc.capsule(STANDING_HALF_HEIGHT,BR_BALANCE.playerRadius).setFriction(0),this.body);
    this.controller=this.world.createCharacterController(.035); this.controller.enableAutostep(.52,.22,false); this.controller.enableSnapToGround(.18); this.controller.setSlideEnabled(true); this.controller.setMaxSlopeClimbAngle(Math.PI*.32);
    this.world.step();
  }

  move(feet:Vec3,desiredMovement:Vec3,jumping:boolean,crouched=false):BrCollisionResult {
    const next={x:feet.x+desiredMovement.x,y:feet.y+desiredMovement.y,z:feet.z+desiredMovement.z};if(!jumping&&feet.y>=-.08&&desiredMovement.y<=0&&next.y<=.02&&isInsideBrIsland(next)&&brBlocksNear(next,1.25).length===0)return{movement:{x:desiredMovement.x,y:-feet.y,z:desiredMovement.z},grounded:true,ceiling:false};
    const surfaceRecovery=!jumping&&desiredMovement.y<=0&&feet.y>=-.35&&feet.y<=.16&&isInsideBrIsland(feet);const start=surfaceRecovery?{...feet,y:0}:feet;
    if(this.crouched!==crouched){this.crouched=crouched;this.collider.setHalfHeight(crouched?CROUCHED_HALF_HEIGHT:STANDING_HALF_HEIGHT);}
    this.body.setTranslation({x:start.x,y:start.y+centerY(this.crouched),z:start.z},true);
    if(jumping)this.controller.disableSnapToGround();else this.controller.enableSnapToGround(.18);
    this.controller.computeColliderMovement(this.collider,desiredMovement,undefined,undefined,(collider)=>collider.parent()===null);
    const movement=this.controller.computedMovement();
    if(jumping&&Math.hypot(movement.x,movement.z)<Math.hypot(desiredMovement.x,desiredMovement.z)*.45){const mantle=brBlocksNear(next,BR_BALANCE.playerRadius).filter((block)=>block.kind==="cover"||block.kind==="wall").map((block)=>block.position.y+block.size.y/2).filter((top)=>top-feet.y>.35&&top-feet.y<=BR_BALANCE.mantleHeight+.4).sort((a,b)=>a-b)[0];if(mantle!==undefined)return{movement:{x:desiredMovement.x,y:mantle-feet.y+.03,z:desiredMovement.z},grounded:false,ceiling:false};}
    const correctionY=start.y-feet.y;this.body.setTranslation({x:feet.x+movement.x,y:feet.y+movement.y+correctionY+centerY(this.crouched),z:feet.z+movement.z},true);
    return {movement:{x:movement.x,y:movement.y+correctionY,z:movement.z},grounded:surfaceRecovery||this.controller.computedGrounded(),ceiling:false};
  }

  reset(feet:Vec3={x:0,y:0,z:0}):void { this.crouched=false;this.collider.setHalfHeight(STANDING_HALF_HEIGHT);this.body.setTranslation({x:feet.x,y:feet.y+centerY(false),z:feet.z},true); }
  dispose():void { this.world.removeCharacterController(this.controller); this.world.free(); }
}

function eulerQuaternion(rotation:Vec3):{x:number;y:number;z:number;w:number}{const cx=Math.cos(rotation.x/2),sx=Math.sin(rotation.x/2),cy=Math.cos(rotation.y/2),sy=Math.sin(rotation.y/2),cz=Math.cos(rotation.z/2),sz=Math.sin(rotation.z/2);return{x:sx*cy*cz-cx*sy*sz,y:cx*sy*cz+sx*cy*sz,z:cx*cy*sz-sx*sy*cz,w:cx*cy*cz+sx*sy*sz};}
