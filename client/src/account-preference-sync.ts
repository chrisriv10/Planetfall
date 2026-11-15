import {BINDING_STORAGE_KEY,parseBindingSettings,validateAccountPreferences,type AccountControls,type AccountPreferences} from "@planetfall/shared";
import {PG_COMBAT_KITS_KEY,pgReadCombatKits} from "./modes/planet-gun/pg-combat-kits";
import {PG_CHARACTER_PREFERENCES_KEY} from "./modes/planet-gun/pg-mode-preferences";

export const PG_MODE_PREFERENCE_KEY = "planetfall:pg-mode:v1";
const keys = {
  [BINDING_STORAGE_KEY]:"bindings",
  [PG_COMBAT_KITS_KEY]:"pgKits", [PG_CHARACTER_PREFERENCES_KEY]:"pgCharacters", [PG_MODE_PREFERENCE_KEY]:"pgMode",
} as const;
type PreferenceKey = keyof typeof keys;

export interface AccountPreferenceRevision { revision:number; value:unknown; }

/** Stores signed-in drafts only in memory. The device's guest settings are separate. */
export class AccountPreferenceSync {
  value:AccountPreferences|null = null;
  private revision = 0;
  private context = "";
  private saved:AccountPreferences|null = null;
  private timer:ReturnType<typeof setTimeout>|undefined;
  private inFlight:Promise<void>|undefined;

  constructor(private onApply:()=>void,private onFeedback:(message:string)=>void,
    private onInvalid:()=>void) {}

  readonly storage = {
    getItem:(key:string):string|null=>{
      if(!this.value)return localStorage.getItem(key);
      const value = this.value[keys[key as PreferenceKey]];
      return value===undefined ? null : key===PG_MODE_PREFERENCE_KEY ? String(value) : JSON.stringify(value);
    },
    setItem:(key:string,raw:string):void=>{
      if(!this.value){localStorage.setItem(key,raw);return;}
      const name=keys[key as PreferenceKey];
      if(!name)return;
      this.update({[name]:key===PG_MODE_PREFERENCE_KEY?raw:JSON.parse(raw)});
    },
  };

  activate(context:string,record:AccountPreferenceRevision,guestControls?:AccountControls):void {
    this.clear();
    this.context=context;
    this.revision=record.revision;
    this.value=this.saved=validateAccountPreferences(record.value)??{version:1};
    if(record.revision===0&&guestControls) {
      const migrated:AccountPreferences={version:1,controls:guestControls,bindings:parseBindingSettings(localStorage.getItem(BINDING_STORAGE_KEY))};
      for(const [key,name] of Object.entries(keys)) {
        if(key===BINDING_STORAGE_KEY)continue;
        const raw = localStorage.getItem(key);
        if(!raw)continue;
        try {
          const item=key===PG_MODE_PREFERENCE_KEY?raw:key===PG_COMBAT_KITS_KEY?pgReadCombatKits(JSON.parse(raw)):JSON.parse(raw);
          Object.assign(migrated,validateAccountPreferences({version:1,[name]:item}));
        } catch { /* Keep other valid preferences from this device. */ }
      }
      this.update(migrated);
    }
    this.onApply();
  }

  deactivate():void {
    if(!this.context)return;
    this.clear();
    this.onApply();
  }

  refresh(context:string,record:AccountPreferenceRevision):void {
    if(this.context!==context||record.revision<=this.revision||this.inFlight||this.value!==this.saved)return;
    this.revision=record.revision;
    this.value=this.saved=validateAccountPreferences(record.value)??{version:1};
    this.onApply();
  }

  update(change:Partial<AccountPreferences>):void {
    if(!this.value)return;
    const value=validateAccountPreferences({...this.value,...change});
    if(!value||JSON.stringify(value)===JSON.stringify(this.value))return;
    this.value=value;
    this.queueSave();
  }

  async flush():Promise<void> {
    clearTimeout(this.timer);
    if(this.inFlight)await this.inFlight;
    await this.save();
  }

  private clear():void {
    clearTimeout(this.timer);
    this.context="";
    this.revision=0;
    this.value=this.saved=null;
    this.inFlight=undefined;
  }
  private queueSave():void {
    clearTimeout(this.timer);
    this.timer=setTimeout(()=>void this.save(),600);
  }
  private async save():Promise<void> {
    if(!this.value||this.inFlight||JSON.stringify(this.value)===JSON.stringify(this.saved))return;
    const value=this.value, context=this.context;
    const task=(async()=>{
      try {
        const response=await fetch("/api/account/preferences",{
          method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",keepalive:true,signal:AbortSignal.timeout(10_000),
          body:JSON.stringify({context,revision:this.revision,value}),
        });
        if(this.context!==context)return;
        if(response.status===401){this.onInvalid();return;}
        if(!response.ok&&response.status!==409)throw new Error("Preference write failed");
        const record=await response.json().catch(()=>null) as AccountPreferenceRevision|null;
        if(this.context!==context)return;
        if(!record){this.onInvalid();return;}
        this.revision=record.revision;
        this.saved=validateAccountPreferences(record.value)??{version:1};
        if(response.status===409) {
          this.value=this.saved;
          this.onApply();
          this.onFeedback("Another device saved newer settings. Those settings were loaded. You can reapply your changes here.");
        } else if(this.value===value) this.value=this.saved;
        else this.queueSave();
      } catch {
        if(this.context===context)this.onFeedback("Account settings could not sync. Changes are still active on this device for this session.");
      }
    })();
    this.inFlight=task;
    try { await task; }
    finally { if(this.inFlight===task)this.inFlight=undefined; }
  }
}
