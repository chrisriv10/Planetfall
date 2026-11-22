import {randomUUID} from "node:crypto";
import type {GameFamily} from "@planetfall/shared";
import type {CareerEntry} from "./player-profiles.js";
export const newCareerSettlement=()=>randomUUID();
export type CareerSettlement=(family:GameFamily,id:string,entries:Iterable<CareerEntry>)=>void;
