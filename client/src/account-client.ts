import {createAccountPanel,type AccountPanelView} from "./account-panel";
import {AccountPreferenceSync,type AccountPreferenceRevision} from "./account-preference-sync";
import {clearNetworkProfile,getGuestProfile,GUEST_TOKEN_KEY,type GameSocket} from "./network";
import type {AccountControls} from "@planetfall/shared";

type Choice = "link" | "existing" | "new";
type Auth = {profile?:true;profileToken?:string;accountTicket?:string};
type Account = NonNullable<AccountPanelView["account"]>;
type SessionReply = {state:"signed-in";account:Account;ticket:string;preferences:AccountPreferenceRevision;context:string;claimedGuest:boolean} |
  {state:"conflict"|"unlinked";account:Account;context:string} | {state:"guest"|"disabled"};
const INTENT = "planetfall:account-intent";
const APPROVAL = "planetfall:account-approval";
const CHANGE = "planetfall:account-change";
const ACTIVE_ACCOUNT = "planetfall:account-active";

interface AccountHooks {
  leaveRoom:()=>Promise<boolean>;
  clearRoom:()=>void;
  render:()=>void;
  applyPreferences:()=>void;
  guestControls:()=>AccountControls;
  cosmeticName:()=>string|undefined;
  overlay:(open:boolean)=>void;
  notify:(message:string)=>void;
}

export class AccountClient {
  readonly preferences:AccountPreferenceSync;
  readonly panel = createAccountPanel(action=>void this.act(action));
  private socket!:GameSocket;
  private state:AccountPanelView["state"]="guest";
  private account:Account|undefined;
  private context="";
  private pendingContext="";
  private firstTicket:string|undefined;
  private feedback="";
  private generation=0;
  private busy=false;
  private focus:HTMLElement|null=null;
  private unavailable=false;
  private waitingForAccount=false;
  private ticketRetries=0;

  constructor(private hooks:AccountHooks) {
    this.preferences=new AccountPreferenceSync(hooks.applyPreferences,message=>this.report(message),()=>this.expire());
  }

  attach(socket:GameSocket):void {
    this.socket=socket;
    socket.on("profile:ready",()=>this.render());
    socket.on("profile:state",()=>this.render());
    socket.on("connect",()=>{this.ticketRetries=0;});
    socket.on("connect_error",error=>{
      if(!this.context||this.busy||socket.active||error.message!=="Planetfall account session unavailable")return;
      if(this.ticketRetries++===0)socket.connect();
      else this.deferAccount();
    });
    socket.on("account:ended",reason=>{
      if(this.busy)return;
      if(reason==="linked")void this.restore();
      else if(reason==="unavailable")this.deferAccount();
      else this.expire(reason==="signed-out"?"Signed out on this browser.":undefined);
    });
    socket.on("disconnect",reason=>{
      if(reason==="io server disconnect"&&this.context&&!this.busy)this.deferAccount();
    });
    addEventListener("storage",event=>{
      if(event.key===CHANGE&&!this.busy)void this.restore(false);
    });
    document.addEventListener("visibilitychange",()=>{
      if(document.hidden&&this.context)void this.preferences.flush();
    });
  }

  start():void {
    const url=new URL(location.href);
    const returned=url.searchParams.get("account");
    if(returned!==null){url.searchParams.delete("account");history.replaceState(history.state,"",url);}
    const intent=sessionStorage.getItem(INTENT);
    sessionStorage.removeItem(INTENT);
    if(returned==="return"&&(intent==="link"||intent==="new"))void this.restore(true,intent);
    else if(returned==="failed") {
      this.state="unavailable";
      this.feedback="Google sign-in did not complete. You can try again or continue as a guest.";
      this.open();
      this.connect();
    } else void this.restore(false);
  }

  async credentials():Promise<Auth> {
    if(!this.context)return {profile:true,profileToken:localStorage.getItem(GUEST_TOKEN_KEY)??undefined};
    if(this.firstTicket){const ticket=this.firstTicket;this.firstTicket=undefined;return {accountTicket:ticket};}
    const context=this.context;
    try {
      const result=await this.session("existing",context);
      if(context===this.context&&result.state==="signed-in"&&result.context===context) {
        this.preferences.refresh(context,result.preferences);
        return {accountTicket:result.ticket};
      }
    } catch {
      if(context===this.context)queueMicrotask(()=>{if(context===this.context)this.deferAccount();});
      return {accountTicket:"unavailable"};
    }
    if(context===this.context)queueMicrotask(()=>{if(context===this.context)this.expire();});
    return {accountTicket:"unavailable"};
  }

  get signedIn():boolean {return Boolean(this.context);}
  get changing():boolean {return this.busy;}
  open():void {
    if(!this.panel.root.hidden)return;
    this.focus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    this.panel.root.hidden=false;
    this.render();
    this.hooks.overlay(true);
  }
  close():void {
    this.panel.root.hidden=true;
    this.hooks.overlay(false);
    if(this.focus?.isConnected&&this.focus.offsetParent!==null)this.focus.focus();
    this.focus=null;
  }

  private render():void {
    this.panel.render({state:this.state,account:this.account,profile:getGuestProfile()??undefined,
      cosmeticName:this.hooks.cosmeticName(),feedback:this.feedback});
    this.hooks.render();
  }

  private report(message:string):void {
    this.feedback=message;
    this.render();
    if(this.panel.root.hidden)this.hooks.notify(message);
  }

  private resetIdentity():void {
    this.socket.disconnect();
    this.socket.sendBuffer.length=0;
    clearNetworkProfile();
    this.context="";
    this.pendingContext="";
    this.ticketRetries=0;
    this.firstTicket=undefined;
    this.account=undefined;
    this.hooks.clearRoom();
    this.preferences.deactivate();
  }

  private connect():void {this.render();this.socket.connect();}

  private expire(message="Your account session ended. Sign in again to recover your progression."):void {
    if(!this.context)return;
    ++this.generation;
    sessionStorage.removeItem(APPROVAL);
    localStorage.removeItem(ACTIVE_ACCOUNT);
    this.resetIdentity();
    this.state="guest";
    this.busy=false;
    this.report(message);
    this.connect();
  }

  private deferAccount():void {
    ++this.generation;
    this.resetIdentity();
    this.busy=false;
    this.waitingForAccount=true;
    this.state="unavailable";
    this.feedback="Your account couldn’t be verified. Try again, or continue as a guest.";
    this.open();
    this.render();
  }

  private async restore(show=false,choice?:Choice,expectedContext?:string):Promise<void> {
    if(this.busy)return;
    const generation=++this.generation;
    this.busy=true;
    this.state="busy";
    if(show)this.open();
    this.render();
    const guestToken=localStorage.getItem(GUEST_TOKEN_KEY);
    const approval=!choice?sessionStorage.getItem(APPROVAL):null;
    const guestControls=this.hooks.guestControls();
    try {
      let result:SessionReply;
      try {result=await this.session(approval?"existing":choice,expectedContext??approval??undefined,guestToken);}
      catch(error){if(!approval)throw error;result=await this.session(undefined,undefined,guestToken);}
      if(generation!==this.generation)return;
      if(result.state==="signed-in") {
        if(result.claimedGuest&&guestToken&&localStorage.getItem(GUEST_TOKEN_KEY)===guestToken)localStorage.removeItem(GUEST_TOKEN_KEY);
        this.resetIdentity();
        this.context=result.context;
        this.firstTicket=result.ticket;
        this.account=result.account;
        this.state="signed-in";
        this.unavailable=false;
        this.waitingForAccount=false;
        this.feedback=show?(result.claimedGuest?"Guest progress linked to your Google account.":"Signed in with Google."):"";
        sessionStorage.setItem(APPROVAL,result.context);
        localStorage.setItem(ACTIVE_ACCOUNT,"1");
        this.preferences.activate(result.context,result.preferences,result.claimedGuest?guestControls:undefined);
        if(show)this.announce();
      } else {
        if(this.context)this.resetIdentity();
        sessionStorage.removeItem(APPROVAL);
        const expired=result.state==="guest"&&localStorage.getItem(ACTIVE_ACCOUNT)!==null;
        localStorage.removeItem(ACTIVE_ACCOUNT);
        this.waitingForAccount=false;
        this.account="account" in result?result.account:undefined;
        this.pendingContext="context" in result?result.context:"";
        this.unavailable=result.state==="disabled";
        this.state=result.state==="conflict"?"conflict":show&&result.state==="guest"?"unavailable":"guest";
        this.feedback=result.state==="unlinked"?"Sign in with Google to finish setting up this account.":
          this.state==="unavailable"?"Google sign-in did not complete.":expired?"Your account session ended. Sign in again to recover your progression.":"";
        if(this.state==="conflict")this.open();
      }
      this.connect();
    } catch {
      if(generation!==this.generation)return;
      if(!this.context&&localStorage.getItem(ACTIVE_ACCOUNT)){this.deferAccount();return;}
      // A failed check has no authority to switch a currently active account.
      this.state=this.context?"signed-in":show?"unavailable":"guest";
      if(show)this.report("We couldn’t check your account. Please try again.");
      this.connect();
    } finally {if(generation===this.generation)this.busy=false;}
  }

  private async act(action:"google"|"guest"|"account"|"signout"|"switch"|"retry"|"close"):Promise<void> {
    if(action==="close"){this.close();return;}
    if(this.busy)return;
    if(action==="account") {
      if(await this.hooks.leaveRoom())await this.restore(true,"existing",this.pendingContext);
      return;
    }
    if(action==="retry") {
      await this.restore(true);
      return;
    }
    if(action==="guest"&&this.state!=="conflict"){
      if(this.waitingForAccount){this.waitingForAccount=false;this.connect();}
      this.close();return;
    }
    if(!await this.hooks.leaveRoom())return;
    const previous=this.state;
    this.busy=true;
    this.state="busy";
    this.render();
    try {
      if(action!=="google") {
        const context=this.context||this.pendingContext;
        if(this.context)await this.preferences.flush();
        const response=await this.post("sign-out",{context:context||undefined});
        if(!response.ok)throw new Error("Sign-out unavailable");
        sessionStorage.removeItem(APPROVAL);
        localStorage.removeItem(ACTIVE_ACCOUNT);
        this.resetIdentity();
        this.state="guest";
        this.feedback=action==="guest"?"Your guest progress is ready.":"Signed out. Guest play is available.";
        this.announce();
        if(action!=="switch") {this.connect();if(action==="guest")this.close();return;}
      }
      if(this.unavailable)throw new Error("Accounts disabled");
      const response=await this.post("start",{switchAccount:action==="switch"});
      if(!response.ok)throw new Error("Sign-in unavailable");
      const {url}=await response.json() as {url:string};
      sessionStorage.setItem(INTENT,action==="switch"?"new":"link");
      location.assign(url);
    } catch {
      this.state=this.context?"signed-in":previous==="conflict"&&action==="guest"?"conflict":"unavailable";
      this.report(action==="signout"||action==="guest"?"Sign-out could not be confirmed. Please try again.":"Google sign-in is unavailable right now. Guest play is still available.");
      this.connect();
    } finally {this.busy=false;}
  }

  private announce():void {localStorage.setItem(CHANGE,crypto.randomUUID());}

  private post(endpoint:string,body:object={}):Promise<Response> {
    return fetch(`/api/account/${endpoint}`,{method:"POST",headers:{"Content-Type":"application/json"},
      cache:"no-store",signal:AbortSignal.timeout(15_000),body:JSON.stringify(body)});
  }

  private async session(choice?:Choice,context?:string,token=localStorage.getItem(GUEST_TOKEN_KEY)):Promise<SessionReply> {
    const response=await this.post("session",{choice,context,guestToken:token??undefined});
    if(response.status===404)return {state:"disabled"};
    if(!response.ok)throw new Error("Session check failed");
    return await response.json() as SessionReply;
  }
}
