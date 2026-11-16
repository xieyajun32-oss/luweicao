import {reply} from '../../lib/owner-auth.js';
import {previousWeek} from '../../lib/weekly-store.js';
import {readWeeklyReview,listWeeklyReviews,generateWeeklyReview,readWeeklyRun} from '../../lib/weekly-review.js';
export async function onRequestGet({request,env}){try{const params=new URL(request.url).searchParams;if(params.get('history')==='1')return reply(await listWeeklyReviews(env,params.get('before')||undefined));const start=params.get('week')||previousWeek();return reply({report:await readWeeklyReview(env,start),run:await readWeeklyRun(env,start),week:start})}catch(error){return reply({error:error.message||'周报读取失败'},400)}}
export async function onRequestPost({request,env}){try{const body=await request.json();const report=await generateWeeklyReview(env,body.week||previousWeek());return reply({report,verified:report.verified===true||report.cached===true})}catch(error){return reply({error:error.message||'周报生成未完成，原资料保留'},503)}}
