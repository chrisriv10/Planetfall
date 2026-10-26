import type {GraphicsQuality} from "../../settings";
export type PgPilotDetail="near"|"mid"|"far";
const RANGES:Record<GraphicsQuality,readonly[number,number]>={low:[14,27],medium:[22,40],high:[30,56]};
/** Hysteresis keeps moving pilots from flickering between presentation tiers. */
export function pgPilotDetail(distance:number,quality:GraphicsQuality,previous:PgPilotDetail="near"):PgPilotDetail {
 const [near,far]=RANGES[quality];
 if(distance>far+(previous==="far"?-3:0))return "far";
 if(distance<near+(previous==="near"?2:-2))return "near";
 return "mid";
}
