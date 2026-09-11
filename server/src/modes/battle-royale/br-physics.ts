import RAPIER from "@dimforge/rapier3d-compat";
import { BR_BALANCE, BR_ISLAND_OUTLINE, BR_MAP_BLOCKS, brBlocksNear, brHasStandingClearance, brMantleTopAt, isInsideBrIsland, type BrCollisionResult, type Vec3 } from "@planetfall/shared";

await RAPIER.init();

type Character={body:RAPIER.RigidBody;collider:RAPIER.Collider;controller:RAPIER.KinematicCharacterController;crouched:boolean};
const STANDING_HALF_HEIGHT=Math.max(.02,(BR_BALANCE.playerHeight-BR_BALANCE.playerRadius*2)/2);
const CROUCHED_HALF_HEIGHT=.06;
const centerY=(crouched:boolean)=>BR_BALANCE.playerRadius+(crouched?CROUCHED_HALF_HEIGHT:STANDING_HALF_HEIGHT);

/** Rapier collision world used by authoritative BR movement. Gameplay positions are capsule feet. */
export class BrPhysicsWorld {
  readonly world=new RAPIER.World({x:0,y:0,z:0});
  private characters=new Map<string,Character>();

  constructor(){
    const vertices=new Float32Array((BR_ISLAND_OUTLINE.length+1)*3);vertices.set([0,0,0]);BR_ISLAND_OUTLINE.forEach(([x,z],index)=>vertices.set([x,0,z],(index+1)*3));
    const indices=new Uint32Array(BR_ISLAND_OUTLINE.length*3);for(let index=0;index<BR_ISLAND_OUTLINE.length;index++)indices.set([0,(index+1)%BR_ISLAND_OUTLINE.length+1,index+1],index*3);
    this.world.createCollider(RAPIER.ColliderDesc.trimesh(vertices,indices));
    for(const block of BR_MAP_BLOCKS){const collider=RAPIER.ColliderDesc.cuboid(block.size.x/2,block.size.y/2,block.size.z/2).setTranslation(block.position.x,block.position.y,block.position.z);if(block.rotation)collider.setRotation(eulerQuaternion(block.rotation));this.world.createCollider(collider);}
    this.world.step();
  }

  ensureCharacter(id:string,feet:Vec3):void {if(this.characters.has(id)){this.teleport(id,feet);return;}const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(feet.x,feet.y+centerY(false),feet.z));const collider=this.world.createCollider(RAPIER.ColliderDesc.capsule(STANDING_HALF_HEIGHT,BR_BALANCE.playerRadius).setFriction(0),body);const controller=this.world.createCharacterController(.035);controller.enableAutostep(.52,.22,false);controller.enableSnapToGround(.18);controller.setSlideEnabled(true);controller.setMaxSlopeClimbAngle(Math.PI*.32);this.characters.set(id,{body,collider,controller,crouched:false});}
  teleport(id:string,feet:Vec3):void {const character=this.characters.get(id);if(!character)return;character.body.setTranslation({x:feet.x,y:feet.y+centerY(character.crouched),z:feet.z},true);}

  move(id:string,feet:Vec3,desiredMovement:Vec3,jumping:boolean,crouched=false):BrCollisionResult {
    const candidate={x:feet.x+desiredMovement.x,y:feet.y+desiredMovement.y,z:feet.z+desiredMovement.z};
    if(!jumping&&feet.y>=-.08&&desiredMovement.y<=0&&candidate.y<=.02&&isInsideBrIsland(candidate)&&brBlocksNear(candidate,1.25).length===0)return{movement:{x:desiredMovement.x,y:-feet.y,z:desiredMovement.z},grounded:true,ceiling:false,crouched};
    this.ensureCharacter(id,feet);const character=this.characters.get(id)!;const actualCrouch=crouched||!brHasStandingClearance(feet);if(character.crouched!==actualCrouch){character.crouched=actualCrouch;character.collider.setHalfHeight(actualCrouch?CROUCHED_HALF_HEIGHT:STANDING_HALF_HEIGHT);}const surfaceRecovery=!jumping&&desiredMovement.y<=0&&feet.y>=-.35&&feet.y<=.16&&isInsideBrIsland(feet);const start=surfaceRecovery?{...feet,y:0}:feet;this.teleport(id,start);
    if(jumping)character.controller.disableSnapToGround();else character.controller.enableSnapToGround(.18);character.controller.computeColliderMovement(character.collider,desiredMovement,undefined,undefined,(collider)=>collider.parent()===null);const movement=character.controller.computedMovement();
    if(jumping&&Math.hypot(movement.x,movement.z)<Math.hypot(desiredMovement.x,desiredMovement.z)*.45){const mantle=brMantleTopAt(feet,desiredMovement);if(mantle!==null)return{movement:{x:desiredMovement.x,y:mantle-feet.y+.03,z:desiredMovement.z},grounded:false,ceiling:false,crouched:false};}
    const correctionY=start.y-feet.y;const next={x:feet.x+movement.x,y:feet.y+movement.y+correctionY,z:feet.z+movement.z};character.body.setTranslation({x:next.x,y:next.y+centerY(character.crouched),z:next.z},true);return{movement:{x:movement.x,y:movement.y+correctionY,z:movement.z},grounded:surfaceRecovery||character.controller.computedGrounded(),ceiling:false,crouched:actualCrouch};
  }

  remove(id:string):void {const character=this.characters.get(id);if(!character)return;this.world.removeCharacterController(character.controller);this.world.removeRigidBody(character.body);this.characters.delete(id);}
  rayDistance(origin:Vec3,direction:Vec3,maximum:number):number {const hit=this.world.castRay(new RAPIER.Ray(origin,direction),maximum,true,undefined,undefined,undefined,undefined,(collider)=>collider.parent()===null);return hit?.timeOfImpact??maximum;}
  reset():void {for(const id of [...this.characters.keys()])this.remove(id);}
  dispose():void {this.reset();this.world.free();}
}

function eulerQuaternion(rotation:Vec3):{x:number;y:number;z:number;w:number}{const cx=Math.cos(rotation.x/2),sx=Math.sin(rotation.x/2),cy=Math.cos(rotation.y/2),sy=Math.sin(rotation.y/2),cz=Math.cos(rotation.z/2),sz=Math.sin(rotation.z/2);return{x:sx*cy*cz-cx*sy*sz,y:cx*sy*cz+sx*cy*sz,z:cx*cy*sz-sx*sy*cz,w:cx*cy*cz+sx*sy*sz};}
