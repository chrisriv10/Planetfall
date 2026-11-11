import {PG_BALANCE as B} from "./balance.js";

/** Trusted mode policy shared by authority and prediction; never taken from input. */
export interface PgMovementRules {
 readonly lean?:boolean;
 readonly thrust:boolean;
 readonly wallRun:boolean;
 readonly slide:boolean;
 readonly mantle:boolean;
 readonly jump:boolean;
 readonly sprint:boolean;
 readonly forceCrouch:boolean;
 readonly walkSpeed:number;
 readonly crouchSpeed:number;
 readonly sprintSpeed:number;
 readonly maxSpeed:number;
}
export const PG_DEFAULT_MOVEMENT_RULES:Readonly<PgMovementRules>=Object.freeze({thrust:true,wallRun:true,slide:true,mantle:true,jump:true,sprint:true,forceCrouch:false,walkSpeed:B.runSpeed,crouchSpeed:B.crouchSpeed,sprintSpeed:B.sprintSpeed,maxSpeed:B.maxSpeed});
export const PG_TACTICAL_MOVEMENT_RULES:Readonly<PgMovementRules>=Object.freeze({...PG_DEFAULT_MOVEMENT_RULES,thrust:false,wallRun:false,slide:false,walkSpeed:4.5,crouchSpeed:2.5,sprintSpeed:6,maxSpeed:6});
export const PG_SIEGE_MOVEMENT_RULES:Readonly<PgMovementRules>=Object.freeze({...PG_TACTICAL_MOVEMENT_RULES,lean:true});
export const PG_DOWNED_MOVEMENT_RULES:Readonly<PgMovementRules>=Object.freeze({...PG_TACTICAL_MOVEMENT_RULES,mantle:false,jump:false,sprint:false,forceCrouch:true,walkSpeed:1.1,crouchSpeed:1.1,sprintSpeed:1.1,maxSpeed:1.1});
