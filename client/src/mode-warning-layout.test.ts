/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { parse } from 'postcss';
import { describe, expect, it } from 'vitest';

const sheet = parse(readFileSync(new URL('./mode-warning.css', import.meta.url), 'utf8'));
function declarations(selector: string, media?: string): Record<string, string> {
  const result: Record<string, string> = {};
  sheet.walkRules(rule => {
    const query = rule.parent?.type === 'atrule' ? rule.parent.params : undefined;
    if (!rule.selectors.includes(selector) || query !== media) return;
    rule.walkDecls(decl => { result[decl.prop] = decl.value; });
  });
  return result;
}

// Presentation contracts; actual text fit and home-panel bounds are browser QA.
describe('compact mode warning presentation', () => {
  it('intercepts modal input without dimming or blurring the world preview', () => {
    expect(declarations('#mode-warning')).toMatchObject({
      position: 'fixed', inset: '0', 'pointer-events': 'auto',
      background: 'transparent', 'backdrop-filter': 'none',
      'justify-items': 'start',
    });
    expect(declarations('#mode-warning[hidden]').display).toBe('none');
  });

  it('allows short-screen scrolling and narrow-screen text wrapping', () => {
    expect(declarations('#mode-warning')).toMatchObject({ overflow: 'auto', 'align-items': 'safe center' });
    expect(declarations('#mode-warning-title')['overflow-wrap']).toBe('anywhere');
    expect(declarations('#mode-warning-meter > *')['overflow-wrap']).toBe('anywhere');
    expect(declarations('.mode-warning-actions', '(max-width: 440px)')['grid-template-columns']).toBe('1fr');
  });

  it('offers immediate controls and respects reduced motion', () => {
    expect(declarations('.mode-warning-card')['animation-delay']).toBeUndefined();
    expect(declarations('.mode-warning-card', '(prefers-reduced-motion: reduce)').animation).toBe('none');
    expect(declarations('.mode-warning-actions .button', '(prefers-reduced-motion: reduce)').transition).toBe('none');
  });
});
