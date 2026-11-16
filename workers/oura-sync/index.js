const DATA_TYPES=["daily_readiness","daily_sleep","sleep","daily_activity","daily_cardiovascular_age","daily_resilience","daily_spo2","daily_stress","enhanced_tag","heartrate","personal_info","rest_mode_period","ring_battery_level","ring_configuration","session","sleep_time","tag","vO2_max","workout"];
const CORE_TYPES=new Set(["daily_readiness","daily_sleep","sleep","daily_activity"]);
const json=(data,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
const schedule="08:30 Asia/Shanghai";
async function syncAll(env,scheduledTime){
 if(!env.SITE_ORIGIN||!env.OWNER_LOGIN_SECRET)throw Error("Missing SITE_ORIGIN or OWNER_LOGIN_SECRET");
 const origin=env.SITE_ORIGIN.replace(/\/$/,""),start=new Date(scheduledTime-7*86400000).toISOString().slice(0,10),runId=crypto.randomUUID(),errors=[],types=[];
 let saved=0,pages=0,requests=0;
 async function requestSync(body){if(++requests>48)throw Error("Oura request budget exceeded; remaining data will be retried next run");
  const response=await fetch(origin+"/api/integrations/oura/sync",{method:"POST",headers:{"Content-Type":"application/json","X-Owner-Secret":env.OWNER_LOGIN_SECRET},body:JSON.stringify({...body,start})});
  const data=await response.json().catch(()=>({error:"Sync endpoint returned invalid JSON"}));
  if(!response.ok)throw Error(data.error||"Sync endpoint returned HTTP "+response.status);
  return data;
 }
 await requestSync({command:"run-start",runId,scheduledFor:new Date(scheduledTime).toISOString()});
 console.log(JSON.stringify({event:"oura_sync_started",runId,scheduledFor:new Date(scheduledTime).toISOString()}));
 try{for(const type of DATA_TYPES){let nextToken=null,typeSaved=0;const seen=new Set(),typeErrors=[];
   try{do{if(requests>=46)throw Error("Oura request budget reached");const data=await requestSync({type,nextToken});pages++;const n=data.items?.length||0;saved+=n;typeSaved+=n;typeErrors.push(...(data.errors||[]));nextToken=data.continuations?.[type]||null;if(nextToken&&seen.has(nextToken))throw Error(type+" pagination cursor repeated");if(nextToken)seen.add(nextToken);}while(nextToken)}catch(e){typeErrors.push(type+": "+e.message)}
   types.push({type,saved:typeSaved,success:typeErrors.length===0});errors.push(...typeErrors);
  }
 }finally{
  const result={runId,start,saved,pages,errors,types};
  await requestSync({command:"run-finish",runId,result});
  console.log(JSON.stringify({event:errors.length?"oura_sync_partial":"oura_sync_finished",...result}));
 }
 if(types.some(x=>CORE_TYPES.has(x.type)&&!x.success))throw Error("Oura core data sync failed: "+errors.join("; "));
 return {runId,start,saved,pages,errors,types};
}
async function weeklyReport(env,time){
 const local=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date(time)),date=new Date(local+'T00:00:00Z');if(date.getUTCDay()!==1)return;
 if(!env.SITE_ORIGIN||!env.OWNER_LOGIN_SECRET)throw Error('Missing SITE_ORIGIN or OWNER_LOGIN_SECRET');
 const week=new Date(+date-7*86400000).toISOString().slice(0,10),response=await fetch(env.SITE_ORIGIN.replace(/\/$/,'')+'/api/integrations/oura/sync',{method:'POST',headers:{'Content-Type':'application/json','X-Owner-Secret':env.OWNER_LOGIN_SECRET},body:JSON.stringify({command:'weekly-review',week,scheduledFor:new Date(time).toISOString()})});
 const out=await response.json();if(!response.ok||out.verified!==true)throw Error(out.error||'Weekly report was not verified');console.log(JSON.stringify({event:'weekly_review_saved',week}));
}
export default {
 async fetch(request,env){return json({service:"luweicao-oura-sync",schedule,weeklySchedule:'Monday 08:30 Asia/Shanghai',configured:!!(env?.SITE_ORIGIN&&env?.OWNER_LOGIN_SECRET),version:"per-type-sync-and-weekly-v3"})},
 async scheduled(controller,env){const results=[];for(const task of [syncAll,weeklyReport]){try{results.push({status:'fulfilled',value:await task(env,controller.scheduledTime)})}catch(reason){results.push({status:'rejected',reason})}}let failure;results.forEach((result,index)=>{if(result.status==='rejected'){console.error(JSON.stringify({event:index?'weekly_review_failed':'oura_sync_failed',error:result.reason.message}));failure??=result.reason}});if(failure)throw failure}
};
