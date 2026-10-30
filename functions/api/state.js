export async function onRequest({request,env}){
 const reply=(data,status=200)=>Response.json(data,{status});
 if(!env.PRIVATE_STORE)return reply({error:'私人云存储尚未绑定'},503);
 const key='owner/state.json';
 if(request.method==='GET'){const obj=await env.PRIVATE_STORE.get(key);if(!obj)return reply({state:null,etag:null});return reply({state:await obj.json(),etag:obj.etag})}
 if(request.method!=='PUT')return reply({error:'请求方法不支持'},405);
 try{const text=await request.text();if(new TextEncoder().encode(text).length>20*1024*1024)return reply({error:'单次备份超过 20MB，请先导出并整理照片'},413);
 const {state,etag}=JSON.parse(text);if(!state||typeof state.days!=='object'||!Array.isArray(state.mem)||typeof state.weeks!=='object')return reply({error:'数据格式不正确'},400);
 const existing=await env.PRIVATE_STORE.head(key);if((existing?.etag||null)!==(etag||null))return reply({error:'另一设备已有更新，请先读取云端并核对，未覆盖任何数据。'},409);
 const body=JSON.stringify(state);
 if(existing){const previous=await env.PRIVATE_STORE.get(key,{onlyIf:{etagMatches:existing.etag}});if(!previous?.body)return reply({error:'云端已有更新，请重试'},409);await env.PRIVATE_STORE.put('backups/'+Date.now()+'-'+crypto.randomUUID()+'.json',previous.body)}
 const obj=await env.PRIVATE_STORE.put(key,body,{onlyIf:existing?{etagMatches:existing.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});if(!obj)return reply({error:'写入冲突，未覆盖云端记录'},409);
 const check=await env.PRIVATE_STORE.get(key);if(check?.etag!==obj.etag)return reply({error:'保存后云端已有新版本，请重新读取'},409);return reply({etag:obj.etag,verified:true});
 }catch{return reply({error:'云端保存失败，本地记录仍保留'},500)}
}
