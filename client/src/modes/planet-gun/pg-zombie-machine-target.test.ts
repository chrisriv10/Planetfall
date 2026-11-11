import {describe,expect,it} from "vitest";
import {PG_ZOMBIE_FORGE_SITE,PG_ZOMBIE_TONIC_SOCKETS,PG_ZOMBIE_WALL_BUYS} from "@planetfall/shared";
import {pgZombieMachineTarget} from "./pg-zombie-machine-target";

describe("physical machine targeting",()=>{
 it("keeps nearby Nova and Forge consoles distinct and chooses each tonic and sidearm directly",()=>{
  expect(pgZombieMachineTarget(PG_ZOMBIE_FORGE_SITE.interaction)?.kind).toBe("forge");
  for(const site of [...PG_ZOMBIE_TONIC_SOCKETS,...PG_ZOMBIE_WALL_BUYS])expect(pgZombieMachineTarget(site.interaction)?.site.id,site.id).toBe(site.id);
 });
 it("requires range and visibility and can select a clear neighboring console",()=>{
  expect(pgZombieMachineTarget({x:0,y:0,z:0})).toBeNull();
  expect(pgZombieMachineTarget(PG_ZOMBIE_FORGE_SITE.interaction,()=>false)).toBeNull();
  const nova=PG_ZOMBIE_WALL_BUYS.find(site=>site.id==="rack-nova")!;
  expect(pgZombieMachineTarget(nova.interaction,at=>at!==nova.interaction)?.kind).toBe("forge");
 });
});
