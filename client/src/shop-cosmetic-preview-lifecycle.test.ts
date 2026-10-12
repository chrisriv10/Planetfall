import { afterEach, describe, expect, it, vi } from "vitest";
const gpu = vi.hoisted(() => ({ constructors: 0, render: vi.fn(), dispose: vi.fn(), loss: vi.fn() }));
vi.mock("three", async () => {
  const actual = await vi.importActual<typeof import("three")>("three");
  return { ...actual, WebGLRenderer: class {
    domElement = {}; toneMapping = 0;
    constructor() { gpu.constructors++; }
    setPixelRatio() {} setClearColor() {} setSize() {}
    render = gpu.render; dispose = gpu.dispose; forceContextLoss = gpu.loss;
  } };
});
import { mountShopCosmeticPreviews } from "./shop-cosmetic-preview";

afterEach(() => vi.unstubAllGlobals());
describe("shared preview lifecycle", () => {
  it("shares one GPU context across Shop and Pass, suspends hidden cards, and completely tears down", () => {
    const pending = new Map<number, FrameRequestCallback>(); let next = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { pending.set(++next, callback); return next; });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => pending.delete(id));
    vi.stubGlobal("devicePixelRatio", 1);
    let intersection!: (entries: { target: unknown; isIntersecting: boolean }[]) => void;
    const disconnect = vi.fn();
    vi.stubGlobal("IntersectionObserver", class { constructor(callback: typeof intersection) { intersection = callback; } observe() {} unobserve() {} disconnect = disconnect; });
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    const motion = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const owner = { hidden: false, defaultView: { matchMedia: () => motion }, addEventListener: vi.fn(), removeEventListener: vi.fn(), createElement: () => ({}) };
    const draw = vi.fn();
    const element = (id: string) => ({ dataset: { cosmeticId: id }, isConnected: true, ownerDocument: owner,
      querySelector: () => ({ width: 0, height: 0, getContext: () => ({ clearRect: vi.fn(), drawImage: draw }) }),
      getBoundingClientRect: () => ({ width: 180, height: 148 }) });
    const shopElement = element("solar-gold"), passElement = element("ion-blue");
    const root = (entry: unknown) => ({ ownerDocument: owner, querySelectorAll: () => [entry] }) as unknown as HTMLElement;
    const cleanupShop = mountShopCosmeticPreviews(root(shopElement));
    const cleanupPass = mountShopCosmeticPreviews(root(passElement));
    const step = (time: number) => { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback(time)); };
    expect(gpu.constructors).toBe(0);
    intersection([{ target: shopElement, isIntersecting: true }, { target: passElement, isIntersecting: true }]); step(100);
    expect(gpu.constructors).toBe(1); expect(draw).toHaveBeenCalledTimes(2);
    intersection([{ target: shopElement, isIntersecting: false }, { target: passElement, isIntersecting: false }]); step(150);
    expect(pending.size).toBe(0); expect(draw).toHaveBeenCalledTimes(2);
    motion.matches = true;
    intersection([{ target: passElement, isIntersecting: true }]); step(200);
    expect(draw).toHaveBeenCalledTimes(3); expect(pending.size).toBe(0);
    cleanupShop(); expect(gpu.dispose).not.toHaveBeenCalled();
    cleanupPass(); cleanupPass();
    expect(gpu.dispose).toHaveBeenCalledTimes(1); expect(gpu.loss).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1); expect(owner.removeEventListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  });
});
