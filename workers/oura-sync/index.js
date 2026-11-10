const DATA_TYPES=["daily_activity","daily_cardiovascular_age","daily_readiness","daily_resilience","daily_sleep","daily_spo2","daily_stress","enhanced_tag","heartrate","personal_info","rest_mode_period","ring_battery_level","ring_configuration","session","sleep","sleep_time","tag","vO2_max","workout"];
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});

async function syncAll(env,scheduledTime){
 if(!env.SITE_ORIGIN||!env.OWNER_LOGIN_SECRET)throw Error("Missing SITE_ORIGIN or OWNER_LOGIN_SECRET");
 const origin=env.SITE_ORIGIN.replace(/\/$/,"");
 const start=new Date(scheduledTime-7*86400000).toISOString().slice(0,10);
 const seen=new Map(DATA_TYPES.map(type=>[type,new Set()]));
 let saved=0,pages=0;const errors=[];
 async function requestSync(body){
  const response=await fetch(origin+"/api/integrations/oura/sync",{method:"POST",headers:{"Content-Type":"application/json","X-Owner-Secret":env.OWNER_LOGIN_SECRET},body:JSON.stringify({...body,start})});
  const data=await response.json().catch(()=>({error:"Sync endpoint returned invalid JSON"}));
  if(!response.ok)throw Error(data.error||"Sync endpoint returned HTTP "+response.status);
  saved+=data.items?.length||0;errors.push(...(data.errors||[]));pages++;
  if(pages>400)throw Error("Oura pagination exceeded the safety limit");
  return data;
 }
 const first=await requestSync({});
 for(const type of DATA_TYPES){
  let token=first.continuations?.[type]||null;
  while(token){
   if(seen.get(type).has(token))throw Error(type+" pagination cursor repeated");
   seen.get(type).add(token);
   const next=await requestSync({type,nextToken:token});
   token=next.continuations?.[type]||null;
  }
 }
 const result={start,saved,pages,errors};
 console.log(JSON.stringify({event:"oura_sync_finished",...result}));
 return result;
}

export default {
 async fetch(){return json({service:"luweicao-oura-sync",schedule:"08:30 Asia/Shanghai"})},
 async scheduled(controller,env){
  const result=await syncAll(env,controller.scheduledTime);
  if(result.errors.length)console.warn(JSON.stringify({event:"oura_sync_partial",errors:result.errors}));
 }
};
