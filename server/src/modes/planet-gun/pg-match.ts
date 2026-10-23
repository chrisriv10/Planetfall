import {PG_BALANCE as B,type PgTeam} from "@planetfall/shared";

/** Match clock uses server time exclusively; tied regulation enters sudden death. */
export class PgMatch {
  phase:"lobby"|"countdown"|"playing"|"overtime"|"results"="lobby";
  phaseEndsAt=0;
  scores:Record<PgTeam,number>={solar:0,void:0};
  winner:PgTeam|null=null;
  private resolvedDeaths=new Map<string,number>();
  constructor(readonly scoreLimit:25|50|75=75){}
  start(now:number):boolean {
    if(this.phase!=="lobby")return false;
    this.phase="countdown";this.phaseEndsAt=now+B.countdownMs;
    this.scores={solar:0,void:0};this.winner=null;this.resolvedDeaths.clear();return true;
  }
  update(now:number):void {
    if(this.phase==="countdown"&&now>=this.phaseEndsAt){this.phase="playing";this.phaseEndsAt+=B.matchMs;}
    if(this.phase==="playing"&&now>=this.phaseEndsAt){
      if(this.scores.solar===this.scores.void){this.phase="overtime";this.phaseEndsAt=0;}
      else this.finish(this.scores.solar>this.scores.void?"solar":"void");
    }
  }
  /** A victim life may resolve only once, even when several pellets kill in one server tick. */
  elimination(victimId:string,lifeId:number,killerTeam:PgTeam|null,victimTeam:PgTeam):boolean {
    if(this.phase!=="playing"&&this.phase!=="overtime")return false;
    if((this.resolvedDeaths.get(victimId)??-1)>=lifeId)return false;
    this.resolvedDeaths.set(victimId,lifeId);
    if(killerTeam&&killerTeam!==victimTeam){
      this.scores[killerTeam]++;
      if(this.phase==="overtime"||this.scores[killerTeam]>=this.scoreLimit)this.finish(killerTeam);
    }
    return true;
  }
  private finish(team:PgTeam):void{this.winner=team;this.phase="results";this.phaseEndsAt=0;}
}
