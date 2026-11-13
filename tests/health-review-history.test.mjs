import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readyDB,saveConnection} from '../lib/private-db.js';
import {listHealthReviewHistory,readHealthReview,generateHealthReview,shanghaiDate} from '../lib/health-review.js';
import {onRequestGet} from '../functions/api/health/review.js';
const sql=new DatabaseSync(':memory:');function prepare(query){let args=[];return {bind(...values){args=values;return this},async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}}},async all(){return {results:sql.prepare(query).all(...args)}},async first(){return sql.prepare(query).get(...args)||null}}}
const env={PRIVATE_DB:{prepare,async batch(q){return Promise.all(q.map(x=>x.run()))}}},today=shanghaiDate(),day=n=>new Date(Date.parse(today+'T00:00:00Z')-n*86400000).toISOString().slice(0,10);await readyDB(env);
for(let i=1;i<=75;i++)await saveConnection(env,'health-review:'+day(i),JSON.stringify(i===2?{date:day(i),summary:'旧格式原总结',suggestions:[{text:'旧版保存建议'}],generatedAt:'旧版保存时间'}:{schemaVersion:'recovery-insights-v1',date:day(i),summary:'当时保存的总结 '+i,insights:[],generatedAt:day(i)+'T00:31:00Z'}));
await saveConnection(env,'health-review:'+today,JSON.stringify({schemaVersion:'recovery-insights-v1',date:today,summary:'今日总结',insights:[]}));
await saveConnection(env,'health-review-lock:'+today,'fixture-lock');await saveConnection(env,'oura-sync-run',JSON.stringify({status:'success'}));await saveConnection(env,'health-review:invalid',JSON.stringify({summary:'非日期键'}));await saveConnection(env,'health-review:'+day(76),'not-json');
await prepare("UPDATE reed_connections SET updated='2000-01-01T00:00:00Z' WHERE id=?").bind('health-review-lock:'+today).run();
const before=sql.prepare('SELECT * FROM reed_connections ORDER BY id').all();
let cursor=today,dates=[];do{const page=await listHealthReviewHistory(env,cursor);assert(page.dates.length<=30);assert(page.dates.every(d=>d<cursor));dates.push(...page.dates);cursor=page.next}while(cursor);
assert.equal(dates.length,75);assert.equal(new Set(dates).size,75);assert.equal(dates[0],day(1));assert.equal(dates.at(-1),day(75));assert(!dates.includes(today),'today stays outside the collapsed archive');
const call=query=>onRequestGet({env,request:new Request('https://example.test/api/health/review'+query)});
let response=await call('?history=1');let data=await response.json();assert.equal(data.dates.length,30);assert.equal(data.next,day(30));
response=await call('?date='+day(2));data=await response.json();assert.equal(data.review.summary,'旧格式原总结');assert.equal(data.review.suggestions[0].text,'旧版保存建议');assert.equal(await readHealthReview(env,day(2)),null,'generation still uses current schema cache');
assert.equal((await call('?history=1&before=invalid')).status,400);assert.equal((await call('?history=1&before=2999-01-01')).status,400);assert.equal((await(await call('?date='+day(100))).json()).review,null);
assert.deepEqual(sql.prepare('SELECT * FROM reed_connections ORDER BY id').all(),before,'reading history cannot regenerate, overwrite or delete it');
await generateHealthReview(env,today);for(let i=1;i<=75;i++){const original=before.find(x=>x.id==='health-review:'+day(i));assert.deepEqual(sql.prepare('SELECT * FROM reed_connections WHERE id=?').get(original.id),original,'today generation keeps every past summary unchanged')}
sql.close();console.log('历史健康总结：75天分页、日期倒序、今日排除、旧格式读取、非法日期、无读取写入、今日更新不覆盖历史：通过');
