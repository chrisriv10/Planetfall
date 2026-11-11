import { afterEach, expect, it, vi } from "vitest";
import { dismissUiNotice } from "./ui-motion";

function createNotice(reducedMotion = false) {
  const notice = Object.assign(new EventTarget(), {
    hidden: false,
    isConnected: true,
    remove: vi.fn(),
    closest: () => ({}),
    ownerDocument: { defaultView: {
      matchMedia: () => ({ matches: reducedMotion }),
      CSS: { supports: () => true },
    } },
  });
  return { notice, dismiss: () => dismissUiNotice(notice as unknown as HTMLElement) };
}

afterEach(() => vi.useRealTimers());

it("hides immediately and releases the notice on its opacity transition", () => {
  vi.useFakeTimers();
  const { notice, dismiss } = createNotice();
  dismiss();
  expect(notice.hidden).toBe(true);
  const transition = (propertyName: string) =>
    notice.dispatchEvent(Object.assign(new Event("transitionend"), { propertyName }));
  transition("width");
  expect(notice.remove).not.toHaveBeenCalled();
  transition("opacity");
  vi.runAllTimers();
  expect(notice.remove).toHaveBeenCalledTimes(1);
});

it("preserves a reopened notice and gives its next dismissal a fresh deadline", () => {
  vi.useFakeTimers();
  const { notice, dismiss } = createNotice();
  dismiss();
  notice.hidden = false;
  vi.runAllTimers();
  expect(notice.remove).not.toHaveBeenCalled();
  dismiss();
  vi.advanceTimersByTime(150);
  notice.hidden = false;
  dismiss();
  vi.advanceTimersByTime(60);
  expect(notice.remove).not.toHaveBeenCalled();
  vi.runAllTimers();
  expect(notice.remove).toHaveBeenCalledTimes(1);
});

it("removes the notice immediately under reduced motion", () => {
  const { notice, dismiss } = createNotice(true);
  dismiss();
  expect(notice.hidden).toBe(true);
  expect(notice.remove).toHaveBeenCalledOnce();
});
