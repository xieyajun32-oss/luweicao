import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
const views=await readFile(new URL('../static/system/views.js',import.meta.url),'utf8'),checkins=await readFile(new URL('../static/system/checkins.js',import.meta.url),'utf8'),model=await readFile(new URL('../static/system/checkin-model.js',import.meta.url),'utf8');
const dashboard=views.slice(views.indexOf('function dashboardView(){'),views.indexOf('function recordDataTable('));
assert(dashboard.includes('id="checkin-dashboard"'));for(const old of ['五个领域 · 本月关联记录','四个最低动作','月度回顾','月度记录明细','<th>赚钱</th>'])assert(!dashboard.includes(old),old);
assert(checkins.includes('function homeTable()'));assert(checkins.includes('<th rowspan="2">日期</th><th rowspan="2">星期</th>'));assert(checkins.includes('function projectSummary('));assert(checkins.includes('data-add-project='));
assert(model.includes("{title:'其他',items:[['其他']]}"));assert(model.includes("{title:'孩子英语',items:[['孩子英语','listen']]}"));
console.log('首页只保留打卡项目统计，保留日期/星期并汇总各项目内容；其他、孩子英语和手动添加入口：通过');