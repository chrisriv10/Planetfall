import type {GameFamily} from "@planetfall/shared";
export interface ModeDevelopment {warning:boolean;name:string;maturity:1|2|3|4|5;stage:string;summary:string;}
/** Editorial maturity indicators, maintained manually; these are not completion measurements. */
export const MODE_DEVELOPMENT:Record<GameFamily,ModeDevelopment>={
  planetfall:{warning:false,name:"Planetfall",maturity:5,stage:"Established",summary:"Tiny planets. Big chaos."},
  "battle-royale":{warning:true,name:"Battle Royale",maturity:4,stage:"Late Alpha",summary:"The core game is substantial; polish, balance and performance work continues."},
  "planet-run":{warning:true,name:"PlanetRun",maturity:3,stage:"Alpha",summary:"Six rounds and tournament flow are playable; broader polish and balance are still new."},
  "planet-gun":{warning:true,name:"PlanetGun",maturity:1,stage:"Prototype",summary:"The first playable FPS slice is under active construction."},
};
