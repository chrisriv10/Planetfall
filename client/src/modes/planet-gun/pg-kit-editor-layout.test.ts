/// <reference types="node" />
import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {parse} from "postcss";

const sheet=parse(readFileSync(new URL("./pg-kit-editor.css",import.meta.url),"utf8"));
function desktop(selector:string){const values:Record<string,string>={};sheet.walkRules(rule=>{
 if(rule.selector!==selector||rule.parent?.type!=="atrule"||rule.parent.params!=="(min-width:1101px)")return;
 rule.walkDecls(d=>{values[d.prop]=d.value;});
});return values;}
describe("desktop gunsmith viewport layout",()=>{
 it("reserves visible header/footer rows and bounds the scrollable work area",()=>{
  expect(desktop(".pg-kit-overlay .pg-kit-panel.mode-panel")).toMatchObject({height:"min(860px,calc(100dvh - 40px))","grid-template-rows":"auto auto minmax(0,1fr) auto auto",overflow:"hidden"});
  for(const selector of[".pg-kit-layout",".pg-kit-workbench",".pg-kit-content",".pg-kit-stage"])expect(desktop(selector)["min-height"]).toBe("0");
  for(const selector of[".pg-kit-tabs",".pg-kit-details"])expect(desktop(selector)["overflow-y"]).toBe("auto");
 });
 it("gives the actual weapon the flexible center and puts four sockets on one row",()=>{
  expect(desktop(".pg-kit-preview")).toMatchObject({height:"auto","min-height":"140px",flex:"1 1 140px"});
  expect(desktop(".pg-kit-sockets")["grid-template-columns"]).toBe("repeat(4,minmax(0,1fr))");
  expect(desktop(".pg-kit-overlay .pg-kit-panel .pg-kit-card")["min-height"]).toBe("88px");
 });
});
