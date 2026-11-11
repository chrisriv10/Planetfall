import type {PgPrimaryWeaponId} from "./types.js";

/** Existing three-tier upgrade economy, charged when processing starts. */
export const PG_ZOMBIE_FORGE_PRICES=Object.freeze([900,1600,2400] as const);
export const PG_ZOMBIE_FORGE_PROCESS_MS=2000;
export const PG_ZOMBIE_FORGE_COMPLETE_MS=1200;
export type PgZombieForgeTier=1|2|3;
export interface PgZombieForgeCompletion {
 ownerId:string;
 weaponId:PgPrimaryWeaponId;
 targetTier:PgZombieForgeTier;
}
type ActiveSnapshot=PgZombieForgeCompletion&{startedAt:number;completesAt:number};
export type PgZombieForgeSnapshot=
 | {phase:"idle";ownerId:null;weaponId:null;targetTier:null;startedAt:null;completesAt:null}
 | ({phase:"processing"}&ActiveSnapshot)
 | ({phase:"complete"}&ActiveSnapshot);
