import {createHash} from "node:crypto";
import {readFileSync,existsSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {describe,expect,it} from "vitest";
import {AUDIO_CUES,MUSIC_TRACKS,PG_AUDIO_FAMILY,SAMPLE_URLS,WEAPON_AUDIO} from "./audio-catalog";

const root=fileURLToPath(new URL("../../",import.meta.url));
type SourceEntry={localFile:string;sourcePage:string;license:string;creator:string;accessed:string;sourceSha256:string;sourcePageSha256:string;licenseEvidencePath:string;sha256:string;measurements:{peakDbfs:number;truePeakDbfs:number}};
const manifest=JSON.parse(readFileSync(root+"client/public/audio/refresh/source-manifest.json","utf8")) as Record<string,SourceEntry>;
const preservedMusic=JSON.parse(readFileSync(root+"client/public/audio/preserved-music-sources.json","utf8")) as Record<string,{localFile:string;license:string;sha256:string;sourcePage:string}>;
describe("licensed recording catalog integrity",()=>{
  it("resolves cues to documented CC0 recordings and music to explicitly licensed assets",()=>{
    const urls=new Set(Object.values(SAMPLE_URLS));
    for(const cue of Object.values(AUDIO_CUES))for(const layer of cue.layers){
      expect(layer.pool.length).toBeGreaterThan(0);
      for(const choice of layer.pool){expect(SAMPLE_URLS[choice.sample]).toBeTruthy();expect(manifest[choice.sample]?.license).toBe("CC0-1.0");expect(choice.variation).toBeLessThanOrEqual(.035);}
    }
    for(const music of Object.values(MUSIC_TRACKS))expect([...Object.values(manifest),...Object.values(preservedMusic)].some(entry=>"/"+entry.localFile.replace("client/public/","")===music.url)).toBe(true);
    for(const url of urls)expect(existsSync(root+"client/public"+url)).toBe(true);
  });
  it("preserves the user's original David KBD themes, gains and unchanged audio bytes",()=>{
    expect(MUSIC_TRACKS.menu).toEqual({url:"/audio/low-battery.ogg",gain:.14});
    expect(MUSIC_TRACKS.game).toEqual({url:"/audio/bot-city.ogg",gain:.18});
    expect(Object.keys(preservedMusic).sort()).toEqual(["game","menu"]);
    for(const record of Object.values(preservedMusic)){
      expect(record.license).toBe("CC-BY-4.0");
      expect(record.sourcePage).toBe("https://davidkbd.itch.io/my-little-bots-crazy-music-for-robots-asset-pack");
      expect(createHash("sha256").update(readFileSync(root+record.localFile)).digest("hex")).toBe(record.sha256);
    }
  });
  it("retains exact derivative hashes and measured headroom for every selected file",()=>{
    for(const entry of Object.values(manifest)){
      const evidence=JSON.parse(readFileSync(root+entry.licenseEvidencePath,"utf8"));
      expect(evidence.license).toBe(entry.license);expect(evidence.page).toBe(entry.sourcePage);
      expect(evidence.sourcePageSha256).toBe(entry.sourcePageSha256);expect(evidence.verifiedDate).toBe(entry.accessed);
      const bytes=readFileSync(root+entry.localFile);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
      expect(entry.sourceSha256).toMatch(/^[a-f0-9]{64}$/);expect(entry.sourcePage).toMatch(/^https:\/\/(kenney.nl|opengameart.org)\//);
      expect(entry.creator.length).toBeGreaterThan(0);expect(entry.measurements.peakDbfs).toBeLessThan(0);expect(entry.measurements.truePeakDbfs).toBeLessThanOrEqual(-1);
    }
  });
  it("keeps all ten PG families and five phase contacts data driven",()=>{
    expect(Object.keys(PG_AUDIO_FAMILY)).toHaveLength(10);
    for(const key of Object.values(PG_AUDIO_FAMILY)){
      const family=WEAPON_AUDIO[key];expect(AUDIO_CUES[family.fire]).toBeTruthy();expect(AUDIO_CUES[family.distant]).toBeTruthy();
      for(const phase of ["release","manipulate","insert","lock","charge"] as const)expect(AUDIO_CUES[family.reload[phase]]).toBeTruthy();
    }
  });
});
