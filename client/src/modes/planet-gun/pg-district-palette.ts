/** sRGB base colors for Nova Block's shared materials. The frame material also
 * backs Habitat walls, so it stays light enough to take different enamel colors. */
export const PG_DISTRICT_PALETTE = Object.freeze({
  deck: 0x374353, west: 0xe5c8ad, east: 0x758b99, ivory: 0xfff3dd,
  trim: 0x37434b, garden: 0x367967, maintenance: 0x777f79,
  solarPaving: 0x916b58, voidPaving: 0x4b596b, hydroPaving: 0x478575,
  servicePaving: 0x65685f, plazaPaving: 0x747b83,
  cyan: 0x70dfff, amber: 0xffcd76, violet: 0xc2a0ff,
  glass: 0x5f9eb3, runPanel: 0x3d515a, soil: 0x574431, leaf: 0x78ac69,
});

/** Three multiplies these instance colors into diffuse albedo in linear space.
 * Light shared bases keep the paint legible under the station's blue fill. */
export const PG_SURFACE_TINT = Object.freeze({
  habitatCream: 0xffdbaf, habitatCoral: 0xff906f, habitatGlass: 0x9bc9ff,
  hydroTeal: 0x7dd4b6, hydroPorcelain: 0xddffeb,
  ionSteel: 0x899da7, ionBrass: 0xefae62,
  transitNavy: 0x6686af, transitOrange: 0xffa165,
});
