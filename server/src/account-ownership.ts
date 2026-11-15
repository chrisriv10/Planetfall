import type {PlayerProfiles} from "./player-profiles.js";
import type {ProfileDatabase} from "./profile-database.js";

export type LinkChoice = "check" | "link" | "existing" | "new";
export type LinkResult = {state:"linked"; key:string; claimedGuest:boolean} | {state:"conflict" | "unlinked"};

/** The ledger stays in place. Only its access path changes. */
export class AccountOwnership {
  private queue = Promise.resolve();
  private uncertain = new Set<string>();

  constructor(private database:ProfileDatabase, private profiles:PlayerProfiles,
    private issuer:string, private revokeGuest:(key:string)=>void) {}

  resolve(userId:string, guestToken:unknown, choice:LinkChoice, authorized:()=>boolean):Promise<LinkResult> {
    const result = this.queue.then(() => this.resolveNext(userId,guestToken,choice,authorized));
    this.queue = result.then(() => undefined, () => undefined);
    return result;
  }

  private confirmClaim(key:string):void {this.profiles.holdGuest(key);this.revokeGuest(key);}

  async reconcile():Promise<void> {
    for(const key of [...this.uncertain].slice(0,8)) {
      try {
        if(await this.database.linkedProfile(key))this.confirmClaim(key);
        else this.profiles.releaseGuest(key);
        this.uncertain.delete(key);
      } catch { return; }
    }
  }

  private async resolveNext(userId:string, guestToken:unknown, choice:LinkChoice, authorized:()=>boolean):Promise<LinkResult> {
    const existing = await this.database.accountLink(this.issuer,userId);
    if(!authorized())throw new Error("Account session ended");
    const guest = this.profiles.guestKey(guestToken);
    if(existing) {
      if(this.profiles.ownsBearer(existing,guestToken)) {
        this.confirmClaim(existing);
        this.uncertain.delete(existing);
        return {state:"linked",key:existing,claimedGuest:true};
      }
      if(guest && this.profiles.hasProgress(guest) && choice!=="existing")return {state:"conflict"};
      return {state:"linked",key:existing,claimedGuest:false};
    }
    if(choice!=="link" && choice!=="new")return {state:"unlinked"};

    const key = choice==="link" && guest ? guest : this.profiles.open(undefined).key;
    this.profiles.reserveGuest(key);
    try {
      if(await this.database.claimProfile(this.issuer,userId,key)) {
        this.confirmClaim(key);
        return {state:"linked",key,claimedGuest:guest===key};
      }
      const winner = await this.database.accountLink(this.issuer,userId);
      if(await this.database.linkedProfile(key))this.confirmClaim(key);
      else this.profiles.releaseGuest(key);
      if(winner===key)return {state:"linked",key,claimedGuest:guest===key};
      return {state:"conflict"};
    } catch(error) {
      // A connection can fail after commit. Until reconciled, never restore
      // bearer access to a profile whose ownership may have changed.
      try {
        if(!await this.database.linkedProfile(key))this.profiles.releaseGuest(key);
        else this.confirmClaim(key);
      } catch { this.uncertain.add(key);this.revokeGuest(key); }
      throw error;
    }
  }
}
