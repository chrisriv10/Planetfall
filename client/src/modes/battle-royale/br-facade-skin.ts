import type { BrStructure } from "@planetfall/shared";
import { buildFacadeParts, buildExteriorServiceParts } from "./br-facades";
import { buildNovaStorefrontParts } from "./br-storefronts";
import { buildBrSolarServiceFrontage, type SolarServiceFacadePart, type SolarServiceFrontage } from "./br-solar-service-frontage";

/** The production skin composition is shared with the overlap audit. Heights
 * are local to the building's base; the renderer applies elevation once. */
export function buildBrFacadeSkin(
  structure:BrStructure, solar:SolarServiceFrontage=buildBrSolarServiceFrontage(structure)
):SolarServiceFacadePart[]{
  return [
    ...buildFacadeParts(structure).filter(part=>!solar.replaceGenericFacadePanels||part.finish!=="panel"),
    ...buildExteriorServiceParts(structure),
    ...buildNovaStorefrontParts(structure),
    ...solar.facadeParts,
  ];
}
