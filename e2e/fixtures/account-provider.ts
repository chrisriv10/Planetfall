import {randomBytes} from "node:crypto";
import type {AccountProvider,AccountSession} from "../../server/src/account-provider.js";

export class FixtureAccountProvider implements AccountProvider {
  issuer="https://planetfall-test.invalid";
  readonly sessions=new Map<string,AccountSession>();
  private challenges=new Map<string,string>();

  credential(header:string):string {return this.cookie(header,"pf-test-session");}

  issue(userId:string):string {
    const sessionId=randomBytes(24).toString("hex");
    this.sessions.set(sessionId,{userId,sessionId,expiresAt:Date.now()+600_000,
      // Identical names demonstrate that the provider ID owns the profile.
      account:{name:"Stella Pilot"}});
    return sessionId;
  }

  async verify(credential:string):Promise<AccountSession|null> {
    const session=this.sessions.get(credential);
    return session&&session.expiresAt>Date.now()?session:null;
  }

  async start(cookie:string):Promise<Response> {
    const challenge=randomBytes(24).toString("hex");
    this.challenges.set(challenge,this.cookie(cookie,"pf-test-selected")||"stella");
    return Response.json({url:`/api/account/complete?fixture=${challenge}`},{headers:{
      "set-cookie":`pf-test-challenge=${challenge}; Path=/; HttpOnly; SameSite=Lax`,
    }});
  }

  async complete(url:URL,cookie:string):Promise<Response> {
    const challenge=this.cookie(cookie,"pf-test-challenge");
    const user=this.challenges.get(challenge);
    if(!user||url.searchParams.get("fixture")!==challenge)return new Response(null,{status:403});
    this.challenges.delete(challenge);
    const session=this.issue(user);
    return new Response(null,{status:303,headers:{location:"/?account=return","set-cookie":`pf-test-session=${session}; Path=/; HttpOnly; SameSite=Lax`}});
  }

  async signOut(credential:string):Promise<Response> {
    this.sessions.delete(credential);
    return new Response(null,{status:204,headers:{"set-cookie":"pf-test-session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax"}});
  }

  private cookie(header:string,name:string):string {
    return header.split(";").map(value=>value.trim()).find(value=>value.startsWith(`${name}=`))?.slice(name.length+1)??"";
  }
}
