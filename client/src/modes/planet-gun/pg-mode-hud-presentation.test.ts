import { describe, expect, it } from 'vitest';
import type { PgModeSnapshot } from '@planetfall/shared';
import { createPgModeHudPresentation, pgModeHudView } from './pg-mode-hud-presentation';

const players = [{ id: 'me', team: 'solar' as const, hp: 100 }, { id: 'enemy', team: 'void' as const, hp: 0 }];
function mode(id: PgModeSnapshot['id']): PgModeSnapshot {
  return { id, round: 2, subphase: 'action', deadline: 10000,
    pilots: { me: { life: 'alive', side: 'attack', characterId: 'cairn', credits: 1400, armor: 50, ultimate: 62, interaction: null, points: 900, upgrade: 2, perks: ['quick-revive'], hitCount: 2, hitCapacity: 5, hitRecoveryAt: 7000, reinforcements: 2, droneId: 'drone', cameraId: null }, enemy: { life: 'eliminated', reinforcements: 999, cameraId: 'secret-camera' } },
    roundScores: { solar: 1, void: 0 }, charge: { site: null, carrierId: 'me', position: null, detonatesAt: 0 },
    control: { point: 1, owner: 'solar', contested: true, capture: { solar: 100, void: 12 }, progress: { solar: 45, void: 20 } },
    site: 0, capture: .4, wave: 3, remaining: 8, queued: 4, power: true,
  } as unknown as PgModeSnapshot;
}

class Element {
  children: Element[] = []; dataset: Record<string,string> = {}; className = ''; hidden = false; max = 1; value = 0;
  attributes = new Map<string,string>(); parent: Element | null = null; writes = 0; private text = '';
  get textContent() { return this.text; } set textContent(value: string) { this.text = value; this.writes++; }
  append(node: Element) { this.children.push(node); node.parent = this; }
  setAttribute(key: string,value: string) { this.attributes.set(key,value); }
  getAttribute(key: string) { return this.attributes.get(key) ?? null; }
  remove() { if(this.parent) this.parent.children = this.parent.children.filter(node => node !== this); }
}
const all = (root: Element): Element[] => [root,...root.children.flatMap(all)];

describe('mode HUD presentation', () => {
  it('labels each active tonic with its station name and clears badges when the local pilot changes', () => {
    const hud=createPgModeHudPresentation({createElement:()=>new Element()} as unknown as Document);
    const snapshot=mode('planetzombies');if(snapshot.id!=='planetzombies')throw Error();
    snapshot.pilots.me.perks=['perk-stamina','perk-vitality'];
    const nodes=all(hud.root as unknown as Element), group=nodes.find(node=>node.className==='pg-mode-perks')!;
    const visibleNames=()=>group.children.filter(node=>!node.hidden).map(node=>node.children[1].textContent);
    hud.render(snapshot,'me',4000,players);
    expect(group.getAttribute('aria-label')).toBe('Active Ion Tonics');
    expect(group.hidden).toBe(false);expect(visibleNames()).toEqual(['CORE RESERVE','VELOCITY BLEND']);
    snapshot.pilots.me.perks=['perk-reload'];
    hud.render(snapshot,'me',4000,players);
    expect(visibleNames()).toEqual(['QUICK CIRCUIT']);
    hud.render(snapshot,'observer',4000,players);
    expect(group.hidden).toBe(true);expect(visibleNames()).toEqual([]);
    hud.dispose();
  });
  it('shows Strike role, charge and credits without naming an unknown carrier', () => {
    const snapshot = mode('planetstrike');
    const view = pgModeHudView(snapshot,'me',4000,players);
    expect(view.title).toBe('PlanetStrike'); expect(view.phase).toContain('ATTACK'); expect(view.objective).toContain('YOU CARRY');
    expect(view.resources).toContain('1400 CREDITS'); expect(view.alive).toContain('SOLAR 1 / VOID 0');
    if(snapshot.id !== 'planetstrike') throw Error();
    snapshot.charge.carrierId = 'hidden-player';
    expect(pgModeHudView(snapshot,'me',4000,players).objective).toBe('CHARGE CARRIED · SITES A / B');
    snapshot.charge.site = 'B'; snapshot.charge.detonatesAt = 8000;
    expect(pgModeHudView(snapshot,'me',4000,players).objective).toContain('SITE B · 4s');
  });
  it('uses canonical hero identity and bounded Watch capture/round progress', () => {
    const view=pgModeHudView(mode('planetwatch'),'me',4000,players);
    expect(view.resources).toBe('Cairn · TANK · ULT 62%'); expect(view.objective).toContain('CONTESTED');
    expect(view.detail).toContain('PASSIVE BRACED'); expect(view.gauges.map(g=>g.value)).toEqual([45,20]);
  });
  it('shows only local Siege sensor and reinforcement state', () => {
    const snapshot=mode('planetsiege');snapshot.subphase='prepare';
    const view=pgModeHudView(snapshot,'me',4000,players);
    expect(view.objective).toBe('SCOUT UPLINK 1'); expect(view.resources).toContain('2 REINFORCEMENTS');
    expect(view.detail).toBe('YOUR DRONE DEPLOYED');expect(JSON.stringify(view)).not.toMatch(/999|secret-camera/);
    expect(view.gauges[0].value).toBe(40);
  });
  it('renders zombie hit capacity, recovery and downed state with safe legacy fallback', () => {
    const snapshot=mode('planetzombies');if(snapshot.id!=='planetzombies')throw Error();
    const view=pgModeHudView(snapshot,'me',4000,players);
    expect(view.score).toBe('3 / 5 HITS LEFT · RECOVERY 3s');expect(view.resources).toContain('WEAPON TIER 2');
    snapshot.pilots.me.life='downed';snapshot.pilots.me.bleedoutAt=9000;
    expect(pgModeHudView(snapshot,'me',4000,players).score).toContain('BLEEDOUT 5s');
    delete (snapshot.pilots.me as Partial<typeof snapshot.pilots.me>).hitCapacity;
    delete (snapshot.pilots.me as Partial<typeof snapshot.pilots.me>).hitCount;
    const legacy=pgModeHudView(snapshot,'me',4000,players);expect(legacy.gauges[0]).toMatchObject({value:3,max:3});expect(JSON.stringify(legacy)).not.toContain('NaN');
  });
  it('reuses a bounded accessible DOM, skips unchanged text and releases its root', () => {
    const document={createElement:()=>new Element()} as unknown as Document;
    const hud=createPgModeHudPresentation(document),root=hud.root as unknown as Element, host=new Element();host.append(root);
    const count=all(root).length;
    for(const id of ['planetstrike','planetwatch','planetsiege','planetzombies'] as const){
      const snapshot=mode(id);snapshot.pilots.me.interaction={targetId:'objective',startedAt:1000,durationMs:6000};
      hud.render(snapshot,'me',4000,players);const writes=all(root).reduce((sum,node)=>sum+node.writes,0);
      hud.render(snapshot,'me',4000,players);expect(all(root).reduce((sum,node)=>sum+node.writes,0)).toBe(writes);
      expect(all(root)).toHaveLength(count);
      for(const gauge of all(root).filter(node=>node.className==='pg-mode-progress'))if(!gauge.parent!.hidden){expect(gauge.getAttribute('aria-label')).toBeTruthy();expect(gauge.value).toBeGreaterThanOrEqual(0);expect(gauge.value).toBeLessThanOrEqual(gauge.max);}
    }
    expect(root.getAttribute('aria-label')).toBe('Mode objective and resources');
    expect(all(root).find(node=>node.className==='pg-mode-countdown')!.getAttribute('role')).toBe('timer');
    hud.dispose();hud.dispose();expect(host.children).toHaveLength(0);
  });
});
