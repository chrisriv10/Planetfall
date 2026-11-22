import { PG_MODES, PG_MODE_IDS, type GameFamily, type PgModeId } from "@planetfall/shared";
import { bindingHudLabel } from "./binding-hud-label";
import { bindingSettings } from "./binding-settings";
import type { BindingAction, BindingContext, BindingSettings } from "./input-bindings";

export const GUIDE_FAMILIES: readonly GameFamily[] = ["planetfall", "battle-royale", "planet-run", "planet-gun"];
export interface GuideControl { action: string; label: string }
export interface GuideHint { id: string; title: string; text: string }
export interface GuideSection {
  family: GameFamily;
  title: string;
  objective: string;
  win: string;
  first: string;
  mechanics: string[];
  mistakes: string[];
  controls: GuideControl[];
  hints: GuideHint[];
  submodes: { id: PgModeId; title: string; text: string }[];
}

const copy: Record<GameFamily, Omit<GuideSection, "family" | "controls" | "hints" | "submodes">> = {
  planetfall: {
    title: "Planetfall",
    objective: "Defend your planet while damaging rival planets with cannons and raids.",
    win: "Be the last planet standing. At the time limit, the surviving planet with the most integrity wins; a tie enters overtime.",
    first: "Explore your planet, collect nearby Scrap, then stand beside your cannon and aim at a rival planet.",
    mechanics: ["Gravity follows the sphere: moving around the surface changes which way is up.", "Jump and grapple to travel. Collect Scrap to fund attacks and repairs.", "Fire beside your cannon or raid rival planets. Repair beside your home repair core; repairs are unavailable in overtime.", "Classic and Chaos share the planet-survival objective. Chaos adds changing modifiers: watch their HUD announcements."],
    mistakes: ["Spending all your Scrap without leaving a repair reserve.", "Ignoring your own planet's integrity while raiding."],
  },
  "battle-royale": {
    title: "PlanetRoyale",
    objective: "Drop from the Starliner, collect equipment and survive the closing Void.",
    win: "Be the last surviving player in Solo, or the last surviving team in Duo or Squad.",
    first: "Choose a landing area, leave the Starliner and gather a weapon and supplies after landing.",
    mechanics: ["Watch health, shields, ammunition and your inventory; equipment must be collected.", "The safe zone shrinks. Follow the map and move before the Void catches you.", "In team modes, stay near teammates and help downed allies when it is safe."],
    mistakes: ["Chasing loot or a fight while the safe zone moves away.", "Reloading in the open or separating from your team."],
  },
  "planet-run": {
    title: "PlanetRun",
    objective: "Qualify through an obstacle tournament of races, survival rounds and a final.",
    win: "Keep qualifying, then win the final. Qualification places are limited and shown on the HUD.",
    first: "Read the round objective during the countdown, then follow the course and checkpoint markers.",
    mechanics: ["Jump over gaps; dive gives a short forward burst and has a cooldown.", "Race rounds reward progress and finishes. Survival rounds require staying in play.", "Race checkpoints reduce lost progress after a fall. Survival hazards can eliminate you.", "If eliminated, spectate while the remaining pilots advance."],
    mistakes: ["Diving before every jump and having no dive ready for a difficult gap.", "Treating a survival round like a race; check the current objective."],
  },
  "planet-gun": {
    title: "PlanetGun",
    objective: "Fight with your team and play the objective of the selected ruleset.",
    win: "Victory depends on the ruleset: eliminations, tactical rounds or relay control. Zombies is a cooperative survival run.",
    first: "Check your ruleset and team, choose equipment or a character where offered, then follow the objective HUD.",
    mechanics: ["Aim, fire and reload; use cover while your weapon is unavailable.", "Movement and equipment differ by ruleset. Check abilities and their cooldowns or remaining charges.", "Deathmatch respawns pilots; Strike and Siege have one life per round. Watch uses team respawn waves. Zombies supports revives."],
    mistakes: ["Playing only for eliminations while an objective is undefended.", "Assuming every ruleset allows immediate respawning or uses the same abilities."],
  },
};

const modeDetails: Record<PgModeId, string> = {
  deathmatch: "Solar versus Void. Reach the configured elimination score first, or lead when time expires. Pilots respawn; a tied timer enters sudden death.",
  planetstrike: "Buy during preparation. Attackers carry and plant the shared charge; defenders stop the plant or defuse it. Win seven regulation rounds; a tied series enters paired overtime. One life each round: eliminated pilots spectate.",
  planetwatch: "Choose a hero, capture the Control Relay and hold it to build team progress. Win two relay rounds to win the match. Contest the relay to stop enemy progress; use abilities and team respawn waves.",
  planetsiege: "Choose an operator. Scout and prepare before attackers breach and seize the uplink room; defenders hold it. Win four regulation rounds; a tied series enters paired overtime. Gadgets are limited and each round gives one life.",
  planetzombies: "Cooperate with up to four survivors. Clear each finite wave, spend run points on weapons, ammo and upgrades, and revive downed teammates. The run ends when the crew cannot continue.",
};

/** Labels follow the same binding profile and fixed controller adapters as the HUD. */
export function getPlayerGuideSection(family: GameFamily, inputMethod = "keyboard", submode: PgModeId = "deathmatch", settings: BindingSettings = bindingSettings.get()): GuideSection {
  const context: BindingContext = family === "planet-gun" && submode !== "deathmatch" ? `planet-gun:${submode}` : family;
  const controls: GuideControl[] = [];
  const add = (action: BindingAction, text: string, pad?: string) => controls.push({ action: text, label: bindingHudLabel(context, action, inputMethod, pad, settings) });
  controls.push({ action: "Move", label: inputMethod === "gamepad" ? "LS" : (["moveForward", "moveLeft", "moveBackward", "moveRight"] as const).map(action => bindingHudLabel(context, action, inputMethod, undefined, settings)).join(" · ") });
  controls.push({ action: "Look", label: inputMethod === "gamepad" ? "RS" : "MOUSE" });
  add("jump", "Jump", "A");
  if (family === "planet-run") add("dive", "Dive", "X");
  else {
    add("fire", family === "planetfall" ? "Fire cannon / weapon" : "Fire", "RT");
    add("aim", family === "planetfall" ? "Grapple" : "Aim", "LT");
    add("interact", "Interact", family === "planet-gun" ? "R3" : "X");
    if (family === "planetfall") add("repair", "Repair at home", "RB");
    else add("reload", "Reload", family === "planet-gun" ? "X" : "RB");
    if (family === "battle-royale") {
      // These actions have no dedicated shortcut in the shared controller adapter.
      add("map", "Map"); add("inventory", "Inventory");
    }
    if (family === "planet-gun" && submode !== "deathmatch") {
      add("buyMenu", "Equipment / mode menu", "D↓");
      if (submode === "planetwatch" || submode === "planetsiege" || submode === "planetstrike") {
        add("ability1", "Ability / gadget 1", "LB"); add("ability2", "Ability / gadget 2", "RB");
      }
      if (submode === "planetwatch" || submode === "planetstrike") add("ultimate", submode === "planetwatch" ? "Ultimate" : "Utility 3", "D↑");
    }
  }
  const base = copy[family];
  const first = family === "planet-gun" ? `${PG_MODES[submode].name}: ${PG_MODES[submode].summary}` : base.first;
  const hints: GuideHint[] = [
    { id: "first", title: "Start here", text: first },
    { id: "controls", title: "Your controls", text: controls.filter(control => control.action !== "Look").slice(0, 6).map(control => `${control.action}: ${control.label}`).join(" · ") },
    { id: "objective", title: "Keep in mind", text: family === "planet-gun" ? modeDetails[submode] : `${base.win} ${base.mistakes[0]}` },
  ];
  return { family, ...base, mechanics: [...base.mechanics], mistakes: [...base.mistakes], controls, hints,
    submodes: family === "planet-gun" ? PG_MODE_IDS.map(id => ({ id, title: PG_MODES[id].name, text: modeDetails[id] })) : [] };
}
