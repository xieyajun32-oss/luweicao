import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {onRequest as alt} from '../functions/api/investments/altcoins.js';
import {onRequest as btc} from '../functions/api/investments/btc.js';
const sql=new DatabaseSync(':memory:');
function statement(query){let args=[];return{bind(...v){args=v;return this},async run(){return{meta:{changes:Number(sql.prepare(query).run(...args).changes)}}},async first(){return sql.prepare(query).get(...args)||null},async all(){return{results:sql.prepare(query).all(...args)}}}}
const env={PRIVATE_DB:{prepare:statement,async batch(items){return Promise.all(items.map(x=>x.run()))}}};
async function call(handler,method='GET',body){const request=new Request('https://example.test/api/investments/'+(handler===alt?'altcoins':'btc'),{method,...(body?{body:JSON.stringify(body)}:{})});const r=await handler({env,request});return{status:r.status,...await r.json()}}
const btcPlan={entries:[{id:'btc-original',date:'2026-11-01',btcPrice:70000,jinjinMultiple:2,amount:100,executionPrice:70000,executed:true,note:'original BTC record'}],specialEntries:[],other:{keep:true}};
assert.equal((await call(btc,'PUT',{plan:btcPlan,expectedVersion:null})).verified,true);const btcBefore=await call(btc);assert.deepEqual(await call(alt),{status:200,plan:null,version:null});
const first={id:'alt-test-a',date:'2026-11-16',symbol:'AAA',unitPrice:2.5,amount:125};const plan={entries:[first]};let r=await call(alt,'PUT',{plan,expectedVersion:null});assert.equal(r.verified,true);let version=r.version;assert.deepEqual((await call(alt)).plan,plan);assert.deepEqual(await call(btc),btcBefore,'alt writes never change BTC values or version');
const next={entries:[first,{...first,id:'alt-test-b',symbol:'BBB',unitPrice:0.002,amount:200}]};r=await call(alt,'PUT',{plan:next,expectedVersion:version});assert.equal(r.verified,true);assert.notEqual(r.version,version);version=r.version;assert.deepEqual((await call(alt)).plan,next);assert.equal((await call(alt,'PUT',{plan,expectedVersion:null})).status,409);assert.deepEqual((await call(alt)).plan,next);
for(const invalid of [{...first,unitPrice:0},{...first,amount:-1},{...first,symbol:'<script>'},{...first,date:'today'},{...first,amount:'125'}])assert.equal((await call(alt,'PUT',{plan:{entries:[invalid]},expectedVersion:version})).status,400);
assert.equal((await call(alt,'PUT',{plan:{entries:[first,first]},expectedVersion:version})).status,400);assert.deepEqual((await call(alt)).plan,next);assert.deepEqual(await call(btc),btcBefore);
console.log('山寨接口：独立数据键、BTC原件与版本完全保留、保存回读、追加保留、并发版本冲突和输入校验：通过');
