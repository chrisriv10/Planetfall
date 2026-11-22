import { CAREER_ACHIEVEMENTS, CAREER_FAMILIES, careerAchievementProgress, emptyCareer, PLANET_PASS_REWARDS, SESSION_PROGRESSION, sessionXpRequired, type CareerData, type GameFamily, type GuestProfile } from '@planetfall/shared';
import type { GuideState } from './player-guide';

let nextExperienceView = 0;
const familyNames: Record<GameFamily, string> = { planetfall: 'Planetfall', 'battle-royale': 'PlanetRoyale', 'planet-run': 'PlanetRun', 'planet-gun': 'PlanetGun' };

export interface QuickMatchViewState { state?: 'searching' | 'ready'; humans: number; botsAvailableAt: number; expiresAt: number; canStartBots?: boolean }
export interface ExperienceViewCallbacks {
  cancel(): void;
  startBots(): void;
  closeGuide?(): void;
  dismissHint?(): void;
  skipGuide?(): void;
  enableGuide?(): void;
  selectGuideFamily?(family: GameFamily): void;
  closeCareer?(): void;
}

/** DOM presentation only. The caller owns mounting, visibility, focus and clocks. */
export function createExperienceView(document: Document, callbacks: ExperienceViewCallbacks) {
  const instance = ++nextExperienceView;
  const cleanups: Array<() => void> = [];
  function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = '') {
    const node = document.createElement(tag); node.className = className; node.textContent = text; return node;
  }
  function button(text: string, action: () => void, className = 'button button-secondary') {
    const node = element('button', className, text); node.type = 'button';
    node.addEventListener('click', action); cleanups.push(() => node.removeEventListener('click', action)); return node;
  }
  function modal(title: string, key: string, close: () => void) {
    const root = element('section', 'experience-overlay'); root.hidden = true;
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
    const heading = element('h2', '', title); heading.id = `experience-${key}-${instance}`;
    root.setAttribute('aria-labelledby', heading.id);
    const panel = element('div', 'experience-panel glass'); panel.tabIndex = -1;
    const header = element('div', 'experience-heading');
    header.append(heading, button('Close', close, 'button button-quiet'));
    panel.append(header); root.append(panel); return { root, panel };
  }
  const quickRoot = element('section', 'experience-quick'); quickRoot.hidden = true;
  quickRoot.setAttribute('aria-label', 'Quick Match');
  const quickHeading = element('h3', '', 'Searching for players');
  const quickCount = element('p', 'experience-quick-count'); quickCount.setAttribute('role', 'status');
  const quickCopy = element('p', 'experience-muted');
  const quickActions = element('div', 'experience-actions');
  const botsButton = button('Start with bots', callbacks.startBots);
  quickActions.append(botsButton, button('Cancel', callbacks.cancel, 'button button-quiet'));
  quickRoot.append(quickHeading, quickCount, quickCopy, quickActions);
  function renderQuick(state: QuickMatchViewState | null, now = Date.now()) {
    quickRoot.hidden = !state;
    if (!state) return;
    quickHeading.textContent = state.state === 'ready' ? 'Match ready' : 'Searching for players';
    quickCount.textContent = `${state.humans} ${state.humans === 1 ? 'human' : 'humans'} found`;
    const remaining = Math.max(0, Math.ceil((state.botsAvailableAt - now) / 1000));
    const expired = now >= state.expiresAt;
    botsButton.disabled = remaining > 0 || expired || state.canStartBots === false;
    botsButton.textContent = state.canStartBots === false ? 'Host starts with bots' : remaining > 0 ? `Start with bots in ${remaining}s` : 'Start with bots';
    quickCopy.textContent = expired ? 'Search ended. Waiting for the server…' : state.state === 'ready' ? 'Ready up below. The host starts when everyone is ready.' : state.canStartBots === false ? 'Keep waiting for more players. The host can start with bots when available.' : 'Keep waiting for more players, or choose a bot-filled match when available.';
  }
  const guide = modal('How to play', 'guide', () => callbacks.closeGuide?.());
  const guideRoot = guide.root;
  const guideTabs = element('div', 'experience-tabs'); guideTabs.setAttribute('role', 'group'); guideTabs.setAttribute('aria-label', 'Game family');
  const tabViews = CAREER_FAMILIES.map(family => {
    const tab = button(familyNames[family], () => callbacks.selectGuideFamily?.(family)); guideTabs.append(tab); return { family, tab };
  });
  const guideTitle = element('h3', 'experience-section-title');
  const guideObjective = element('p', 'experience-objective');
  const guideWin = element('p', 'experience-muted');
  const guideFirst = element('p', 'experience-first');
  const guideColumns = element('div', 'experience-guide-columns');
  const mechanics = element('section', ''); const mechanicList = element('ul', 'experience-copy-list');
  mechanics.append(element('h4', '', 'Know the essentials'), mechanicList);
  const controls = element('section', ''); const controlList = element('dl', 'experience-controls');
  controls.append(element('h4', '', 'Your controls'), controlList); guideColumns.append(mechanics, controls);
  const mistakes = element('section', ''); const mistakeList = element('ul', 'experience-copy-list');
  mistakes.append(element('h4', '', 'Common mistakes'), mistakeList);
  const submodes = element('section', 'experience-submodes');
  const guideActions = element('div', 'experience-actions');
  const skipButton = button('Skip this family’s hints', () => callbacks.skipGuide?.(), 'button button-quiet');
  const enableButton = button('Enable hints', () => callbacks.enableGuide?.(), 'button button-secondary');
  guideActions.append(skipButton, enableButton);
  guide.panel.append(guideTabs, guideTitle, guideObjective, guideWin, guideFirst, guideColumns, mistakes, submodes, guideActions);
  const hintRoot = element('aside', 'experience-hint'); hintRoot.hidden = true;
  hintRoot.setAttribute('aria-label', 'Gameplay tip');
  const hintTitle = element('strong', ''); const hintText = element('p', '');
  const hintDismiss = button('Got it', () => callbacks.dismissHint?.(), 'button button-quiet');
  hintRoot.append(hintTitle, hintText, hintDismiss);
  function renderGuide(state: GuideState) {
    guideRoot.hidden = !state.open;
    hintRoot.hidden = !state.hint || state.open;
    if (hintTitle.textContent !== (state.hint?.title ?? '')) hintTitle.textContent = state.hint?.title ?? '';
    if (hintText.textContent !== (state.hint?.text ?? '')) hintText.textContent = state.hint?.text ?? '';
    // Context updates during gameplay must not rebuild the hidden manual.
    if (!state.open) return;
    for (const { family, tab } of tabViews) {
      tab.setAttribute('aria-pressed', String(family === state.family));
      tab.classList.toggle('is-selected', family === state.family);
    }
    const section = state.guide;
    guideTitle.textContent = section.title; guideObjective.textContent = section.objective;
    guideWin.textContent = section.win; guideFirst.textContent = section.first;
    mechanicList.replaceChildren(...section.mechanics.map(copy => element('li', '', copy)));
    mistakeList.replaceChildren(...section.mistakes.map(copy => element('li', '', copy)));
    controlList.replaceChildren(...section.controls.map(control => {
      const row = element('div', ''); row.append(element('dt', '', control.action), element('dd', '', control.label)); return row;
    }));
    submodes.hidden = section.submodes.length === 0;
    submodes.replaceChildren(...section.submodes.map(mode => {
      const row = element('div', ''); row.append(element('h4', '', mode.title), element('p', 'experience-muted', mode.text)); return row;
    }));
    skipButton.hidden = !state.enabled || state.completed[state.family];
    enableButton.textContent = state.enabled ? 'Disable hints' : 'Enable hints';
  }
  const career = modal('Career', 'career', () => callbacks.closeCareer?.());
  const careerRoot = career.root;
  const careerName = element('p', 'experience-kicker');
  const careerSummary = element('dl', 'experience-summary');
  const summaryValues = ['Level', 'Level XP', 'Lifetime XP', 'Fallbucks', 'Crowns', 'Planet Pass rewards'].map(label => {
    const box = element('div', ''); const value = element('dd', ''); box.append(element('dt', '', label), value); careerSummary.append(box); return value;
  });
  const careerNote = element('p', 'experience-muted');
  const careerFamilies = element('div', 'experience-family-stats');
  const familyValues = CAREER_FAMILIES.map(family => {
    const card = element('section', 'experience-family-stat'); const value = element('p', '');
    card.append(element('h3', '', familyNames[family]), value); careerFamilies.append(card); return { family, value };
  });
  const achievementHeading = element('h3', 'experience-section-title', 'Achievements');
  const achievementList = element('ul', 'experience-achievements');
  const achievementViews = CAREER_ACHIEVEMENTS.map(achievement => {
    const row = element('li', 'experience-achievement');
    const title = element('strong', '', achievement.name); const copy = element('p', 'experience-muted', achievement.description);
    const status = element('span', 'experience-achievement-status');
    const progress = element('progress', ''); progress.max = achievement.target; progress.setAttribute('aria-label', achievement.name);
    row.append(title, status, copy, progress); achievementList.append(row); return { achievement, row, status, progress };
  });
  career.panel.append(careerName, careerSummary, careerNote, careerFamilies, achievementHeading, achievementList);
  function renderCareer(profile: (GuestProfile & { career?: CareerData }) | null, name: string) {
    if (!profile) { careerRoot.hidden = true; return; }
    careerName.textContent = name;
    summaryValues[0].textContent = String(profile.sessionLevel);
    summaryValues[1].textContent = profile.sessionLevel >= SESSION_PROGRESSION.maxLevel ? 'Max level' : `${profile.sessionXp.toLocaleString()} / ${sessionXpRequired(profile.sessionLevel).toLocaleString()}`;
    summaryValues[2].textContent = profile.sessionTotalXp.toLocaleString();
    summaryValues[3].textContent = profile.fallbucks.toLocaleString();
    summaryValues[4].textContent = profile.crowns.toLocaleString();
    summaryValues[5].textContent = `${PLANET_PASS_REWARDS.filter(reward => profile.unlockedPassRewards.includes(reward.id)).length} / ${PLANET_PASS_REWARDS.length}`;
    // Display-only baseline: never mutate or save an older profile's progression.
    const data = profile.career ?? emptyCareer(new Date().toISOString());
    careerNote.textContent = profile.career ? `Career results tracked since ${new Date(data.trackedSince).toLocaleDateString()}. Earlier matches are not reconstructed.` : 'Career tracking begins with your first completed match. The zero counters and locked goals below are a new Career baseline, not your historical totals. Existing progression is shown above.';
    for (const { family, value } of familyValues) value.textContent = `${data.families[family].completions} completed · ${data.families[family].wins} won`;
    for (const { achievement, row, status, progress } of achievementViews) {
      const current = Math.min(achievement.target, careerAchievementProgress(data, achievement));
      const unlocked = Boolean(data.achievements[achievement.id]);
      row.classList.toggle('is-unlocked', unlocked); progress.value = current;
      const earnedAt = data.achievements[achievement.id];
      status.textContent = unlocked ? Number.isFinite(Date.parse(earnedAt)) ? `Unlocked · ${new Date(earnedAt).toLocaleDateString()}` : 'Unlocked' : `${current} / ${achievement.target}`;
    }
  }
  return { quickRoot, guideRoot, hintRoot, careerRoot, renderQuick, renderGuide, renderCareer, dispose() { for (const cleanup of cleanups) cleanup(); quickRoot.remove(); guideRoot.remove(); hintRoot.remove(); careerRoot.remove(); } };
}
