import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {onRequest} from '../functions/api/health/articles.js';
const sql=new DatabaseSync(':memory:');
function prepare(query){let args=[];return{bind(...values){args=values;return this},async run(){return{meta:{changes:Number(sql.prepare(query).run(...args).changes)}}},async first(){return sql.prepare(query).get(...args)||null}}}
const env={PRIVATE_DB:{prepare,async batch(statements){return Promise.all(statements.map(s=>s.run()))}}};
async function call(body){const response=await onRequest({env,request:new Request('https://example.test/api/health/articles',{method:body?'PUT':'GET',...(body?{body:JSON.stringify(body)}:{})})});return{status:response.status,...await response.json()}}
assert.deepEqual(await call(),{status:200,entries:[],version:null});
for(const id of ['btc-investment-plan','altcoin-investment-plan'])sql.prepare('INSERT INTO reed_connections VALUES(?,?,?)').run(id,'{"original":"preserved"}','original-version');
const untouched=sql.prepare('SELECT * FROM reed_connections ORDER BY id').all();
let version=null;
const save=async(id,title,content='Research body\nSecond paragraph',kind='资料')=>{const r=await call({action:'save',id,entry:{title,content,kind},expectedVersion:version});if(r.verified)version=r.version;return r};
let r=await save('report-a','Report A','');assert.equal(r.entries[0].content,'');assert.equal(r.verified,true);const created=r.entries[0].createdAt;
r=await save('report-b','Thought B','My thoughts','思考');assert.equal(r.entries.length,2);const b=r.entries[1];
r=await save('report-a','Report A revised','Updated full text');assert.equal(r.entries[0].createdAt,created);assert.equal(r.entries[0].content,'Updated full text');assert.deepEqual(r.entries[1],b);
assert.equal((await call({action:'save',id:'report-a',entry:{title:'stale',kind:'资料',content:'bad'},expectedVersion:null})).status,409);
for(const entry of [{title:'',kind:'资料',content:'x'},{title:'Title',kind:'Unknown',content:'x'},{title:'Title',kind:'资料',content:null}])assert.equal((await call({action:'save',id:'invalid',entry,expectedVersion:version})).status,400);
r=await call({action:'delete',id:'report-a',expectedVersion:version});assert.equal(r.verified,true);version=r.version;assert(r.entries[0].deletedAt);assert.equal(r.entries[0].content,'Updated full text');assert.deepEqual(r.entries[1],b);
assert.equal((await save('report-a','Cannot revive implicitly')).status,409);
r=await call({action:'restore',id:'report-a',expectedVersion:version});assert.equal(r.verified,true);version=r.version;assert.equal(r.entries[0].deletedAt,null);assert.equal(r.entries[0].content,'Updated full text');
assert.deepEqual((await call()).entries,r.entries);assert.deepEqual(sql.prepare('SELECT * FROM reed_connections WHERE id!=? ORDER BY id').all('personal-health-articles'),untouched);
console.log('健康专题文章接口：独立保存、修改保留创建时间及其他原件、并发保护、校验、可恢复删除、BTC/山寨数据与版本不变：通过');
const {onRequest:checks}=await import('../functions/api/health/check-topics.js');
async function classify(body){const response=await checks({env,request:new Request('https://example.test/api/health/check-topics',{method:body?'PUT':'GET',...(body?{body:JSON.stringify(body)}:{})})});return{status:response.status,...await response.json()}}
const before=sql.prepare('SELECT * FROM reed_connections ORDER BY id').all();assert.deepEqual(await classify(),{status:200,assignments:{},version:null});
let c=await classify({id:'anonymous-a',topic:'心血管',expectedVersion:null});assert.equal(c.verified,true);assert.equal(c.assignments['anonymous-a'],'心血管');
assert.equal((await classify({id:'anonymous-b',topic:'常规体检',expectedVersion:null})).status,409);const cv=c.version;c=await classify({id:'anonymous-b',topic:'常规体检',expectedVersion:cv});assert.equal(c.assignments['anonymous-a'],'心血管');assert.equal(c.assignments['anonymous-b'],'常规体检');assert.deepEqual((await classify()).assignments,c.assignments);
assert.equal((await classify({id:'bad id',topic:'心血管',expectedVersion:c.version})).status,400);assert.equal((await classify({id:'anonymous-a',topic:'其他',expectedVersion:c.version})).status,400);assert.deepEqual(sql.prepare('SELECT * FROM reed_connections WHERE id!=? ORDER BY id').all('health-check-topics'),before);console.log('检查专题接口：三固定分类、独立保存回读、并发保护、原件及其他数据不变：通过');
