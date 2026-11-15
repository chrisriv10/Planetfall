import {
  extractNeonAuthCookies, handleAuthProxyRequest, handleAuthRequest, NEON_AUTH_COOKIE_PREFIX, NEON_AUTH_SESSION_COOKIE_NAME,
  parseCookieValue, parseSessionData, parseSetCookies, processAuthMiddleware, resolveNeonAuthLogging, serializeSetCookie,
} from "@neon/auth/server";

export interface AccountSession {
  userId:string;
  sessionId:string;
  expiresAt:number;
  account:{name:string; avatar?:string};
}

export interface AccountProvider {
  issuer:string;
  credential(cookie:string):string;
  verify(credential:string):Promise<AccountSession|null>;
  start(cookie:string,selectAccount:boolean):Promise<Response>;
  complete(url:URL,cookie:string):Promise<Response>;
  signOut(credential:string):Promise<Response>;
}

export function createNeonAccountProvider(baseUrl:string,cookieSecret:string,origin:string):AccountProvider {
  const log = resolveNeonAuthLogging({logLevel:"silent"});
  const config = {baseUrl,cookieSecret,sameSite:"lax" as const,log};
  const managedGoogleStart = new URL(`${baseUrl.replace(/\/$/,"")}/sign-in/social/init`);
  const endpoint = (path:string) => new URL(path,origin);
  function request(url:URL,cookie:string,body?:object) {
    const headers = new Headers({origin,cookie:extractNeonAuthCookies(cookie)});
    if(body)headers.set("content-type","application/json");
    return new Request(url,{method:body?"POST":"GET",headers,body:body?JSON.stringify(body):undefined});
  }
  const proxy = (path:string,req:Request) => handleAuthProxyRequest({...config,path,request:req});
  function setFirstPartyCookies(headers:Headers,values:string[]) {
    for(const value of values)for(const cookie of parseSetCookies(value)) {
      if(!cookie.name.startsWith(`${NEON_AUTH_COOKIE_PREFIX}.`))continue;
      // The game does a fresh provider lookup and never relies on this cache.
      if(cookie.name==="__Secure-neon-auth.local.session_data")continue;
      headers.append("set-cookie",serializeSetCookie({...cookie,domain:undefined,path:"/",secure:true,httpOnly:true,partitioned:false,sameSite:"lax"}));
    }
  }
  return {
    issuer:baseUrl,
    credential(cookie) {
      const value = parseCookieValue(cookie,NEON_AUTH_SESSION_COOKIE_NAME);
      return value && value.length<=2048 ? `${NEON_AUTH_SESSION_COOKIE_NAME}=${value}` : "";
    },
    async verify(credential) {
      if(!credential)return null;
      const res = await handleAuthRequest(baseUrl,request(endpoint("/api/account/session?disableCookieCache=true&disableRefresh=true"),credential),"get-session",log);
      if(res.status===401||res.status===403)return null;
      if(!res.ok)throw new Error("Account provider unavailable");
      const {session,user} = parseSessionData(await res.json(),log);
      const expiresAt = session?.expiresAt.getTime();
      if(!session?.id||!user?.id||session.userId!==user.id||!expiresAt||expiresAt<=Date.now())return null;
      let avatar:string|undefined;
      try {
        const image = new URL(user.image??"");
        if(image.protocol==="https:"&&!image.username&&!image.password&&image.href.length<=500)avatar=image.href;
      } catch { /* An avatar is optional. */ }
      return {userId:user.id,sessionId:session.id,expiresAt,account:{name:user.name?.trim().slice(0,80)||"Planetfall Pilot",avatar}};
    },
    async start(cookie,selectAccount) {
      const res = await proxy("sign-in/social",request(endpoint("/api/account/start"),cookie,{
        provider:"google",callbackURL:endpoint("/api/account/complete").href,errorCallbackURL:endpoint("/?account=failed").href,
      }));
      if(!res.ok)return new Response(null,{status:502});
      const data = await res.json() as {url?:string};
      let destination:URL;
      try {destination=new URL(data.url??"");}
      catch {return new Response(null,{status:502});}
      const directGoogle=destination.origin==="https://accounts.google.com";
      const managedGoogle=destination.origin===managedGoogleStart.origin&&
        destination.pathname===managedGoogleStart.pathname&&Boolean(destination.searchParams.get("token"));
      if(destination.protocol!=="https:"||(!directGoogle&&!managedGoogle)||destination.username||destination.password)
        return new Response(null,{status:502});
      // Neon sets its OAuth state cookie on the managed hop. Preserve that
      // signed URL so the browser can complete the provider exchange.
      if(selectAccount&&directGoogle)destination.searchParams.set("prompt","select_account");
      const headers = new Headers({"content-type":"application/json"});
      setFirstPartyCookies(headers,res.headers.getSetCookie());
      return new Response(JSON.stringify({url:destination.href}),{headers});
    },
    async complete(url,cookie) {
      const result = await processAuthMiddleware({...config,request:request(url,cookie),pathname:url.pathname,skipRoutes:[url.pathname],loginUrl:"/?account=failed"});
      const headers = new Headers();
      const success = result.action==="redirect_oauth"&&result.cookies.some(header=>parseSetCookies(header).some(c=>c.name===NEON_AUTH_SESSION_COOKIE_NAME&&Boolean(c.value)));
      headers.set("location",success?"/?account=return":"/?account=failed");
      if(success)setFirstPartyCookies(headers,result.cookies??[]);
      return new Response(null,{status:303,headers});
    },
    async signOut(credential) {
      if(credential) {
        const res = await proxy("sign-out",request(endpoint("/api/account/sign-out"),credential,{}));
        if(!res.ok&&res.status!==401&&res.status!==403)return new Response(null,{status:502});
      }
      const headers = new Headers();
      for(const name of [NEON_AUTH_SESSION_COOKIE_NAME,"__Secure-neon-auth.local.session_data","__Secure-neon-auth.session_challenge","__Secure-neon-auth.session_challange"])
        headers.append("set-cookie",`${name}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`);
      return new Response(null,{status:204,headers});
    },
  };
}
