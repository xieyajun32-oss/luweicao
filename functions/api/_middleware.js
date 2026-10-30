const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'=')),c=>c.charCodeAt(0));
export async function onRequest(ctx){
 const {request,env}=ctx;
 if(!env.ACCESS_TEAM_DOMAIN||!env.ACCESS_AUD||!env.OWNER_EMAIL)return json({error:'私人服务尚未配置登录保护，请完成 Cloudflare Access 配置。'},503);
 if(!['GET','HEAD'].includes(request.method)&&request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'不允许跨站请求'},403);
 try{
 const token=request.headers.get('Cf-Access-Jwt-Assertion');if(!token)return json({error:'请先登录私人空间'},401);
 const [h,p,s,...extra]=token.split('.');if(extra.length||!s)throw Error();
 const header=JSON.parse(new TextDecoder().decode(bytes(h))),payload=JSON.parse(new TextDecoder().decode(bytes(p)));
 const issuer='https://'+env.ACCESS_TEAM_DOMAIN.replace(/^https:\/\//,'').replace(/\/$/,'');
 if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer))throw Error();
 if(header.alg!=='RS256'||payload.iss!==issuer||!Array.isArray(payload.aud)||!payload.aud.includes(env.ACCESS_AUD)||!payload.exp||payload.exp<=Date.now()/1000||payload.nbf>Date.now()/1000||payload.email?.toLowerCase()!==env.OWNER_EMAIL.toLowerCase())throw Error();
 const res=await fetch(issuer+'/cdn-cgi/access/certs');if(!res.ok)throw Error();const {keys}=await res.json(),jwk=keys.find(k=>k.kid===header.kid);if(!jwk)throw Error();
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,bytes(s),new TextEncoder().encode(h+'.'+p)))throw Error();
 ctx.data.owner=payload.email;const response=await ctx.next();const out=new Response(response.body,response);out.headers.set('Cache-Control','no-store');return out;
 }catch{return json({error:'登录验证失败，请重新登录'},401)}
}
