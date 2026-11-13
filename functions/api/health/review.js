import {reply} from '../../../lib/owner-auth.js';
import {readHealthReview,listHealthReviewHistory,generateHealthReview,shanghaiDate} from '../../../lib/health-review.js';
import '../../../static/system/health-model.js';
const valid=date=>globalThis.ReedHealth.validDate(date)&&date<=shanghaiDate();
export async function onRequestGet({request,env}){try{const params=new URL(request.url).searchParams;if(params.get('history')==='1'){const before=params.get('before')||shanghaiDate();if(!valid(before))return reply({error:'请核对历史总结日期'},400);return reply(await listHealthReviewHistory(env,before))}const date=params.get('date')||shanghaiDate();if(!valid(date))return reply({error:'请核对复盘日期'},400);return reply({review:await readHealthReview(env,date,{includeLegacy:true}),date})}catch(e){return reply({error:e.message||'每日总结读取失败'},503)}}
export async function onRequestPost({request,env}){try{const body=await request.json(),date=body.date||shanghaiDate();if(!valid(date))return reply({error:'请核对复盘日期'},400);return reply(await generateHealthReview(env,date))}catch(e){return reply({error:e.message||'每日总结暂时未完成'},503)}}
