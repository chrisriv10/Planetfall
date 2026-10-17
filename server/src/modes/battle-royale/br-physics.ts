import RAPIER from "@dimforge/rapier3d-compat";
import {brVehicleCollisionHulls,brNearVehicleHull,type BrVehicleState} from "@planetfall/shared";
import { BR_LANDFORMS, brLandformsNear, brControllerGrounded } from "@planetfall/shared";
import { BR_BASE_DECK_CELLS, brBaseDeckPolygons, brTriangulateDeckPolygon, brConstrainBaseDeckMovement, brInteriorStairSubsteps, brInteriorStairProbeY } from "@planetfall/shared";
import { BR_BALANCE, BR_ISLAND_OUTLINE, BR_MAP_BLOCKS, brBlocksForPhysicsSector, brFlatDeckCollision, brHasStandingClearance, brMantleTopAt, brPhysicsSector, isInsideBrIsland, type BrCollisionResult, type BrMapBlock, type Vec3 } from "@planetfall/shared";

await RAPIER.init();

const STANDING_HALF_HEIGHT=Math.max(.02,(BR_BALANCE.playerHeight-BR_BALANCE.playerRadius*2)/2);
const CROUCHED_HALF_HEIGHT=.06;
const CONTACT_EPSILON=.004;
const centerY=(crouched:boolean)=>BR_BALANCE.playerRadius+(crouched?CROUCHED_HALF_HEIGHT:STANDING_HALF_HEIGHT);
const downwardContact=(desired:Vec3,actual:Vec3)=>desired.y<=0&&actual.y>desired.y+CONTACT_EPSILON;

/** Rapier collision world used by authoritative BR movement. Gameplay positions are capsule feet. */
export class BrPhysicsWorld {
  private vehicles:readonly BrVehicleState[]=[];
  private vehicleStamp:Array<{id:string;x:number;y:number;z:number;yaw:number}>=[];
  private readonly vehicleWorlds=new Map<RAPIER.World,{center?:Vec3;entries:Map<string,{colliders:RAPIER.Collider[];x:number;y:number;z:number;yaw:number;enabled:boolean}>}>();
  private readonly rayWorld=new RAPIER.World({x:0,y:0,z:0});
  private readonly sectors=new Map<string,MovementSector>();

  constructor(){
    addIsland(this.rayWorld); addBlocks(this.rayWorld,BR_MAP_BLOCKS); addLandforms(this.rayWorld,BR_LANDFORMS); this.rayWorld.step();
    this.registerVehicleWorld(this.rayWorld);
  }

  ensureCharacter(_id:string,feet:Vec3):void {this.sector(feet);}
  teleport(_id:string,feet:Vec3):void {this.sector(feet).collider.setTranslation({x:feet.x,y:feet.y+centerY(false),z:feet.z});}

  move(id:string,feet:Vec3,desiredMovement:Vec3,jumping:boolean,crouched=false):BrCollisionResult {
    const flat=brNearVehicleHull(feet,desiredMovement,this.vehicles)?null:brFlatDeckCollision(feet,desiredMovement,jumping);if(flat)return{...flat,crouched};
    const steps=brInteriorStairSubsteps(feet,desiredMovement,jumping);
    if(steps>1){
      let position={...feet},grounded=false,ceiling=false,actualCrouch=crouched;
      const desired={x:desiredMovement.x/steps,y:desiredMovement.y/steps,z:desiredMovement.z/steps};
      for(let step=0;step<steps;step++){
        const result=this.move(id,position,{...desired,y:brInteriorStairProbeY(position,desired)},jumping,actualCrouch);
        position={x:position.x+result.movement.x,y:position.y+result.movement.y,z:position.z+result.movement.z};
        grounded=result.grounded;ceiling ||= result.ceiling;actualCrouch=result.crouched??actualCrouch;
      }
      return{movement:{x:position.x-feet.x,y:position.y-feet.y,z:position.z-feet.z},grounded,ceiling,crouched:actualCrouch};
    }
    const sector=this.sector(feet);
    // Standing pilots already have a valid full-height capsule. The old path
    // rescanned nearby map blocks for head clearance on every server tick,
    // for every one of forty pilots. Only a capsule that is actually crouched
    // needs the clearance query before expanding again.
    const actualCrouch=crouched||(sector.crouched&&!brHasStandingClearance(feet));
    if(sector.crouched!==actualCrouch){sector.crouched=actualCrouch;sector.collider.setHalfHeight(actualCrouch?CROUCHED_HALF_HEIGHT:STANDING_HALF_HEIGHT);}sector.collider.setTranslation({x:feet.x,y:feet.y+centerY(actualCrouch),z:feet.z});
    if(jumping)sector.controller.disableSnapToGround();else sector.controller.enableSnapToGround(.18);sector.controller.computeColliderMovement(sector.collider,desiredMovement,undefined,undefined,(collider)=>collider.handle!==sector.collider.handle);const movement=sector.controller.computedMovement();
    if(jumping&&Math.hypot(movement.x,movement.z)<Math.hypot(desiredMovement.x,desiredMovement.z)*.45){const mantle=brMantleTopAt(feet,desiredMovement);if(mantle!==null)return{movement:{x:desiredMovement.x,y:mantle-feet.y+.03,z:desiredMovement.z},grounded:false,ceiling:false,crouched:false};}
    const next={x:feet.x+movement.x,y:feet.y+movement.y,z:feet.z+movement.z};
    const inside=isInsideBrIsland(next);const movementY=!inside&&downwardContact(desiredMovement,movement)?desiredMovement.y:brConstrainBaseDeckMovement(feet,movement);next.y=feet.y+movementY;
    sector.collider.setTranslation({x:next.x,y:next.y+centerY(actualCrouch),z:next.z});return{movement:{x:movement.x,y:movementY,z:movement.z},grounded:inside&&!jumping&&brControllerGrounded(sector.controller,desiredMovement,movement),ceiling:desiredMovement.y>0&&movementY<desiredMovement.y-.01,crouched:actualCrouch};
  }

  remove(_id:string):void { /* The query capsule is shared because BR pilots do not collide with each other. */ }
  rayDistance(origin:Vec3,direction:Vec3,maximum:number,ignoredVehicleId?:string):number {
    const ignored=ignoredVehicleId?this.vehicleWorlds.get(this.rayWorld)?.entries.get(ignoredVehicleId)?.colliders:undefined;
    return this.rayWorld.castRay(new RAPIER.Ray(origin,direction),maximum,true,undefined,undefined,undefined,undefined,collider=>!ignored?.some(own=>own.handle===collider.handle))?.timeOfImpact??maximum;
  }
  reset():void {for(const sector of this.sectors.values()){sector.crouched=false;sector.collider.setHalfHeight(STANDING_HALF_HEIGHT);sector.collider.setTranslation({x:0,y:centerY(false),z:0});}}
  dispose():void {for(const sector of this.sectors.values()){sector.world.removeCharacterController(sector.controller);sector.world.free();}this.sectors.clear();this.vehicleWorlds.clear();this.rayWorld.free();}


  setVehicles(vehicles:readonly BrVehicleState[],ignoredId:string|null=null):void {
    this.vehicles=ignoredId?vehicles.filter(vehicle=>vehicle.id!==ignoredId):vehicles;
    if(this.vehicles.length===this.vehicleStamp.length&&this.vehicles.every((vehicle,index)=>{const old=this.vehicleStamp[index];return old.id===vehicle.id&&old.x===vehicle.position.x&&old.y===vehicle.position.y&&old.z===vehicle.position.z&&old.yaw===vehicle.yaw;}))return;
    this.vehicleStamp=this.vehicles.map(vehicle=>({id:vehicle.id,...vehicle.position,yaw:vehicle.yaw}));
    for(const world of this.vehicleWorlds.keys())this.syncVehicleWorld(world);
  }
  private registerVehicleWorld(world:RAPIER.World,center?:Vec3):void {
    this.vehicleWorlds.set(world,{center,entries:new Map()});this.syncVehicleWorld(world);
  }
  private syncVehicleWorld(world:RAPIER.World):void {
    const state=this.vehicleWorlds.get(world)!;const seen=new Set<string>();let changed=false;
    for(const vehicle of this.vehicles){
      if(state.center&&(Math.abs(vehicle.position.x-state.center.x)>65||Math.abs(vehicle.position.z-state.center.z)>65))continue;
      seen.add(vehicle.id);let entry=state.entries.get(vehicle.id);
      if(!entry){
        const colliders=brVehicleCollisionHulls(vehicle.kind).map(vertices=>{
          const shape=RAPIER.ColliderDesc.convexHull(vertices);if(!shape)throw new Error("Invalid skimmer collision hull");
          return world.createCollider(shape.setFriction(.4));
        });
        entry={colliders,x:NaN,y:NaN,z:NaN,yaw:NaN,enabled:false};state.entries.set(vehicle.id,entry);
      }
      const {x,y,z}=vehicle.position;
      if(entry.enabled&&entry.x===x&&entry.y===y&&entry.z===z&&entry.yaw===vehicle.yaw)continue;
      const angle=Math.PI-vehicle.yaw,rotation={x:0,y:Math.sin(angle/2),z:0,w:Math.cos(angle/2)};
      for(const collider of entry.colliders){collider.setEnabled(true);collider.setTranslation(vehicle.position);collider.setRotation(rotation);}
      Object.assign(entry,{x,y,z,yaw:vehicle.yaw,enabled:true});changed=true;
    }
    for(const [id,entry]of state.entries)if(entry.enabled&&!seen.has(id)){for(const collider of entry.colliders)collider.setEnabled(false);entry.enabled=false;changed=true;}
    // Collider transforms need a broadphase refresh before character/ray queries.
    // Stationary vehicles do not step their query worlds again.
    if(changed)world.step();
  }

  private sector(position:Vec3):MovementSector {
    const key=brPhysicsSector(position).key;let sector=this.sectors.get(key);if(sector)return sector;
    const world=new RAPIER.World({x:0,y:0,z:0});addMovementDeck(world);addBlocks(world,brBlocksForPhysicsSector(position));addLandforms(world,brLandformsNear(brPhysicsSector(position).center,54));
    const collider=world.createCollider(RAPIER.ColliderDesc.capsule(STANDING_HALF_HEIGHT,BR_BALANCE.playerRadius).setFriction(0));
    const controller=world.createCharacterController(.035);controller.enableAutostep(.52,.22,false);controller.enableSnapToGround(.18);controller.setSlideEnabled(true);controller.setMaxSlopeClimbAngle(Math.PI*.32);this.registerVehicleWorld(world,brPhysicsSector(position).center);world.step();
    sector={world,collider,controller,crouched:false};this.sectors.set(key,sector);return sector;
  }
}

type MovementSector={world:RAPIER.World;collider:RAPIER.Collider;controller:RAPIER.KinematicCharacterController;crouched:boolean};
function addLandforms(world:RAPIER.World,landforms:typeof BR_LANDFORMS):void{for(const h of landforms)world.createCollider(RAPIER.ColliderDesc.trimesh(h.vertices,h.indices));}
function addIsland(world:RAPIER.World):void{
  const vertices:number[]=[],indices:number[]=[];
  for(const polygon of brBaseDeckPolygons(BR_ISLAND_OUTLINE)){const offset=vertices.length/3;for(const p of polygon)vertices.push(p.x,p.y,p.z);indices.push(...brTriangulateDeckPolygon(polygon).map(index=>index+offset));}
  world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(vertices),new Uint32Array(indices)));
}
function addMovementDeck(world:RAPIER.World):void{for(const c of BR_BASE_DECK_CELLS)world.createCollider(RAPIER.ColliderDesc.cuboid((c.maxX-c.minX)/2,10,(c.maxZ-c.minZ)/2).setTranslation((c.minX+c.maxX)/2,c.height-10,(c.minZ+c.maxZ)/2));}
function addBlocks(world:RAPIER.World,blocks:readonly BrMapBlock[]):void{for(const block of blocks){const collider=RAPIER.ColliderDesc.cuboid(block.size.x/2,block.size.y/2,block.size.z/2).setTranslation(block.position.x,block.position.y,block.position.z);if(block.rotation)collider.setRotation(eulerQuaternion(block.rotation));world.createCollider(collider);}}

/** Quaternion matching Three.js/Rapier's authored XYZ Euler convention. */
function eulerQuaternion(rotation:Vec3):{x:number;y:number;z:number;w:number}{const cx=Math.cos(rotation.x/2),sx=Math.sin(rotation.x/2),cy=Math.cos(rotation.y/2),sy=Math.sin(rotation.y/2),cz=Math.cos(rotation.z/2),sz=Math.sin(rotation.z/2);return{x:sx*cy*cz+cx*sy*sz,y:cx*sy*cz-sx*cy*sz,z:cx*cy*sz+sx*sy*cz,w:cx*cy*cz-sx*sy*sz};}
