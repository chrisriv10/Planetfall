import type {BotDifficulty,PrInput,PrPlayerState,PrRoundDefinition,PrTileState} from "@planetfall/shared";
import {prCrowdBotInput,type PrCrowdGrid,type PrSteeringMemory} from "./pr-bot-steering.js";
export {PrCrowdGrid,PR_CROWD_LIMITS} from "./pr-bot-steering.js";
export type PrBotMemory=PrSteeringMemory;
/** Ordinary inputs only; the room shares one bounded crowd snapshot per epoch. */
export function prBotInput(player:PrPlayerState,round:PrRoundDefinition,tiles:PrTileState,elapsed:number,seed:number,difficulty:BotDifficulty,memory:PrBotMemory,crowd?:PrCrowdGrid):PrInput {
 return prCrowdBotInput(player,round,tiles,elapsed,seed,difficulty,memory,crowd);
}
