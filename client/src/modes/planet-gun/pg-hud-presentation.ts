import type {PgWeaponId} from '@planetfall/shared';

/** Presentation only: spread is the game's current cone in radians, not new aim state. */
export function pgReticlePresentation(weapon:PgWeaponId, ads:number, spread:number){
  const aim=Number.isFinite(ads)?Math.max(0,Math.min(1,ads)):0;
  const cone=Number.isFinite(spread)?Math.max(0,spread):0;
  const t=Math.max(0,Math.min(1,(aim-.86)/.14));
  const optic=t*t*(3-2*t);
  return {gap:Math.min(24,3+cone*170),hipOpacity:1-optic,opticOpacity:optic,
    category:weapon==='photon'?'scatter':weapon==='rail'||weapon==='quasar'?'precision':weapon==='comet'?'sidearm':'automatic'};
}

export const PG_RETICLE_MARKUP=`<div class="pg-hip-reticle"><i></i><i></i><i></i><i></i><b></b></div>
<svg class="pg-optic-reticle" width="80" height="80" viewBox="-40 -40 80 80" aria-hidden="true">
  <g class="pg-rail-reticle" fill="none" stroke="currentColor" stroke-width="1">
    <path d="M-35 0h22M13 0h22M0-35v20M0 12v23M-4 18h8M-6 26h12M-3 34h6M-24-3v6M24-3v6"/>
    <path class="pg-reticle-energy" d="M-7-10l7-4 7 4"/>
  </g>
  <g class="pg-pulse-reticle" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M-9 3v-7l3-3M9 3v-7L6-7"/></g>
  <circle class="pg-optic-point" r="1.35" fill="currentColor"/>
</svg>`;
