import {reply} from '../../../lib/owner-auth.js';
import {readHealthReview,generateHealthReview,shanghaiDate} from '../../../lib/health-review.js';
import '../../../static/system/health-model.js';
const valid=date=>globalThis.ReedHealth.validDate(date)&&date<=shanghaiDate();
export async function onRequestGet({request,env}){try{const date=new URL(request.url).searchParams.get('date')||shanghaiDate();if(!valid(date))return reply({error:'请核对复盘日期'},400);return reply({review:await readHealthReview(env,date),date})}catch(e){return reply({error:e.message||'每日总结读取失败'},503)}}
export async function onRequestPost({request,env}){try{const body=await request.json(),date=body.date||shanghaiDate();if(!valid(date))return reply({error:'请核对复盘日期'},400);return reply(await generateHealthReview(env,date))}catch(e){return reply({error:e.message||'每日总结暂时未完成'},503)}}
