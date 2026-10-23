/** Presentation only. The caller supplies mode copy, maturity stages and dialog behavior. */
export function createModeWarningArt(): {
  root: HTMLDivElement;
  title: HTMLElement;
  summary: HTMLElement;
  stage: HTMLElement;
  meter: HTMLElement;
  continueButton: HTMLButtonElement;
  cancelButton: HTMLButtonElement;
} {
  const root = document.createElement('div');
  root.id = 'mode-warning';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'mode-warning-title');
  root.setAttribute('aria-describedby', 'mode-warning-summary');

  const card = document.createElement('div');
  card.className = 'mode-warning-card';
  const kicker = document.createElement('div');
  kicker.className = 'mode-warning-kicker';
  kicker.textContent = 'WORK IN PROGRESS';
  const title = document.createElement('h2');
  title.id = 'mode-warning-title';
  title.textContent = 'Into the unknown';
  const summary = document.createElement('p');
  summary.id = 'mode-warning-summary';
  summary.textContent = 'This mode is still taking shape. Expect unfinished features and rough edges as we build.';

  const maturity = document.createElement('div');
  maturity.className = 'mode-warning-maturity';
  const heading = document.createElement('div');
  heading.className = 'mode-warning-maturity-heading';
  const label = document.createElement('span');
  label.textContent = 'DEVELOPMENT STAGE';
  const stage = document.createElement('strong');
  stage.id = 'mode-warning-stage';
  heading.append(label, stage);
  const meter = document.createElement('div');
  meter.id = 'mode-warning-meter';
  meter.setAttribute('role', 'img');
  meter.setAttribute('aria-label', 'Development maturity');
  maturity.append(heading, meter);

  const actions = document.createElement('div');
  actions.className = 'mode-warning-actions';
  const continueButton = document.createElement('button');
  continueButton.id = 'mode-warning-continue';
  continueButton.type = 'button';
  continueButton.className = 'button button-primary';
  continueButton.textContent = 'Continue';
  const cancelButton = document.createElement('button');
  cancelButton.id = 'mode-warning-cancel';
  cancelButton.type = 'button';
  cancelButton.className = 'button button-secondary';
  cancelButton.textContent = 'Cancel';
  actions.append(continueButton, cancelButton);
  card.append(kicker, title, summary, maturity, actions);
  root.append(card);
  return { root, title, summary, stage, meter, continueButton, cancelButton };
}
