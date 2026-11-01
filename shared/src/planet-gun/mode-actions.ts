import {pgValidateLoadout} from "./loadouts.js";
import type {PgModeAction} from "./modes.js";
const key=(v:unknown):v is string=>typeof v==="string"&&v.length>0&&v.length<=80&&/^[a-zA-Z0-9_:\-]+$/.test(v);
/** Copy only a recognized bounded intent. Prices, damage and client-supplied state never survive. */
export function pgValidateModeAction(raw:unknown):PgModeAction|null{
 if(!raw||typeof raw!=="object")return null;const a=raw as PgModeAction;
 if(!Number.isSafeInteger(a.sequence)||a.sequence<0||!Number.isSafeInteger(a.lifeId)||a.lifeId<0)return null;
 const base={sequence:a.sequence,lifeId:a.lifeId};
 switch(a.kind){
  case "select":{const loadout=a.loadout===undefined?undefined:pgValidateLoadout(a.loadout);return key(a.characterId)&&loadout!==null?{...base,kind:a.kind,characterId:a.characterId,...(loadout?{loadout}:{})}:null;}
  case "buy":return key(a.itemId)?{...base,kind:a.kind,itemId:a.itemId}:null;
  case "interact":return key(a.targetId)&&typeof a.held==="boolean"?{...base,kind:a.kind,targetId:a.targetId,held:a.held}:null;
  case "deploy":return key(a.socketId)?{...base,kind:a.kind,socketId:a.socketId}:null;
  case "pickup":return key(a.entityId)?{...base,kind:a.kind,entityId:a.entityId}:null;
  case "camera":return a.cameraId===null||key(a.cameraId)?{...base,kind:a.kind,cameraId:a.cameraId}:null;
  case "ability":{
   if(![0,1,2].includes(a.slot)||a.targetId!==undefined&&!key(a.targetId))return null;
   if(a.position&&![a.position.x,a.position.y,a.position.z].every(v=>Number.isFinite(v)&&Math.abs(v)<500))return null;
   return {...base,kind:a.kind,slot:a.slot,...(a.targetId?{targetId:a.targetId}:{}),...(a.position?{position:{...a.position}}:{})};
  }
  case "drone":return typeof a.control==="boolean"&&[a.moveX,a.moveZ,a.yaw,a.pitch].every(Number.isFinite)&&Math.abs(a.moveX)<=1&&Math.abs(a.moveZ)<=1&&Math.abs(a.pitch)<=1.45?{...base,kind:a.kind,control:a.control,moveX:a.moveX,moveZ:a.moveZ,yaw:a.yaw,pitch:a.pitch}:null;
  default:return null;
 }
}
