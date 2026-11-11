import type {PgPrimaryWeaponId} from "./types.js";

export const PG_ZOMBIE_ARSENAL_COST=850;
export const PG_ZOMBIE_ARSENAL_REVEAL_MS=2200;
/** Claim reservation starts when the result is revealed. */
export const PG_ZOMBIE_ARSENAL_CLAIM_MS=15000;
/** Authored primary-weapon odds total 100; rolls happen only on the server. */
export const PG_ZOMBIE_ARSENAL_WEIGHTS=Object.freeze([
 Object.freeze({weaponId:"pulse",weight:30}),
 Object.freeze({weaponId:"nova",weight:25}),
 Object.freeze({weaponId:"photon",weight:18}),
 Object.freeze({weaponId:"arc",weight:12}),
 Object.freeze({weaponId:"helix",weight:8}),
 Object.freeze({weaponId:"quasar",weight:4}),
 Object.freeze({weaponId:"prism",weight:2}),
 Object.freeze({weaponId:"rail",weight:1}),
] as const satisfies readonly {weaponId:PgPrimaryWeaponId;weight:number}[]);

export type PgZombieArsenalSnapshot=
 | {phase:"idle";ownerId:null;weaponId:null;revealAt:null;expiresAt:null}
 | {phase:"revealing";ownerId:string;weaponId:null;revealAt:number;expiresAt:number}
 | {phase:"ready";ownerId:string;weaponId:PgPrimaryWeaponId;revealAt:number;expiresAt:number};
