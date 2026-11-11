import {describe,expect,it} from "vitest";
import {PgInputOwnership} from "./pg-input-ownership";
const pad=(axis=0,pressed=false,index=0)=>({id:`pad-${index}`,index,connected:true,axes:[0,0,axis,0],buttons:[{pressed,touched:pressed,value:Number(pressed)}]});
describe("intentional PlanetGun input ownership",()=>{
 it("does not rotate from an already connected offset stick",()=>{
  const input=new PgInputOwnership();for(let frame=0;frame<120;frame++)expect(input.sample(pad(.3))).toBeUndefined();expect(input.method).toBe("keyboard");
 });
 it("keeps mouse ownership after a controller was in use until fresh controller intent",()=>{
  const input=new PgInputOwnership();input.sample(pad());expect(input.sample(pad(.8))).toBeDefined();input.keyboard();
  for(let frame=0;frame<60;frame++)expect(input.sample(pad(.8))).toBeUndefined();
  input.sample(pad());expect(input.sample(pad(.4))).toBeDefined();expect(input.method).toBe("gamepad");
 });
 it("allows an intentional new button or substantial stick change to reclaim a controller",()=>{
  const input=new PgInputOwnership();input.sample(pad(.3));expect(input.sample(pad(.3,true))).toBeDefined();input.keyboard();
  expect(input.sample(pad(.3,true))).toBeUndefined();expect(input.sample(pad(.9,true))).toBeDefined();
 });
 it("does not inherit another connected controller when the selected slot changes",()=>{const input=new PgInputOwnership();input.sample(pad());input.sample(pad(.8));expect(input.method).toBe("gamepad");expect(input.sample(pad(.3,false,1))).toBeUndefined();expect(input.method).toBe("keyboard");});
 it("returns to keyboard on disconnect and does not inherit the old pad on reconnect",()=>{
  const input=new PgInputOwnership();input.sample(pad());input.sample(pad(.8));expect(input.method).toBe("gamepad");
  expect(input.sample(null)).toBeUndefined();expect(input.method).toBe("keyboard");expect(input.sample(pad(.8,false,1))).toBeUndefined();
  input.reset();expect(input.method).toBe("keyboard");
 });
});
