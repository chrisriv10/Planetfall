export interface BrInteractionPresentationInput {
  prompt: string;
  hasLootTarget: boolean;
  eliminated: boolean;
}

/** Exactly one layer owns an interaction. Loot uses the richer loot card;
 * revive/crate/heal/reload continue through the compact context strip. */
export function brContextPromptFor(input:BrInteractionPresentationInput):string {
  if(input.eliminated||input.hasLootTarget)return "";
  return input.prompt.trim();
}
