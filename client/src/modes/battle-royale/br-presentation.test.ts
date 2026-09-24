import { describe, expect, it } from "vitest";
import type { BrShipState } from "@planetfall/shared";
import { brStarlinerPosition } from "./br-presentation";

const ship:BrShipState={
  start:{x:-100,y:195,z:20},end:{x:300,y:195,z:-80},position:{x:-100,y:195,z:20},
  startedAt:1_000,endsAt:5_000,playersAboard:40
};

describe("Starliner presentation motion",()=>{
  it("interpolates continuously from authoritative route timing",()=>{
    expect(brStarlinerPosition(ship,1_000)).toEqual(ship.start);
    expect(brStarlinerPosition(ship,3_000)).toEqual({x:100,y:195,z:-30});
    expect(brStarlinerPosition(ship,5_000)).toEqual(ship.end);
  });

  it("clamps delayed or early render clocks to the route",()=>{
    expect(brStarlinerPosition(ship,-20_000)).toEqual(ship.start);
    expect(brStarlinerPosition(ship,20_000)).toEqual(ship.end);
  });
});
