import type {InputMethod} from "../../input";

type PgOwnershipDevice=Pick<Gamepad,"id"|"index"|"connected"|"axes"|"buttons">;

/** Select an intentional device; a held/drifting stick cannot undo a mouse takeover. */
export class PgInputOwnership {
 private source:InputMethod="keyboard";
 private index:number|null=null;private id:string|null=null;
 private axes:number[]=[];
 private buttons:boolean[]=[];
 private neutralSeen=false;
 get method():InputMethod{return this.source;}
 keyboard():void{this.source="keyboard";this.neutralSeen=false;}
 sample<T extends PgOwnershipDevice>(pad:T|null|undefined):T|undefined{
  if(!pad?.connected){this.index=null;this.id=null;this.axes=[];this.buttons=[];this.neutralSeen=false;this.source="keyboard";return undefined;}
  const same=this.index===pad.index&&this.id===pad.id;if(!same){this.source="keyboard";this.neutralSeen=false;}let neutral=true,pressed=false,moved=false,leftNeutral=false;
  for(let i=0;i<4;i++){const value=pad.axes[i]??0;neutral&&=Math.abs(value)<=.18;moved||=same&&Math.abs(value)>.25&&Math.abs(value-(this.axes[i]??0))>.2;leftNeutral||=same&&this.neutralSeen&&Math.abs(value)>.25;this.axes[i]=value;}
  for(let i=0;i<pad.buttons.length;i++){const value=pad.buttons[i].pressed;neutral&&=!value;pressed||=same&&value&&!this.buttons[i];this.buttons[i]=value;}
  this.buttons.length=pad.buttons.length;
  if(pressed||moved||leftNeutral){this.source="gamepad";this.neutralSeen=false;}
  if(neutral)this.neutralSeen=true;
  this.index=pad.index;this.id=pad.id;
  return this.source==="gamepad"?pad:undefined;
 }
 reset():void{this.source="keyboard";this.index=null;this.id=null;this.axes=[];this.buttons=[];this.neutralSeen=false;}
}
