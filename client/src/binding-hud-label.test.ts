import {afterEach,describe,expect,it} from "vitest";
import {bindingSettings} from "./binding-settings";
import {bindingHudLabel} from "./binding-hud-label";

afterEach(()=>bindingSettings.resetAll());
describe("binding HUD labels",()=>{
 it("reads the active settings profile and distinct submode/spectator contexts",()=>{
  expect(bindingSettings.rebind("planet-gun:planetzombies","interact",["Mouse4"]).ok).toBe(true);
  expect(bindingSettings.rebind("planet-gun:planetsiege","interact",["KeyH"]).ok).toBe(true);
  expect(bindingSettings.rebind("planet-gun:spectator","nextTarget",["KeyN"]).ok).toBe(true);
  expect(bindingHudLabel("planet-gun:planetzombies","interact","keyboard","R3")).toBe("MOUSE 5");
  expect(bindingHudLabel("planet-gun:planetsiege","interact","keyboard","R3")).toBe("H");
  expect(bindingHudLabel("planet-gun","interact","keyboard","R3")).toBe("E");
  expect(bindingHudLabel("planet-gun:spectator","nextTarget","keyboard")).toBe("N");
  bindingSettings.resetContext("planet-gun:planetzombies");
  expect(bindingHudLabel("planet-gun:planetzombies","interact","keyboard","R3")).toBe("E");
 });
 it("uses adapter-specific pad buttons only for the active controller method",()=>{
  bindingSettings.rebind("planet-run","dive",["KeyH"]);
  expect(bindingHudLabel("planet-run","dive","keyboard","X")).toBe("H");
  expect(bindingHudLabel("planet-run","dive","gamepad","X")).toBe("X");
  expect(bindingHudLabel("planet-gun:planetsiege","interact","gamepad","R3")).toBe("R3");
  expect(bindingHudLabel("planet-gun:planetwatch","ability1","gamepad","LB")).toBe("LB");
  // Sensor controls and spectator cycling have no controller shortcut in their adapters.
  expect(bindingHudLabel("planet-gun:planetsiege","camera","gamepad")).toBe("X");
  expect(bindingHudLabel("planet-run:spectator","nextTarget","gamepad")).toBe("E");
 });
 it("shows explicit unbinding and keeps Run spectator hints separate from movement",()=>{
  bindingSettings.rebind("planet-run","jump",null);
  bindingSettings.rebind("planet-run:spectator","previousTarget",["Mouse3"]);
  expect(bindingHudLabel("planet-run","jump","keyboard","A")).toBe("UNBOUND");
  expect(bindingHudLabel("planet-run:spectator","previousTarget","keyboard")).toBe("MOUSE 4");
  expect(bindingHudLabel("planet-run","dive","keyboard")).toBe("SHIFT / R SHIFT");
 });
});
