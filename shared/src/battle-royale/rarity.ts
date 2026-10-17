export const BR_RARITIES = {
  common: { label:"COMMON", color:"#b8c4dc", hex:0xb8c4dc, category:"ordinary", damage:1, reload:1, spread:1, recoil:1, magazine:1, projectileSpeed:1 },
  uncommon: { label:"UNCOMMON", color:"#66cd88", hex:0x66cd88, category:"ordinary", damage:1.025, reload:.98, spread:.97, recoil:.98, magazine:1, projectileSpeed:1 },
  rare: { label:"RARE", color:"#54b8ff", hex:0x54b8ff, category:"ordinary", damage:1.05, reload:.96, spread:.94, recoil:.96, magazine:1, projectileSpeed:1.02 },
  epic: { label:"EPIC", color:"#c565ff", hex:0xc565ff, category:"ordinary", damage:1.075, reload:.94, spread:.91, recoil:.94, magazine:1, projectileSpeed:1.03 },
  legendary: { label:"LEGENDARY", color:"#ffc84f", hex:0xffc84f, category:"ordinary", damage:1.1, reload:.92, spread:.88, recoil:.92, magazine:1, projectileSpeed:1.04 },
  prototype: { label:"PROTOTYPE", color:"#ff914d", hex:0xff914d, category:"experimental", damage:1, reload:1, spread:1, recoil:1, magazine:1, projectileSpeed:1 },
  singularity: { label:"SINGULARITY", color:"#e5d9ff", hex:0xe5d9ff, category:"signature", damage:1, reload:1, spread:1, recoil:1, magazine:1, projectileSpeed:1 },
} as const;
export type BrRarity = keyof typeof BR_RARITIES;
export const BR_ORDINARY_RARITIES = ["common","uncommon","rare","epic","legendary"] as const;
export const BR_CONSUMABLE_RARITIES = { "med-patch":"common", "shield-cell":"uncommon", "med-kit":"rare", "shield-battery":"rare" } as const;
