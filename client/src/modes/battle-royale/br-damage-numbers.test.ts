import {afterEach,describe,expect,it,vi} from "vitest";
import * as THREE from "three";
import {addBrDamageNumber,brDamageNumberLayout,BrDamageNumbers,BR_DAMAGE_NUMBER_LIFETIME_MS} from "./br-damage-numbers";

const hit=(shieldDamage=0,hpDamage=0)=>({targetId:"target",position:{x:1,y:2,z:3},shieldDamage,hpDamage,shieldBroken:false,headshot:false});
describe("BR damage number aggregation",()=>{
  it("keeps shield and HP channels visually distinct",()=>{const entries=addBrDamageNumber([],hit(8,5),100);expect(entries.map(e=>[e.kind,e.amount])).toEqual([["shield",8],["hp",5]]);});
  it("aggregates rapid automatic and shotgun damage without number spam",()=>{let entries=addBrDamageNumber([],hit(7,0),100);entries=addBrDamageNumber(entries,hit(9,0),240);expect(entries).toHaveLength(1);expect(entries[0].amount).toBe(16);entries=addBrDamageNumber(entries,hit(2,0),500);expect(entries).toHaveLength(2);});
  it("expires old markers and respects a bounded pool",()=>{const old=addBrDamageNumber([],hit(4,0),0);let entries=addBrDamageNumber(old,{...hit(0,2),targetId:"fresh"},BR_DAMAGE_NUMBER_LIFETIME_MS+1,1);expect(entries).toHaveLength(1);expect(entries[0].targetId).toBe("fresh");});
});

describe("BR damage number presentation",()=>{
  afterEach(()=>vi.unstubAllGlobals());
  function renderer(){
    const contexts:ReturnType<typeof context>[]=[];
    function context(){return {clearRect:vi.fn(),strokeText:vi.fn(),fillText:vi.fn(),beginPath:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),closePath:vi.fn(),stroke:vi.fn(),fill:vi.fn()};}
    vi.stubGlobal("document",{createElement:()=>{const c=context();contexts.push(c);return{width:0,height:0,getContext:()=>c};}});
    return{numbers:new BrDamageNumbers(4),contexts};
  }
  it("keeps shield and HP on opposite camera-facing lanes at every viewing angle",()=>{
    const {numbers}=renderer();numbers.hit(hit(30,12),100);numbers.update(100);
    const [shield,hp]=numbers.children as THREE.Sprite[];
    expect(shield.position).toEqual(hp.position);
    expect(shield.center.x).toBeGreaterThan(1);expect(hp.center.x).toBeLessThan(0);
    // Billboard extent is measured relative to its camera-facing anchor;
    // unlike world-X offsets these nonintersecting ranges do not depend on yaw.
    for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
      const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
      const shieldRight=right.clone().multiplyScalar((1-shield.center.x)*shield.scale.x);
      const hpLeft=right.clone().multiplyScalar(-hp.center.x*hp.scale.x);
      expect(shieldRight.dot(right)).toBeLessThan(hpLeft.dot(right));
    }
    numbers.dispose();
  });
  it("retains exact numeric text and fits large headshot totals without an overflowing glyph",()=>{
    for(const amount of [8,123,9999,1234567]){
      const entry=addBrDamageNumber([],{...hit(0,amount),headshot:true},0)[0];
      const layout=brDamageNumberLayout(entry,0);
      expect(layout.text).toBe(String(amount));expect(layout.fontSize).toBeGreaterThan(0);
      expect(layout.fontSize*layout.text.length*.65).toBeLessThanOrEqual(190);
      expect(layout.color).toBe("#ffd75a");
      const expired=brDamageNumberLayout(entry,BR_DAMAGE_NUMBER_LIFETIME_MS*2);
      expect(expired.opacity).toBe(0);expect(expired.rise).toBeCloseTo(3.28);
      expect(brDamageNumberLayout(entry,-100).opacity).toBe(1);
    }
  });
  it("uses shield-break marks only on shield and repaints only when the numeric style changes",()=>{
    const {numbers,contexts}=renderer();
    numbers.hit({...hit(20,7),shieldBroken:true,headshot:true},100);numbers.update(100);
    expect(contexts[0].fillText).toHaveBeenCalledWith("20",128,66,204);
    expect(contexts[1].fillText).toHaveBeenCalledWith("7",128,66,204);
    expect(contexts[0].moveTo).toHaveBeenCalledWith(86,110);
    expect(contexts[0].moveTo).toHaveBeenCalledWith(132,101);
    expect(contexts[1].moveTo).not.toHaveBeenCalledWith(86,110);
    numbers.update(150);expect(contexts[0].fillText).toHaveBeenCalledTimes(1);
    numbers.hit(hit(4,0),160);numbers.update(160);
    expect(contexts[0].fillText).toHaveBeenLastCalledWith("24",128,66,204);
    numbers.dispose();
  });
  it("gives shield breaks and headshots stronger but still separated emphasis",()=>{
    const normalShield=brDamageNumberLayout(addBrDamageNumber([],hit(20,0),0)[0],0);
    const brokenShield=brDamageNumberLayout(addBrDamageNumber([],{...hit(20,0),shieldBroken:true},0)[0],0);
    const normalHp=brDamageNumberLayout(addBrDamageNumber([],hit(0,20),0)[0],0);
    const headshot=brDamageNumberLayout(addBrDamageNumber([],{...hit(0,20),headshot:true},0)[0],0);
    expect(brokenShield.scale).toBeGreaterThan(normalShield.scale);
    expect(headshot.scale).toBeGreaterThan(normalHp.scale);
    expect(brokenShield.color).not.toBe(normalShield.color);
    expect(headshot.color).not.toBe(normalHp.color);
    expect(normalShield.centerX).toBeGreaterThan(1);
    expect(normalHp.centerX).toBeLessThan(0);
  });
  it("stacks distinct same-channel bursts and cleans up its fixed pool exactly once",()=>{
    const {numbers}=renderer();
    numbers.hit(hit(8,0),0);numbers.hit(hit(12,0),240);numbers.update(240);
    const sprites=numbers.children as THREE.Sprite[];
    expect(sprites[0].position.y-sprites[1].position.y).toBeGreaterThanOrEqual(.68);
    expect(sprites.filter(sprite=>sprite.visible)).toHaveLength(2);
    expect(sprites).toHaveLength(4);
    const disposeMaterial=sprites.map(sprite=>vi.spyOn(sprite.material,"dispose"));
    const disposeTexture=sprites.map(sprite=>vi.spyOn(sprite.material.map!,"dispose"));
    numbers.update(240+BR_DAMAGE_NUMBER_LIFETIME_MS);
    expect(sprites.every(sprite=>!sprite.visible)).toBe(true);
    numbers.dispose();numbers.dispose();
    expect(numbers.children).toHaveLength(0);
    for(const spy of [...disposeMaterial,...disposeTexture])expect(spy).toHaveBeenCalledTimes(1);
  });
});
