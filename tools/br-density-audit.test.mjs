import { test } from "node:test";
import assert from "node:assert/strict";
import { brDensityAt } from "./br-density-audit.mjs";

const empty=()=>({BR_STRUCTURES:[],BR_MAP_BLOCKS:[],BR_ROADS:[]});
test("large deck floors and named district centers never count as enclosure",()=>{
  const world={...empty(),BR_MAP_BLOCKS:[{kind:"platform",position:{x:0,y:2.5,z:0},size:{x:200,y:5,z:200}}],BR_POIS:[{position:{x:0,z:0}}],BR_SECONDARY_LOCATIONS:[{position:{x:0,z:0}}]};
  assert.equal(brDensityAt({x:0,z:0},world).enclosure,Infinity);
});
test("paving is reported separately from building proximity",()=>{
  const world={...empty(),BR_ROADS:[{from:{x:-100,z:0},to:{x:100,z:0},width:10}],BR_STRUCTURES:[{position:{x:0,z:80},size:{x:20,z:20}}]};
  assert.deepEqual(brDensityAt({x:0,z:0},world),{enclosure:70,pavement:0});
});
test("rotated tactical cover uses its real footprint, not an unrotated box",()=>{
  const world={...empty(),BR_MAP_BLOCKS:[{kind:"cover",position:{x:0,z:0},size:{x:20,z:2},rotation:{y:Math.PI/2}}]};
  assert.ok(Math.abs(brDensityAt({x:0,z:15},world).enclosure-5)<1e-8);
  assert.equal(brDensityAt({x:10,z:0},world).enclosure,9);
});
