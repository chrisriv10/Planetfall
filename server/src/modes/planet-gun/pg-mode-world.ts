import {PG_MAP,PG_BALANCE,pgCollisionMap,pgCreateCollisionSnapshot,pgRayBox,type PgCollisionSnapshot,type PgDynamicPanel,type PgMap,type Vec3} from "@planetfall/shared";

/** Collision revisions belong to this room. Retain blockers for the entire shot rewind window. */
export class PgModeWorld {
 private state:PgCollisionSnapshot=pgCreateCollisionSnapshot(false);
 private cached:PgMap=PG_MAP;
 private history:{at:number;map:PgMap}[]=[];
 get map(){return this.cached;}
 get revision(){return this.state.topologyRevision??0;}
 snapshot():PgCollisionSnapshot{return structuredClone(this.state);}
 /** Fresh detached panel data without cloning unrelated room geometry. */
 panel(id:string):PgDynamicPanel|null{const panel=this.state.panels.find(panel=>panel.id===id);return panel?structuredClone(panel):null;}
 reset(panels:PgDynamicPanel[],now:number):void{const revision=this.state.revision+1,topologyRevision=this.revision+1;this.state={revision,topologyRevision,panels:structuredClone(panels).map(p=>({...p,revision}))};this.commit(now,true);}
 add(panel:PgDynamicPanel,now:number):boolean{if(this.state.panels.some(p=>p.id===panel.id))return false;this.state.revision++;this.state.panels.push({...structuredClone(panel),revision:this.state.revision});this.state.topologyRevision=this.revision+1;this.commit(now,true);return true;}
 damage(id:string,damage:number,now:number,breaching=false):number{const p=this.state.panels.find(p=>p.id===id&&p.active);if(!p||!Number.isFinite(damage)||damage<=0)return 0;const hit=Math.min(p.hp,damage*(p.reinforced&&!breaching ? .08 : 1));p.hp-=hit;const destroyed=p.hp<=0;if(destroyed){p.active=false;this.state.topologyRevision=this.revision+1;}p.revision=++this.state.revision;this.commit(now,destroyed);return hit;}
 reinforce(id:string,now:number):boolean{const p=this.state.panels.find(p=>p.id===id&&p.active&&!p.reinforced);if(!p)return false;p.reinforced=true;p.hp=p.maxHp=600;p.revision=++this.state.revision;this.commit(now,false);return true;}
 repair(id:string,amount:number,now:number):number{const p=this.state.panels.find(p=>p.id===id&&p.active);if(!p||!Number.isFinite(amount)||amount<=0)return 0;const gain=Math.min(amount,p.maxHp-p.hp);if(gain<=0)return 0;p.hp+=gain;p.revision=++this.state.revision;this.commit(now,false);return gain;}
 /** Restore an existing destroyed panel without changing its geometry or health cap. */
 rebuild(id:string,now:number):boolean{const p=this.state.panels.find(p=>p.id===id&&!p.active);if(!p||!Number.isFinite(now)||now<0||!Number.isFinite(p.maxHp)||p.maxHp<=0)return false;p.active=true;p.hp=p.maxHp;p.revision=++this.state.revision;this.state.topologyRevision=this.revision+1;this.commit(now,true);return true;}
 /** A rewound shot must pass both historical and current blockers; new cover cannot be shot through. */
 shotSolids(at:number,now:number){const old=[...this.history].reverse().find(h=>h.at<=at)?.map??this.history[0]?.map??this.cached;if(at>=now||old===this.cached)return this.cached.solids;const ids=new Set(this.cached.solids.map(s=>s.id));return [...this.cached.solids,...old.solids.filter(s=>!ids.has(s.id))];}
 visible(a:Vec3,b:Vec3):boolean{const d={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},n=Math.hypot(d.x,d.y,d.z);if(n<.01)return true;d.x/=n;d.y/=n;d.z/=n;return !this.cached.solids.some(s=>{const t=pgRayBox(a,d,s);return t!==null&&t<n-.05;});}
 private commit(now:number,topologyChanged:boolean){if(topologyChanged||!this.history.length){this.cached=pgCollisionMap(this.state);this.history.push({at:now,map:this.cached});}while(this.history.length>1&&this.history[1].at<now-PG_BALANCE.rewindMs-50)this.history.shift();}
}
