/// <reference types="node" />
import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {parse} from "postcss";
import {createLobbyRosterRow,type LobbyRosterPresentation} from "./lobby-roster-art";

/** Minimal DOM boundary: intentionally offers no HTML parsing API. */
class ElementStub {
 className="";textContent="";dataset:Record<string,string>={};children:ElementStub[]=[];
 attributes:Record<string,string>={};properties:Record<string,string>={};
 style={setProperty:(key:string,value:string)=>{this.properties[key]=value;}};
 setAttribute(key:string,value:string){this.attributes[key]=value;}
 append(...children:ElementStub[]){this.children.push(...children);}
}
const documentStub={createElement:()=>new ElementStub()}as unknown as Document;
const pilot:LobbyRosterPresentation={id:"one",name:"Pilot",color:"#70f5ff",isBot:false,ready:false,localId:"one",hostId:"one"};
const render=(input:LobbyRosterPresentation)=>createLobbyRosterRow(documentStub,input)as unknown as ElementStub;
const labels=(row:ElementStub)=>row.children[2].children.map(b=>b.textContent);

describe("shared lobby roster presentation",()=>{
 it("presents separate local, host and ready states without conflating them",()=>{
  const row=render(pilot);expect(labels(row)).toEqual(["YOU","HOST","NOT READY"]);
  expect(labels(render({...pilot,localId:null,ready:true}))).toEqual(["HOST","READY"]);
  expect(labels(render({...pilot,hostId:null}))).toEqual(["YOU","NOT READY"]);
  expect(row.dataset.playerId).toBe("one");expect(row.children[0].attributes["aria-hidden"]).toBe("true");
 });
 it("labels bots and both teams using text as well as color",()=>{
  for(const team of ["solar","void"]as const){const row=render({...pilot,isBot:true,localId:null,hostId:null,ready:true,team});
   expect(labels(row)).toEqual(["BOT",team.toUpperCase(),"READY"]);expect(row.dataset.team).toBe(team);
  }
 });
 it("treats names and identity colors as DOM values, never HTML",()=>{
  const name='<img src=x onerror="alert(1)"> & Pilot';const row=render({...pilot,name});
  expect(row.children[1].textContent).toBe(name);expect(row.children[1].children).toEqual([]);
  expect(row.properties["--player-color"]).toBe(pilot.color);expect(row.attributes["aria-label"]).toBe(`Pilot ${name}`);
 });
 it("gives all four shells explicit centering, a common maximum width, and mobile touch targets",()=>{
  const sheet=parse(readFileSync(new URL("./ui-foundation.css",import.meta.url),"utf8"));
  const prefix=":is(#lobby-screen,#br-lobby-screen,#pr-lobby-screen,#pg-lobby-screen).mode-lobby";
  const declarations=(selector:string,media?:string)=>{const result:Record<string,string>={};sheet.walkRules(rule=>{
   if(rule.selector!==selector)return;const query=rule.parent?.type==="atrule"?rule.parent.params:undefined;if(query!==media)return;
   rule.walkDecls(d=>{result[d.prop]=d.value;});
  });return result;};
  expect(declarations(prefix)).toMatchObject({"align-items":"center","justify-content":"center"});
  expect(declarations(`${prefix} :is(.lobby-card,.br-lobby-card,.pr-lobby-card,.pg-lobby-card).mode-panel`).width).toBe("min(680px,100%)");
  expect(declarations(`${prefix} :is(button,select,input:not([type=checkbox]):not([type=range]))`,"(max-width:700px)")["min-height"]).toBe("44px");
  expect(declarations(`${prefix} button`,"(max-width:700px)")["min-width"]).toBe("44px");
 });
});
