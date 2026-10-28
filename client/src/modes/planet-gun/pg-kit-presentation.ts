import { PG_MODULES, pgWeaponProfile, type PgModuleId, type PgWeaponId } from "@planetfall/shared";
export const PG_KIT_SOCKETS = ["optic", "stability", "energy", "handling"] as const;
export type PgKitSocket = typeof PG_KIT_SOCKETS[number];
/** Read-only presentation of the authoritative module compatibility catalog. */
export function pgSocketModules(weapon: PgWeaponId, socket: PgKitSocket) {
  return (Object.keys(PG_MODULES) as PgModuleId[]).filter(id => PG_MODULES[id].category === socket && PG_MODULES[id].weapons.includes(weapon));
}
export function pgKitStatRows(weapon: PgWeaponId, modules: readonly PgModuleId[]) {
  const base = pgWeaponProfile(weapon), effective = pgWeaponProfile(weapon, [...modules]);
  const values = [
    ["ADS", base.adsMs, effective.adsMs, " ms", false],
    ["Sprint recovery", base.sprintDelayMs, effective.sprintDelayMs, " ms", false],
    ["Magazine", base.magazine, effective.magazine, "", true],
    ["Reload", base.reloadMs, effective.reloadMs, " ms", false],
    ["ADS field of view", base.adsFov, effective.adsFov, "°", null],
  ] as const;
  const rows: {name:string;value:string;delta:number;deltaText:string;benefit:string}[] = values.map(([name, before, value, unit, higherBetter]) => ({ name, value: `${Number(value.toFixed(1))}${unit}`, delta: value - before, deltaText: value === before ? "—" : `${value > before ? "+" : ""}${Number((value - before).toFixed(1))}${unit}`, benefit: value === before || higherBetter === null ? "neutral" : (value > before) === higherBetter ? "gain" : "cost" }));
  const recoil = (effective.recoil / base.recoil - 1) * 100;
  rows.push({ name: "Recoil", value: `${effective.recoil.toFixed(4)} rad`, delta: recoil, deltaText: Math.abs(recoil) < .001 ? "—" : `${recoil > 0 ? "+" : ""}${Number(recoil.toFixed(1))}%`, benefit: Math.abs(recoil) < .001 ? "neutral" : recoil < 0 ? "gain" : "cost" });
  return rows;
}
