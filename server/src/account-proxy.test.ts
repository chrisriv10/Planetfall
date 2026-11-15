import {afterEach,expect,it,vi} from "vitest";
import {onRequest} from "../../functions/api/account/[action].js";

const origin="https://planetfall.example";
const env={ACCOUNT_SERVER_URL:"https://game.example",PLANETFALL_ACCOUNT_GATEWAY_SECRET:"fixture-gateway"};
afterEach(()=>vi.unstubAllGlobals());

it("authorizes only same-origin account writes and preserves separate cookie headers",async()=>{
  const cookies=new Headers({location:"/?account=return"});
  cookies.append("Set-Cookie","__Secure-neon-auth.session_token=fixture; Path=/; HttpOnly; Secure; SameSite=Lax");
  cookies.append("Set-Cookie","__Secure-neon-auth.session_challenge=; Path=/; Expires=Wed, 01 Jan 2025 00:00:00 GMT; HttpOnly; Secure");
  const forward=vi.fn(async()=>new Response(null,{status:303,headers:cookies}));
  vi.stubGlobal("fetch",forward);
  const bad=await onRequest({request:new Request(`${origin}/api/account/sign-out`,{method:"POST",headers:{origin:"https://other.example"}}),env,params:{action:"sign-out"}});
  expect(bad.status).toBe(403);
  expect(forward).not.toHaveBeenCalled();
  const callback=new Request(`${origin}/api/account/complete?fixture=verifier`,{headers:{cookie:"managed=fixture","cf-connecting-ip":"192.0.2.4"}});
  const result=await onRequest({request:callback,env,params:{action:"complete"}});
  expect(forward).toHaveBeenCalledWith(new URL("https://game.example/api/account/complete?fixture=verifier"),expect.objectContaining({redirect:"manual",headers:expect.any(Headers)}));
  expect(result.headers.get("location")).toBe("/?account=return");
  expect(result.headers.get("cache-control")).toContain("no-store");
  expect(result.headers.getSetCookie()).toEqual(cookies.getSetCookie());
});

it("leaves guest play available when the Pages runtime has no account configuration",async()=>{
  const forward=vi.fn();vi.stubGlobal("fetch",forward);
  const request=new Request(`${origin}/api/account/session`,{method:"POST",headers:{origin}});
  const reply=await onRequest({request,env:{},params:{action:"session"}});
  expect(await reply.json()).toEqual({state:"disabled"});
  expect(forward).not.toHaveBeenCalled();
});
