import { PG_MODES, PG_HEROES, PG_OPERATORS, PG_ZOMBIE_TONIC_SITES, type PgModeSnapshot, type PgSnapshotPlayer } from '@planetfall/shared';

type Players = readonly Pick<PgSnapshotPlayer, 'id' | 'team' | 'hp'>[];
type Gauge = { label: string; value: number; max: number };
export type PgModeHudView = { title: string; phase: string; timer: string; objective: string; score: string; alive: string; resources: string; detail: string; perks: readonly string[]; gauges: Gauge[] };
const noPerks: readonly string[] = [];
const tonicIds = new Set<string>(PG_ZOMBIE_TONIC_SITES.map(site => site.id));
const finite = (value: number | undefined, fallback = 0) => Number.isFinite(value) ? value! : fallback;
const integer = (value: number | undefined) => Math.max(0, Math.floor(finite(value)));
const percent = (value: number) => Math.min(100, integer(value));
const words = (value: string) => value.replace(/[-_]/g, ' ').toUpperCase();
const seconds = (deadline: number, now: number) => Math.max(0, Math.ceil((finite(deadline) - finite(now)) / 1000));

/** Pure presentation derivation. Never infer identities or setup beyond the supplied snapshot. */
export function pgModeHudView(mode: PgModeSnapshot, localId: string, serverTime: number, players: Players): PgModeHudView {
  const me = mode.pilots[localId];
  const alive = { solar: 0, void: 0 };
  for (const player of players) if (player.hp > 0 && mode.pilots[player.id]?.life === 'alive') alive[player.team]++;
  const view: PgModeHudView = {
    title: PG_MODES[mode.id].name, phase: words(mode.subphase), timer: mode.deadline > 0 ? `${seconds(mode.deadline, serverTime)}s` : '',
    objective: '', score: '', alive: mode.id === 'planetzombies' ? `${alive.solar + alive.void} SURVIVORS ALIVE` : `ALIVE  SOLAR ${alive.solar} / VOID ${alive.void}`,
    resources: '', detail: '', perks: noPerks, gauges: [],
  };
  if (!me) { view.objective = 'SPECTATING'; return view; }
  if ('roundScores' in mode) view.score = `ROUND ${integer(mode.round)}  ·  SOLAR ${integer(mode.roundScores.solar)} : ${integer(mode.roundScores.void)} VOID`;
  if (mode.id === 'planetstrike') {
    view.phase = `${me.side.toUpperCase()} · ${view.phase}`;
    view.objective = mode.charge.site ? `CHARGE PLANTED · SITE ${mode.charge.site} · ${seconds(mode.charge.detonatesAt, serverTime)}s`
      : mode.charge.carrierId === localId ? 'YOU CARRY THE CHARGE · PLANT A / B'
      : mode.charge.carrierId ? 'CHARGE CARRIED · SITES A / B'
      : mode.charge.position ? 'CHARGE DROPPED · RECOVER IT' : me.side === 'attack' ? 'PLANT THE CHARGE · A / B' : 'DEFEND SITES A / B';
    view.resources = `${integer(me.credits)} CREDITS · ${integer(me.armor)} ARMOR`;
    view.detail = mode.subphase === 'buy' ? 'BUY PHASE · Equip at spawn' : mode.charge.site ? (me.side === 'defend' ? 'Hold E at the charge to defuse' : 'Protect the planted charge') : 'ONE LIFE · Win the round';
  } else if (mode.id === 'planetwatch') {
    const hero = Object.values(PG_HEROES).find(item => item.id === me.characterId);
    view.objective = `RELAY ${integer(mode.control.point) + 1} · ${mode.control.contested ? 'CONTESTED' : mode.control.owner ? `${mode.control.owner.toUpperCase()} CONTROL` : 'NEUTRAL'}`;
    view.resources = hero ? `${hero.name} · ${hero.role.toUpperCase()} · ULT ${percent(me.ultimate)}%` : `ULTIMATE ${percent(me.ultimate)}%`;
    view.detail = `CAPTURE  SOLAR ${percent(mode.control.capture.solar)}% / VOID ${percent(mode.control.capture.void)}%${hero ? ` · PASSIVE ${words(hero.passive)}` : ''}`;
    view.gauges.push({ label: 'Solar round control', value: percent(mode.control.progress.solar), max: 100 }, { label: 'Void round control', value: percent(mode.control.progress.void), max: 100 });
  } else if (mode.id === 'planetsiege') {
    const pilot = mode.pilots[localId], operator = Object.values(PG_OPERATORS).find(item => item.id === me.characterId);
    view.phase = `${me.side.toUpperCase()} · ${view.phase}`;
    view.objective = `${mode.subphase === 'prepare' ? me.side === 'attack' ? 'SCOUT' : 'FORTIFY' : me.side === 'attack' ? 'CAPTURE' : 'DEFEND'} UPLINK ${integer(mode.site) + 1}`;
    view.resources = `${operator?.name ?? 'OPERATOR'} · ${integer(pilot.reinforcements)} REINFORCEMENTS`;
    view.detail = pilot.controllingDrone || pilot.cameraId ? mode.controls?.[localId]?.viewOrigin === null ? 'SENSOR SIGNAL LOST' : pilot.cameraId ? 'CAMERA VIEW ACTIVE' : 'DRONE VIEW ACTIVE' : pilot.droneId ? 'YOUR DRONE DEPLOYED' : 'LOCAL VIEW · GADGETS BELOW';
    view.gauges.push({ label: 'Uplink capture', value: percent(mode.capture * 100), max: 100 });
  } else {
    const pilot = mode.pilots[localId], capacity = Math.max(1, integer(finite(pilot.hitCapacity, 3))), remaining = Math.max(0, capacity - integer(pilot.hitCount));
    view.phase = `${pilot.life === 'downed' ? 'DOWNED' : words(mode.subphase)} · POWER ${mode.power ? 'ON' : 'OFF'}`;
    view.objective = `WAVE ${integer(mode.wave)} · ${integer(mode.remaining)} REMAINING · ${integer(mode.queued)} INCOMING`;
    view.resources = `${integer(pilot.points)} POINTS · WEAPON TIER ${integer(pilot.upgrade)}`;
    view.score = pilot.life === 'downed' ? `BLEEDOUT ${seconds(pilot.bleedoutAt, serverTime)}s · ${pilot.selfRecovery ? 'SELF RECOVERY AVAILABLE' : 'AWAIT TEAM REVIVE'}` : `${remaining} / ${capacity} HITS LEFT${pilot.hitRecoveryAt > serverTime && remaining < capacity ? ` · RECOVERY ${seconds(pilot.hitRecoveryAt, serverTime)}s` : ''}`;
    view.perks = pilot.perks ?? noPerks;
    if (!view.perks.length) view.detail = 'NO PERKS · Purchase upgrades between waves';
    else if (view.perks.some(id => !tonicIds.has(id))) {
      view.detail = view.perks.filter(id => !tonicIds.has(id)).slice(0, 3).map(words).join(' / ');
    }
    view.gauges.push({ label: 'Hits remaining', value: remaining, max: capacity });
  }
  if (me.life !== 'alive' && mode.id !== 'planetzombies') view.resources = `${me.life.toUpperCase()} · ${view.resources}`;
  if (me.interaction) {
    const value = Math.min(100, Math.max(0, finite((serverTime - me.interaction.startedAt) / me.interaction.durationMs * 100)));
    view.gauges.push({ label: mode.id === 'planetstrike' ? mode.charge.site ? 'Defusing charge' : 'Planting charge' : mode.id === 'planetzombies' ? 'Hold interaction' : 'Objective interaction', value, max: 100 });
  }
  return view;
}

export function createPgModeHudPresentation(document: Document) {
  const root = document.createElement('section'); root.className = 'pg-mode-presentation'; root.setAttribute('aria-label', 'Mode objective and resources');
  const make = (tag: string, className: string, parent: HTMLElement = root) => { const node = document.createElement(tag); node.className = className; parent.append(node); return node; };
  const header = make('div', 'pg-mode-presentation-header');
  const title = make('h2', 'pg-mode-title', header), timer = make('span', 'pg-mode-countdown', header);
  timer.setAttribute('role', 'timer'); timer.setAttribute('aria-label', 'Phase time remaining');
  const phase = make('div', 'pg-mode-status'), objective = make('p', 'pg-mode-objective');
  const score = make('p', 'pg-mode-round-score'), alive = make('p', 'pg-mode-alive');
  const resources = make('p', 'pg-mode-resources'), detail = make('p', 'pg-mode-detail');
  const perks = make('div', 'pg-mode-perks');
  perks.setAttribute('role', 'group');
  perks.setAttribute('aria-label', 'Active Ion Tonics');
  perks.hidden = true;
  const badges = PG_ZOMBIE_TONIC_SITES.map(site => {
    const badge = make('span', 'pg-mode-perk', perks);
    badge.dataset.perk = site.id;
    badge.setAttribute('style', `--tonic-color: #${site.color.toString(16).padStart(6, '0')}`);
    badge.hidden = true;
    make('i', 'pg-mode-perk-icon', badge).setAttribute('aria-hidden', 'true');
    make('span', 'pg-mode-perk-name', badge).textContent = site.name;
    return { id: site.id, badge };
  });
  const gauges = Array.from({ length: 3 }, () => {
    const row = make('div', 'pg-mode-gauge'); const label = make('span', 'pg-mode-gauge-label', row);
    const meter = make('progress', 'pg-mode-progress', row) as HTMLProgressElement;
    return { row, label, meter };
  });
  const text = (node: HTMLElement, value: string) => { if (node.textContent !== value) node.textContent = value; };
  let disposed = false;
  return { root,
    render(mode: PgModeSnapshot, localId: string, serverTime: number, players: Players) {
      if (disposed) return;
      const view = pgModeHudView(mode, localId, serverTime, players);
      if (root.dataset.mode !== mode.id) root.dataset.mode = mode.id;
      text(title, view.title); text(timer, view.timer); text(phase, view.phase); text(objective, view.objective);
      text(score, view.score); text(alive, view.alive); text(resources, view.resources); text(detail, view.detail);
      score.hidden = !view.score; detail.hidden = !view.detail;
      let activePerks = 0;
      for (const { id, badge } of badges) {
        const active = view.perks.includes(id);
        if (active) activePerks++;
        if (badge.hidden === active) badge.hidden = !active;
      }
      if (perks.hidden !== (activePerks === 0)) perks.hidden = activePerks === 0;
      for (let i = 0; i < gauges.length; i++) {
        const node = gauges[i], gauge = view.gauges[i]; node.row.hidden = !gauge;
        if (!gauge) continue;
        text(node.label, `${gauge.label.toUpperCase()} · ${Math.floor(gauge.value)}${gauge.max === 100 ? '%' : ` / ${gauge.max}`}`);
        if (node.meter.getAttribute('aria-label') !== gauge.label) node.meter.setAttribute('aria-label', gauge.label);
        if (node.meter.max !== gauge.max) node.meter.max = gauge.max;
        if (node.meter.value !== gauge.value) node.meter.value = gauge.value;
      }
    },
    dispose() { if (disposed) return; disposed = true; root.remove(); },
  };
}
