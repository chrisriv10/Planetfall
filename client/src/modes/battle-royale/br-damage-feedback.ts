export interface BrDamageVitals { hp:number; shield:number; }
export interface BrDamageFeedbackPayload extends BrDamageVitals { shieldBroken:boolean; }
export type BrDamageFeedbackKind="shield-hit"|"shield-break"|"hp-hit";

/** Post-hit shield totals alone cannot identify HP damage that bypasses shield.
 * Pass known pre-hit vitals when available; never infer damage from maximum HP. */
export function classifyBrDamageFeedback(payload:BrDamageFeedbackPayload,previous?:BrDamageVitals):BrDamageFeedbackKind {
  if(payload.shieldBroken)return "shield-break";
  if(previous&&Number.isFinite(previous.hp)&&Number.isFinite(payload.hp)&&payload.hp<previous.hp)return "hp-hit";
  return Number.isFinite(payload.shield)&&payload.shield>0?"shield-hit":"hp-hit";
}

export const BR_DAMAGE_FEEDBACK_STYLES={
  "shield-hit":{color:0x70f5ff,emissiveIntensity:1.25,flashMs:95,hitMarkerMs:110,rippleMs:110,rippleColor:0x65eaff,rippleOpacity:.26,rippleScale:1.12,rippleExpansion:.18},
  "shield-break":{color:0xe8f8ff,emissiveIntensity:1.5,flashMs:110,hitMarkerMs:150,rippleMs:180,rippleColor:0xb7dcff,rippleOpacity:.44,rippleScale:1.15,rippleExpansion:.48},
  // HP impact warms the suit briefly; it must not invent another shield shell.
  "hp-hit":{color:0xff8061,emissiveIntensity:1.15,flashMs:95,hitMarkerMs:110,rippleMs:0,rippleColor:0xff8061,rippleOpacity:0,rippleScale:1,rippleExpansion:0}
} as const;
export type BrDamageFeedbackStyle=(typeof BR_DAMAGE_FEEDBACK_STYLES)[BrDamageFeedbackKind];
export interface BrDamageFeedbackState {
  readonly kind:BrDamageFeedbackKind;
  readonly style:BrDamageFeedbackStyle;
  readonly startedAt:number;
  readonly flashUntil:number;
  readonly rippleUntil:number;
  readonly hitMarkerUntil:number;
  readonly expiresAt:number;
}

/** One instance per victim (and optionally one for the local hit marker).
 * Read on the render loop; reset on player removal/mode exit. No callbacks,
 * meshes, wall-clock reads, or resources are owned by this presentation state. */
export class BrDamageFeedback {
  private clock=0;
  private state:BrDamageFeedbackState|null=null;

  hit(payload:BrDamageFeedbackPayload,now:number,previous?:BrDamageVitals):BrDamageFeedbackState|null {
    if(!Number.isFinite(now)||now<0)return this.state;
    const active=this.read(now),startedAt=this.clock;
    const kind=classifyBrDamageFeedback(payload,previous),style=BR_DAMAGE_FEEDBACK_STYLES[kind];
    // Latest hit replaces the style immediately. Existing active deadlines may
    // extend, never shorten; old reset callbacks therefore cannot erase a hit.
    const flashUntil=Math.max(active?.flashUntil??0,startedAt+style.flashMs);
    const hitMarkerUntil=Math.max(active?.hitMarkerUntil??0,startedAt+style.hitMarkerMs);
    // An HP impact explicitly removes the shield ripple despite an older break.
    const rippleUntil=style.rippleMs>0?Math.max(active?.rippleUntil??0,startedAt+style.rippleMs):startedAt;
    this.state={kind,style,startedAt,flashUntil,rippleUntil,hitMarkerUntil,expiresAt:Math.max(flashUntil,rippleUntil,hitMarkerUntil)};
    return this.state;
  }

  read(now:number):BrDamageFeedbackState|null {
    if(Number.isFinite(now))this.clock=Math.max(this.clock,now);
    if(this.state&&this.clock>=this.state.expiresAt)this.state=null;
    return this.state;
  }

  clear():void { this.state=null; }
}

/** Stable [0,1] fade for a channel; callers reuse their existing ripple mesh. */
export function brDamageFeedbackFade(startedAt:number,until:number,now:number):number {
  if(!Number.isFinite(now)||until<=startedAt)return 0;
  return Math.max(0,Math.min(1,(until-now)/(until-startedAt)));
}
