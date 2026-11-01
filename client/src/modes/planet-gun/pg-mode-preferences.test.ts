import {it,expect} from "vitest";
import {PG_CHARACTER_PREFERENCES_KEY,pgReadCharacterPreference,pgSaveCharacterPreference} from "./pg-mode-preferences";
it("isolates saved hero/operator preferences from deathmatch Combat Kits",()=>{
 const values=new Map<string,string>([["planetfall:pg-kits:v1","unchanged"]]),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};
 pgSaveCharacterPreference(storage,"planetwatch","attack",{characterId:"solace"});pgSaveCharacterPreference(storage,"planetsiege","defend",{characterId:"brace",loadout:{primary:"pulse",secondary:"comet"}});
 expect(pgReadCharacterPreference(storage,"planetwatch","defend")?.characterId).toBe("solace");expect(pgReadCharacterPreference(storage,"planetsiege","attack")).toBeNull();expect(pgReadCharacterPreference(storage,"planetsiege","defend")?.loadout?.primary).toBe("pulse");expect(values.get("planetfall:pg-kits:v1")).toBe("unchanged");
 pgSaveCharacterPreference(storage,"planetsiege","defend",{characterId:"brace",loadout:{primary:"rail",secondary:"comet"}});expect(pgReadCharacterPreference(storage,"planetsiege","defend")?.loadout?.primary).toBe("pulse");
 values.set(PG_CHARACTER_PREFERENCES_KEY,'{"version":999,"choices":{}}');expect(pgReadCharacterPreference(storage,"planetwatch","attack")).toBeNull();values.set(PG_CHARACTER_PREFERENCES_KEY,"malformed");expect(pgReadCharacterPreference(storage,"planetwatch","attack")).toBeNull();
});
