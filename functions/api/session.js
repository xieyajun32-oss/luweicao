import {configured,configurationIssue,validSession,passwordMatches,issueSession,sessionCookie,reply} from '../../lib/owner-auth.js';
// Best-effort per-isolate throttling, not a distributed rate limit. Use a unique, hard-to-guess password; the minimum is 8 Unicode characters.
const attempts=new Map();
export async function onRequest({request,env}){
 if(request.method==='GET')return reply({uiVersion:'diary-content-actions-v1',storageConfigured:!!env.PRIVATE_STORE,aiConfigured:!!env.AI,configured:configured(env),configurationIssue:configurationIssue(env),authenticated:await validSession(request,env)});
 if(request.method==='DELETE')return reply({authenticated:false},200,{'Set-Cookie':sessionCookie('',0)});
 if(request.method!=='POST')return reply({error:'请求方法不支持'},405);
 if(!configured(env))return reply({error:configurationIssue(env)},503);
 const ip=request.headers.get('CF-Connecting-IP')||'unknown',now=Date.now();let entry=attempts.get(ip);if(!entry||entry.until<now){entry={count:0,until:now+15*60*1000};attempts.set(ip,entry)}
 if(entry.count>=8)return reply({error:'尝试次数过多，请 15 分钟后重试。'},429,{'Retry-After':'900'});
 entry.count++;if(attempts.size>10000){for(const [k,v]of attempts)if(v.until<now)attempts.delete(k);if(attempts.size>10000)attempts.delete(attempts.keys().next().value)}
 try{const body=await request.text();if(body.length>2048)return reply({error:'密码不正确'},401);const {password}=JSON.parse(body);if(!await passwordMatches(password,env))return reply({error:'密码不正确'},401);attempts.delete(ip);const token=await issueSession(env,new URL(request.url).host);return reply({authenticated:true},200,{'Set-Cookie':sessionCookie(token)})}catch{return reply({error:'无法完成登录，请重试'},400)}
}
