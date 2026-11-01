import type {PgTeam} from "@planetfall/shared";
const other=(t:PgTeam):PgTeam=>t==="solar"?"void":"solar";
/** Fixed regulation halves followed by at most three equal-economy role-swapped pairs. */
export class PgRoundSeries {
 round=1;attackTeam:PgTeam="solar";scores:Record<PgTeam,number>={solar:0,void:0};done=false;winner:PgTeam|null=null;
 private pairWinner:PgTeam|null=null;
 constructor(readonly half:3|6){}
 get overtime(){return this.round>this.half*2;}
 resolve(winner:PgTeam):void{
  if(this.done)return;this.scores[winner]++;
  if(!this.overtime&&this.scores[winner]>=this.half+1){this.done=true;this.winner=winner;return;}
  if(this.overtime){const offset=this.round-this.half*2;
   if(offset%2===1)this.pairWinner=winner;
   else if(this.pairWinner===winner){this.done=true;this.winner=winner;return;}
   else if(offset>=6){this.done=true;return;}
  }
  this.round++;if(this.round===this.half+1||this.round>this.half*2)this.attackTeam=other(this.attackTeam);
 }
}
