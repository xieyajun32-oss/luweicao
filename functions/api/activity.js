import {reply} from '../../lib/owner-auth.js';
import {saveActivity} from '../../lib/weekly-store.js';
export async function onRequestPost({request,env}){try{const text=await request.text();if(text.length>30000)return reply({error:'操作记录过多'},413);const {events}=JSON.parse(text);return reply(await saveActivity(env,events))}catch(error){return reply({error:error.message||'操作记录未保存'},400)}}
