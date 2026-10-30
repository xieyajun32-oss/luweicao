import {configured,configurationIssue,validSession,reply} from '../../lib/owner-auth.js';
export async function onRequest(ctx){
 const {request,env}=ctx;const url=new URL(request.url);
 if(!['GET','HEAD'].includes(request.method)&&request.headers.get('Origin')!==url.origin)return reply({error:'不允许跨站请求'},403);
 if(url.pathname==='/api/session'){const response=await ctx.next();const out=new Response(response.body,response);out.headers.set('Cache-Control','no-store');return out}
 if(!configured(env))return reply({error:configurationIssue(env)},503);
 if(!await validSession(request,env))return reply({error:'请先输入私人密码登录',loginRequired:true},401);
 ctx.data.owner='owner';const response=await ctx.next();const out=new Response(response.body,response);out.headers.set('Cache-Control','no-store');return out;
}
