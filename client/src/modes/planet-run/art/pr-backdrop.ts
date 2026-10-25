import type {PrRoundDefinition} from "@planetfall/shared";
import {createPrCargoSolarBackdrop} from "./pr-cargo-solar-backdrop";
import {createPrGardenBackdrop} from "./pr-garden-backdrop";
import {createPrCapacitorShatterBackdrop} from "./pr-capacitor-shatter-backdrop";

/** Visual-only outboard districts; never used for support or camera collision. */
export function createPrBackdrop(round:PrRoundDefinition){
 switch(round.id){
  case "cargo-cyclone":case "solar-sweep":return createPrCargoSolarBackdrop(round);
  case "meteor-garden":case "flux-gardens":return createPrGardenBackdrop(round);
  case "capacitor-causeway":case "shatterdeck":return createPrCapacitorShatterBackdrop(round);
 }
}
