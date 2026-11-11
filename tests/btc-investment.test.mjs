import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import {onRequest} from '../functions/api/investments/btc.js';

const sql=new DatabaseSync(':memory:');
function statement(query){let args=[];return{bind(...values){args=values;return this},async run(){return{meta:{changes:Number(sql.prepare(query).run(...args).changes)}}},async first(){return sql.prepare(query).get(...args)||null},async all(){return{results:sql.prepare(query).all(...args)}}}}
const env={PRIVATE_DB:{prepare:statement,async batch(items){return Promise.all(items.map(item=>item.run()))}}};
const call=async(method,body)=>{const request=new Request('https://example.test/api/investments/btc',{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const response=await onRequest({env,request});return{status:response.status,...await response.json()}};

assert.deepEqual(await call('GET'),{status:200,plan:null,version:null});
const plan={entries:[{id:'record-48',date:'2026-11-11',btcPrice:73877,jinjinMultiple:2,executionPrice:73825,amount:400,executed:true,note:'每日定投'}]};
const saved=await call('PUT',{plan,expectedVersion:null});assert.equal(saved.status,200);assert.equal(saved.verified,true);
const read=await call('GET');assert.deepEqual(read.plan,plan);assert.equal(read.version,saved.version);
assert.equal((await call('PUT',{plan:{entries:[{...plan.entries[0],executed:'yes'}]},expectedVersion:saved.version})).status,400);
const changed={entries:[{...plan.entries[0],executed:false}]};assert.equal((await call('PUT',{plan:changed,expectedVersion:null})).status,409);
assert.equal((await call('PUT',{plan:changed,expectedVersion:saved.version})).verified,true);

const source=await readFile(new URL('../static/system/btc.js',import.meta.url),'utf8');
const context=vm.createContext({page:'五个领域',activeDomain:0,render(){},document:{getElementById(){return null},querySelectorAll(){return[]}},fetch:async()=>{throw Error('not used')},esc:String,crypto:{randomUUID:()=> 'test-id'}});
vm.runInContext(source,context);
assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext('btcTier(73877)',context))),{n:2,label:'72,500–75,000'});
assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext('btcTier(80000)',context))),{n:0,label:'80,000 以上'});
assert.equal(vm.runInContext('btcShares({btcPrice:73877,jinjinMultiple:2})',context),4);
assert.equal(vm.runInContext('btcShares({btcPrice:79999,jinjinMultiple:2})',context),3);
console.log('BTC 投资记录：私人数据库保存/读取、版本冲突保护、输入校验、价格区间和应投份数公式：通过');
