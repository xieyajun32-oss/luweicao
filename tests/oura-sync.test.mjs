import assert from 'node:assert/strict';
import {default as worker} from '../workers/oura-sync/index.js';

const scheduledTime=Date.parse('2026-11-10T00:30:00.000Z');
const previousFetch=globalThis.fetch;
const requests=[];
globalThis.fetch=async(url,init)=>{
 requests.push({url:String(url),init});
 const body=JSON.parse(init.body);
 if(requests.length===1)return Response.json({items:[{id:'oura:daily_activity:2026-11-09'}],errors:[],continuations:{daily_activity:'cursor-1'}});
 assert.deepEqual(body,{start:'2026-11-03',type:'daily_activity',nextToken:'cursor-1'});
 return Response.json({items:[{id:'oura:daily_activity:2026-11-08'}],errors:[],continuations:{}});
};
try{
 const result=await worker.scheduled({scheduledTime},{SITE_ORIGIN:'https://luweicao.pages.dev',OWNER_LOGIN_SECRET:'test-secret'});
 assert.equal(result,undefined);
 assert.equal(requests.length,2);
 assert.equal(requests[0].url,'https://luweicao.pages.dev/api/integrations/oura/sync');
 assert.equal(requests[0].init.headers['X-Owner-Secret'],'test-secret');
 assert.equal(JSON.parse(requests[0].init.body).start,'2026-11-03');
 assert.equal(requests[1].init.headers['X-Owner-Secret'],'test-secret');
 const status=await worker.fetch();
 assert.deepEqual(await status.json(),{service:'luweicao-oura-sync',schedule:'08:30 Asia/Shanghai'});
 await assert.rejects(worker.scheduled({scheduledTime},{SITE_ORIGIN:'https://luweicao.pages.dev'}),/Missing SITE_ORIGIN or OWNER_LOGIN_SECRET/);
 console.log('Oura Cron Worker：每日触发、7 日回补、分页续读、密钥传递、配置缺失保护：通过');
}finally{globalThis.fetch=previousFetch}
