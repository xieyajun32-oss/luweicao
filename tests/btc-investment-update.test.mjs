import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import {onRequest} from '../functions/api/investments/btc.js';
const sql=new DatabaseSync(':memory:');
function statement(query){let args=[];return{bind(...a){args=a;return this},async run(){return{meta:{changes:Number(sql.prepare(query).run(...args).changes)}}},async first(){return sql.prepare(query).get(...args)||null},async all(){return{results:sql.prepare(query).all(...args)}}}}
const env={PRIVATE_DB:{prepare:statement,async batch(items){return Promise.all(items.map(x=>x.run()))}}};
async function call(method,body){const request=new Request('https://example.test/api/investments/btc',{method,...(body?{body:JSON.stringify(body)}:{})});const r=await onRequest({env,request});return{status:r.status,...await r.json()}}
const entry={id:'existing-one',date:'2026-11-11',btcPrice:73877,jinjinMultiple:2,executionPrice:73825,amount:400,executed:true,note:'既有交易原件',extraOriginalField:'must remain'};
const oldPlan={entries:[entry],otherOriginalData:{retained:true}};
let r=await call('PUT',{plan:oldPlan,expectedVersion:null});assert.equal(r.verified,true);let version=r.version;assert.deepEqual((await call('GET')).plan,oldPlan);
const plan={...oldPlan,entries:[{...entry,ma200Shares:4}],specialEntries:[{id:'special-one',date:'2026-11-14',btcPrice:65000,condition:'测试条件',strategy:'测试策略',executionPrice:65000,amount:200,executed:true,note:'测试专用'}]};
r=await call('PUT',{plan,expectedVersion:version});assert.equal(r.verified,true);version=r.version;assert.deepEqual((await call('GET')).plan,plan);
assert.equal((await call('PUT',{plan,expectedVersion:null})).status,409);
for(const invalid of [{...plan,specialEntries:{}},{...plan,entries:[{...entry,ma200Shares:-1}]},{...plan,specialEntries:[{...plan.specialEntries[0],condition:12}]},{...plan,specialEntries:[{...plan.specialEntries[0],executed:'true'}]}])assert.equal((await call('PUT',{plan:invalid,expectedVersion:version})).status,400);
assert.deepEqual((await call('GET')).plan,plan,'failed saves preserve all previous records');
console.log('BTC 接口：旧记录兼容、MA200与特殊情况保存回读、原字段保留、输入校验、冲突不覆盖：通过');
const source=await fs.readFile(new URL('../static/system/btc.js',import.meta.url),'utf8');
let release;const bodies=[];
const ctx=vm.createContext({window:{addEventListener(){}},render(){},document:{getElementById(){return null},querySelectorAll(){return[]}},esc:String,fetch:async(url,init)=>{const body=JSON.parse(init.body);bodies.push(body);if(bodies.length===1)await new Promise(r=>release=r);return{ok:true,json:async()=>({version:'v'+bodies.length,verified:true})}}});
vm.runInContext(source,ctx);vm.runInContext(`btcLoaded=true;btcVersion='v0';btcPlan=${JSON.stringify(oldPlan)}`,ctx);
const saving=vm.runInContext('btcSave()',ctx);vm.runInContext("btcPlan.entries[0].note='后一次编辑';btcPlan.entries[0].ma200Shares=3;btcSave()",ctx);release();await saving;
assert.equal(bodies.length,2);assert.equal(bodies[0].plan.entries[0].note,'既有交易原件');assert.equal(bodies[1].plan.entries[0].note,'后一次编辑');assert.equal(bodies[1].expectedVersion,'v1');assert.equal(bodies[1].plan.entries[0].ma200Shares,3);assert.deepEqual(bodies[1].plan.otherOriginalData,{retained:true});
assert.equal(vm.runInContext('btcTotalShares(btcPlan.entries[0])',ctx),7);
assert.equal(vm.runInContext('btcShares({btcPrice:81000,jinjinMultiple:2})',ctx),2,'user explicitly deferred >80k change');
const stats=JSON.parse(vm.runInContext('JSON.stringify(btcStatistics())',ctx));assert.equal(stats.days,1);assert.equal(stats.shares,7);assert.equal(stats.amount,400);assert.equal(stats.average,73825);assert.equal(stats.quantity,400/73825);vm.runInContext('btcPlan.entries[0].actualBtcQuantity=999',ctx);assert.equal(vm.runInContext('btcStatistics().average',ctx),73825,'estimate from price and amount; do not use deprecated manual quantity');
console.log('BTC 前端：延迟保存连续编辑自动续存、最新版本串行提交、旧字段保留、MA200合计与已执行统计：通过');
vm.runInContext("btcPlan.entries.push({...btcPlan.entries[0],id:'same-day-second',amount:200,executionPrice:50000});btcPlan.entries.push({...btcPlan.entries[0],id:'unexecuted',date:'2026-11-12',executed:false,amount:9999,actualBtcQuantity:1})",ctx);
const sameDay=JSON.parse(vm.runInContext('JSON.stringify(btcStatistics())',ctx));assert.equal(sameDay.days,1);assert.equal(sameDay.shares,14);assert.equal(sameDay.amount,600);assert(Math.abs(sameDay.average-600/(400/73825+200/50000))<1e-8);
console.log('统计口径：同日两笔只计一天、未执行不计入、份数与金额累加、均价使用成交额和成交价自动估算的BTC数量：通过');

vm.runInContext("btcPlan.entries[1].executionPrice=null",ctx);assert.equal(vm.runInContext('btcStatistics().average',ctx),null,'incomplete executed record must not produce partial average');vm.runInContext("btcPlan.entries[1].executionPrice=0",ctx);assert.equal(vm.runInContext('btcStatistics().average',ctx),null,'zero price never divides');
