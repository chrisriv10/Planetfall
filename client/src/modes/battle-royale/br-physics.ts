import RAPIER from "@dimforge/rapier3d-compat";
import { BR_BALANCE, BR_ISLAND_OUTLINE, brBlocksForPhysicsSector, brHasStandingClearance, brMantleTopAt, brPhysicsSector, type BrCollisionResult, type BrMapBlock, type Vec3 } from "@planetfall/shared";

await RAPIER.init();

const STANDING_HALF_HEIGHT=Math.max(.02,(BR_BALANCE.playerHeight-BR_BALANCE.playerRadius*2)/2);
const CROUCHED_HALF_HEIGHT=.06;
const CONTACT_EPSILON=.004;
const centerY=(crouched:boolean)=>BR_BALANCE.playerRadius+(crouched?CROUCHED_HALF_HEIGHT:STANDING_HALF_HEIGHT);
const downwardContact=(desired:Vec3,actual:Vec3)=>desired.y<=0&&actual.y>desired.y+CONTACT_EPSILON;

/** One-character Rapier prediction world built from the exact authoritative collider schema. */
export class BrPredictionPhysics {
  private readonly sectors=new Map<string,MovementSector>();

  constructor() {
    // Sectors are built lazily. Prediction uses the same overlap and collider
    // schema as authority while avoiding 1,000 static shapes per movement query.
  }

  move(feet:Vec3,desiredMovement:Vec3,jumping:boolean,crouched=false):BrCollisionResult {
    const sector=this.sector(feet);const actualCrouch=crouched||!brHasStandingClearance(feet);
    if(sector.crouched!==actualCrouch){sector.crouched=actualCrouch;sector.collider.setHalfHeight(actualCrouch?CROUCHED_HALF_HEIGHT:STANDING_HALF_HEIGHT);}
    sector.collider.setTranslation({x:feet.x,y:feet.y+centerY(actualCrouch),z:feet.z});
    if(jumping)sector.controller.disableSnapToGround();else sector.controller.enableSnapToGround(.18);
    sector.controller.computeColliderMovement(sector.collider,desiredMovement,undefined,undefined,(collider)=>collider.handle!==sector.collider.handle);
    const movement=sector.controller.computedMovement();
    if(jumping&&Math.hypot(movement.x,movement.z)<Math.hypot(desiredMovement.x,desiredMovement.z)*.45){const mantle=brMantleTopAt(feet,desiredMovement);if(mantle!==null)return{movement:{x:desiredMovement.x,y:mantle-feet.y+.03,z:desiredMovement.z},grounded:false,ceiling:false,crouched:false};}
    sector.collider.setTranslation({x:feet.x+movement.x,y:feet.y+movement.y+centerY(actualCrouch),z:feet.z+movement.z});
    return {movement:{x:movement.x,y:movement.y,z:movement.z},grounded:!jumping&&(sector.controller.computedGrounded()||downwardContact(desiredMovement,movement)),ceiling:desiredMovement.y>0&&movement.y<desiredMovement.y-.01,crouched:actualCrouch};
  }

  reset(feet:Vec3={x:0,y:0,z:0}):void {for(const sector of this.sectors.values()){sector.crouched=false;sector.collider.setHalfHeight(STANDING_HALF_HEIGHT);sector.collider.setTranslation({x:feet.x,y:feet.y+centerY(false),z:feet.z});}}
  dispose():void {for(const sector of this.sectors.values()){sector.world.removeCharacterController(sector.controller);sector.world.free();}this.sectors.clear();}

  private sector(position:Vec3):MovementSector{const key=brPhysicsSector(position).key;let sector=this.sectors.get(key);if(sector)return sector;const world=new RAPIER.World({x:0,y:0,z:0});addIsland(world);addBlocks(world,brBlocksForPhysicsSector(position));const collider=world.createCollider(RAPIER.ColliderDesc.capsule(STANDING_HALF_HEIGHT,BR_BALANCE.playerRadius).setFriction(0));const controller=world.createCharacterController(.035);controller.enableAutostep(.52,.22,false);controller.enableSnapToGround(.18);controller.setSlideEnabled(true);controller.setMaxSlopeClimbAngle(Math.PI*.32);world.step();sector={world,collider,controller,crouched:false};this.sectors.set(key,sector);return sector;}
}

type MovementSector={world:RAPIER.World;collider:RAPIER.Collider;controller:RAPIER.KinematicCharacterController;crouched:boolean};
function addIsland(world:RAPIER.World):void{const vertices=new Float32Array((BR_ISLAND_OUTLINE.length+1)*3);vertices.set([0,0,0]);BR_ISLAND_OUTLINE.forEach(([x,z],index)=>vertices.set([x,0,z],(index+1)*3));const indices=new Uint32Array(BR_ISLAND_OUTLINE.length*3);for(let index=0;index<BR_ISLAND_OUTLINE.length;index++)indices.set([0,(index+1)%BR_ISLAND_OUTLINE.length+1,index+1],index*3);world.createCollider(RAPIER.ColliderDesc.trimesh(vertices,indices));}
function addBlocks(world:RAPIER.World,blocks:readonly BrMapBlock[]):void{for(const block of blocks){const collider=RAPIER.ColliderDesc.cuboid(block.size.x/2,block.size.y/2,block.size.z/2).setTranslation(block.position.x,block.position.y,block.position.z);if(block.rotation)collider.setRotation(eulerQuaternion(block.rotation));world.createCollider(collider);}}

function eulerQuaternion(rotation:Vec3):{x:number;y:number;z:number;w:number}{const cx=Math.cos(rotation.x/2),sx=Math.sin(rotation.x/2),cy=Math.cos(rotation.y/2),sy=Math.sin(rotation.y/2),cz=Math.cos(rotation.z/2),sz=Math.sin(rotation.z/2);return{x:sx*cy*cz-cx*sy*sz,y:cx*sy*cz+sx*cy*sz,z:cx*cy*sz-sx*sy*cz,w:cx*cy*cz+sx*sy*sz};}
