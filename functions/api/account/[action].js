const paths = new Map([
  ["session","POST"], ["start","POST"], ["complete","GET"], ["sign-out","POST"], ["preferences","POST"],
]);

/** Keep cookies first-party on the Pages origin while gameplay stays on Render. */
export async function onRequest({request,env,params}) {
  const action = typeof params.action==="string" ? params.action : "";
  if(paths.get(action)!==request.method)return new Response(null,{status:404});
  const incoming = new URL(request.url);
  if(request.method==="POST"&&request.headers.get("origin")!==incoming.origin)
    return new Response(null,{status:403});
  if(!env.ACCOUNT_SERVER_URL||!env.PLANETFALL_ACCOUNT_GATEWAY_SECRET)
    return action==="session"?Response.json({state:"disabled"},{headers:{"cache-control":"private, no-store"}}):new Response(null,{status:404});
  const target = new URL(`/api/account/${action}`,env.ACCOUNT_SERVER_URL);
  if(target.protocol!=="https:")return new Response(null,{status:503});
  if(action==="complete")target.search=incoming.search;

  const headers = new Headers({
    "x-planetfall-gateway":env.PLANETFALL_ACCOUNT_GATEWAY_SECRET,
    "x-planetfall-client":request.headers.get("cf-connecting-ip")??"unknown",
  });
  for(const name of ["content-type","cookie","origin"]) {
    const value=request.headers.get(name);
    if(value)headers.set(name,value);
  }
  // No automatic redirects. Auth cookies may only be returned to this origin.
  try {
    const reply=await fetch(target,{method:request.method,headers,body:request.body,redirect:"manual"});
    const outgoing=new Headers({"cache-control":"private, no-store","referrer-policy":"no-referrer","x-content-type-options":"nosniff"});
    const type=reply.headers.get("content-type");
    if(type)outgoing.set("content-type",type);
    const retryAfter=reply.headers.get("retry-after");
    if(retryAfter)outgoing.set("retry-after",retryAfter);
    const destination=reply.headers.get("location");
    if(action==="complete"&&(destination==="/?account=return"||destination==="/?account=failed"))outgoing.set("location",destination);
    // Workers implements getAll specifically for Set-Cookie. Node uses getSetCookie.
    const cookies=reply.headers.getSetCookie?.()??reply.headers.getAll("Set-Cookie");
    for(const cookie of cookies)outgoing.append("set-cookie",cookie);
    return new Response(reply.body,{status:reply.status,headers:outgoing});
  } catch { return new Response(null,{status:503,headers:{"cache-control":"no-store"}}); }
}
