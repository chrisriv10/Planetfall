import {afterEach,expect,it,vi} from "vitest";
import {createNeonAccountProvider} from "./account-provider.js";

const origin="https://planetfall.example";
const upstream="https://ep-project.neonauth.neon.tech/neondb/auth";
const challenge="__Secure-neon-auth.session_challenge=opaque-challenge";
const sessionCookie="__Secure-neon-auth.session_token=opaque-session";
const provider=()=>createNeonAccountProvider(upstream,"a-test-only-cookie-secret-with-enough-characters",origin);
const date=new Date();
const valid=()=>({
  session:{id:"session-1",userId:"provider-stable-id",token:"private",createdAt:date,updatedAt:date,expiresAt:new Date(Date.now()+600_000)},
  user:{id:"provider-stable-id",name:"Stella",email:"private@example.test",image:"https://avatar.example/pilot",createdAt:date,updatedAt:date},
});
afterEach(()=>vi.unstubAllGlobals());

it("uses the SDK’s verifier exchange and returns host-only secure cookies",async()=>{
  const upstreamFetch=vi.fn(async(input:string,init:RequestInit)=>{
    const url=new URL(input),headers=new Headers(init.headers);
    if(url.pathname.endsWith("/sign-in/social")) {
      expect(headers.get("origin")).toBe(origin);
      expect(JSON.parse(String(init.body))).toMatchObject({provider:"google",callbackURL:`${origin}/api/account/complete`});
      return Response.json({url:"https://accounts.google.com/o/oauth2/auth?state=opaque"},{headers:{
        "set-cookie":`${challenge}; Domain=neon.tech; Path=/; HttpOnly; Secure; SameSite=None; Partitioned`,
      }});
    }
    if(url.searchParams.has("neon_auth_session_verifier")) {
      expect(headers.get("cookie")).toContain(challenge);
      const reply=new Headers({"set-cookie":`${sessionCookie}; Domain=neon.tech; Path=/; HttpOnly; Secure`});
      reply.append("set-cookie","__Secure-neon-auth.session_challenge=; Max-Age=0; Path=/; HttpOnly; Secure");
      return Response.json(valid(),{headers:reply});
    }
    return Response.json(valid());
  });
  vi.stubGlobal("fetch",upstreamFetch);
  const auth=provider();
  const start=await auth.start("",true);
  expect(await start.json()).toEqual({url:"https://accounts.google.com/o/oauth2/auth?state=opaque&prompt=select_account"});
  const startCookies=start.headers.getSetCookie();
  expect(startCookies).toHaveLength(1);
  expect(startCookies[0]).toContain("SameSite=Lax");
  expect(startCookies[0]).not.toMatch(/Domain=|Partitioned/);
  const callback=new URL(`${origin}/api/account/complete?neon_auth_session_verifier=opaque-verifier`);
  expect((await auth.complete(callback,"")).headers.get("location")).toBe("/?account=failed");
  const done=await auth.complete(callback,challenge);
  expect(done.headers.get("location")).toBe("/?account=return");
  expect(done.headers.getSetCookie()).toHaveLength(2);
  expect(done.headers.getSetCookie()[0]).toContain("HttpOnly; Secure; SameSite=Lax");
  expect(done.headers.getSetCookie().join(" ")).not.toMatch(/Domain=|Partitioned|session_data/);
});

it("looks up the live provider identity and keeps its private fields out of the response",async()=>{
  const auth=provider();
  const fakeFetch=vi.fn(async(input:string,init:RequestInit)=>{
    const url=new URL(input);
    expect(url.pathname).toBe("/neondb/auth/get-session");
    expect(url.searchParams.get("disableCookieCache")).toBe("true");
    expect(new Headers(init.headers).get("cookie")).toBe(sessionCookie);
    return Response.json(valid());
  });
  vi.stubGlobal("fetch",fakeFetch);
  expect(await auth.verify(auth.credential("__Secure-neon-auth.local.session_data=cached"))).toBeNull();
  expect(fakeFetch).not.toHaveBeenCalled();
  const verified=await auth.verify(auth.credential(`${sessionCookie}; game=ignored; __Secure-neon-auth.local.session_data=ignored`));
  expect(verified).toEqual({userId:"provider-stable-id",sessionId:"session-1",expiresAt:expect.any(Number),account:{name:"Stella",avatar:"https://avatar.example/pilot"}});
  fakeFetch.mockResolvedValueOnce(Response.json({session:null,user:null}));
  expect(await auth.verify(sessionCookie)).toBeNull();
});
