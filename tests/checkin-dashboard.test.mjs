import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import {people,groups,summarize,validateData} from '../static/system/checkin-model.js';

const views=await readFile(new URL('../static/system/views.js',import.meta.url),'utf8');
const checkins=await readFile(new URL('../static/system/checkins.js',import.meta.url),'utf8');
// Compile the full module, including functions that string-matching tests never execute.
const compilation=spawnSync(process.execPath,['--experimental-vm-modules','--input-type=module','-e',"import vm from 'node:vm';import fs from 'node:fs';new vm.SourceTextModule(fs.readFileSync(process.argv[1],'utf8'));",new URL('../static/system/checkins.js',import.meta.url).pathname],{encoding:'utf8'});
assert.equal(compilation.status,0,compilation.stderr);
const records=[
 {day:'2026-11-10',person:0,data:{阅读:{done:true,parts:[{name:'测试书',minutes:20,quantity:null}]},运动:{done:true,parts:[{name:'跳绳',minutes:10,quantity:1000}]},平板支撑:{done:true,parts:[{name:'平板支撑',minutes:0.5,quantity:null}]},铁剂:{done:true,parts:[]}}},
 {day:'2026-11-10',person:1,data:{中文阅读:{done:true,parts:[{name:'孩子的书',minutes:15,quantity:null}]}}}
];
const scope={groups,people,summarize,customItems:[{person:0,item:'拉伸',group:'其他'},{person:1,item:'孩子自定义',group:'打卡'}],rows:()=>records,esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;')};
vm.createContext(scope);
vm.runInContext(checkins.slice(checkins.indexOf('function personGroups('),checkins.indexOf('async function loadProjects('))+checkins.slice(checkins.indexOf('function projectColumns('),checkins.indexOf('function paintHome(')),scope);
const columns=scope.projectColumns();assert(columns.every(c=>c.person===0));assert(columns.some(c=>c.item==='拉伸'));assert(!columns.some(c=>c.item==='孩子自定义'));
const table=scope.homeTable('2026-11');
for(const label of ['日期','星期','2026-11-30','周二','测试书','跳绳','1000','20 分钟','0.5 分钟','铁剂','孩子英语','拉伸'])assert(table.includes(label),label);
for(const label of ['孩子的书','孩子自定义','<th>赚钱</th>','<th>照片</th>'])assert(!table.includes(label),label);
assert.equal(groups[0].at(-1).title,'其他');assert.deepEqual(groups[0].at(-1).items,[['孩子英语']]);
for(const p of [1,2]){assert.equal(groups[p].length,1);assert.equal(groups[p][0].title,'打卡');assert(!groups[p][0].items.some(([x])=>x==='孩子英语'));}
assert.doesNotThrow(()=>validateData(0,{其他:{done:true,parts:[]}}));
assert.doesNotThrow(()=>validateData(1,{孩子英语:{done:true,parts:[{name:'历史听力',minutes:10,quantity:null}]}}));
const dashboard=views.slice(views.indexOf('function dashboardView(){'),views.indexOf('function recordDataTable('));
assert(dashboard.includes('id="checkin-dashboard"'));
assert(dashboard.includes('stat-grid'));assert(dashboard.includes('view-tabs'));
for(const old of ['五个领域 · 本月关联记录','四个最低动作','月度回顾','月度记录明细','<th>赚钱</th>'])assert(!dashboard.includes(old),old);
console.log('首页打卡：完整模块可编译，成人项目按月展示内容及合计，保留日期星期、顶部卡片和切换入口，儿童原项目不变：通过');
