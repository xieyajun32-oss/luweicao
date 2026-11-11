/* BTC plan and execution records. Market quote import remains isolated until Jinjin exposes a readable endpoint. */
let btcPlan={entries:[]},btcVersion=null,btcLoaded=false,btcLoading=false,btcLoadError='',btcSaveBusy=false;
function btcTier(price){
 const value=Number(price);if(!Number.isFinite(value)||value<=0)return null;
 if(value>=80000)return{n:0,label:'80,000 以上'};
 if(value>=75000)return{n:1,label:'75,000–80,000'};
 if(value>=72500)return{n:2,label:'72,500–75,000'};
 if(value>=70000)return{n:3,label:'70,000–72,500'};
 if(value>=67500)return{n:4,label:'67,500–70,000'};
 if(value>=65000)return{n:5,label:'65,000–67,500'};
 if(value>=62500)return{n:6,label:'62,500–65,000'};
 if(value>=60000)return{n:7,label:'60,000–62,500'};
 return{n:8,label:'60,000 以下'};
}
function btcNumber(value){if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)&&n>=0?n:null}
function btcShares(row){const tier=btcTier(row.btcPrice),multiple=btcNumber(row.jinjinMultiple);return tier&&multiple!==null?tier.n+multiple:null}
function btcInitialPlan(){return{entries:[
 {id:'record-48',date:'2026-11-11',btcPrice:73877,jinjinMultiple:2,executionPrice:73825,amount:400,executed:true,note:'每日定投'},
 {id:'record-49',date:'2026-11-12',btcPrice:null,jinjinMultiple:null,executionPrice:null,amount:null,executed:false,note:'每日定投'}
]}}
async function btcEnsureLoaded(){
 if(btcLoaded||btcLoading)return;btcLoading=true;btcLoadError='';
 try{const response=await fetch('/api/investments/btc',{cache:'no-store'}),data=await response.json();if(!response.ok)throw Error(data.error||'读取 BTC 记录失败');btcVersion=data.version;btcPlan=data.plan||btcInitialPlan();btcLoaded=true}
 catch(error){btcLoadError=error.message||'读取失败'}finally{btcLoading=false;if(page==='五个领域'&&activeDomain===1)render()}
}
function btcEsc(value){return esc(value)}
function btcEntryRow(row,index){const tier=btcTier(row.btcPrice),shares=btcShares(row),disabled=!btcLoaded||btcSaveBusy;return '<tr id="btc-row-'+btcEsc(row.id)+'"><td>'+(48+index)+'</td><td><input aria-label="日期" type="date" value="'+btcEsc(row.date)+'" onchange="btcSetField(\''+btcEsc(row.id)+'\',\'date\',this.value);btcSave()"></td><td><input aria-label="BTC 价格" type="number" min="0" step="0.01" value="'+(btcNumber(row.btcPrice)??'')+'" placeholder="待读取" oninput="btcSetField(\''+btcEsc(row.id)+'\',\'btcPrice\',this.value)" onchange="btcSave()"></td><td class="btc-tier">'+(tier?btcEsc(tier.label)+' · 第 '+tier.n+' 档':'待获取 BTC 价格')+'</td><td class="btc-price-parts">'+(tier?.n??'—')+'</td><td><input aria-label="金金倍数" type="number" min="0" max="13" step="1" value="'+(btcNumber(row.jinjinMultiple)??'')+'" placeholder="2" oninput="btcSetField(\''+btcEsc(row.id)+'\',\'jinjinMultiple\',this.value)" onchange="btcSave()"></td><td class="btc-share-total">'+(shares??'—')+'</td><td><input aria-label="成交价" type="number" min="0" step="0.01" value="'+(btcNumber(row.executionPrice)??'')+'" onchange="btcSetField(\''+btcEsc(row.id)+'\',\'executionPrice\',this.value);btcSave()"></td><td><input aria-label="成交额" type="number" min="0" step="0.01" value="'+(btcNumber(row.amount)??'')+'" onchange="btcSetField(\''+btcEsc(row.id)+'\',\'amount\',this.value);btcSave()"></td><td><label class="btc-done"><input type="checkbox" '+(row.executed?'checked':'')+' '+(disabled?'disabled':'')+' aria-label="第 '+(48+index)+' 条已执行" onchange="btcToggleExecuted(\''+btcEsc(row.id)+'\',this.checked)"><span>'+(row.executed?'已执行':'待执行')+'</span></label></td><td><input aria-label="备注" value="'+btcEsc(row.note||'')+'" onchange="btcSetField(\''+btcEsc(row.id)+'\',\'note\',this.value);btcSave()"></td></tr>'}
function btcPanel(){
 const entries=btcPlan.entries||[];
 return '<section class="card btc-plan"><div class="view-toolbar"><div><div class="view-heading-label">INVESTMENT PLAN</div><h2>BTC 投资计划</h2><p>行情来源：<a href="https://dashboard.jinjin123.com/" target="_blank" rel="noreferrer">金金分区间定投仪表盘</a> · 录入价格后自动判定档位、计算应投份数</p></div><span class="pill">计划更新 2026-11-11</span></div><div class="btc-source-note" role="status">'+(btcLoading?'正在读取云端记录…':btcLoadError?'云端读取失败：'+btcEsc(btcLoadError):'金金网站的实时行情接口尚未接通。当前行情字段可先手动填写，不会用旧值冒充实时价格。')+'</div><div class="btc-rules"><details><summary>查看定投规则</summary><div class="table-scroll"><table class="record-table"><thead><tr><th>BTC 价格区间（美元）</th><th>价格份数</th></tr></thead><tbody>'+[['80,000 以上',0],['75,000–80,000',1],['72,500–75,000',2],['70,000–72,500',3],['67,500–70,000',4],['65,000–67,500',5],['62,500–65,000',6],['60,000–62,500',7],['60,000 以下',8]].map(x=>'<tr><td>'+x[0]+'</td><td>'+x[1]+'</td></tr>').join('')+'</tbody></table></div><p class="stat-note">应投份数 = 价格份数 + 金金倍数。价格档位按 BTC 价格自动判定。</p></details></div><div class="btc-table-scroll"><table class="record-table btc-record-table"><thead><tr><th>编号</th><th>日期</th><th>BTC 价格</th><th>价格区间（自动）</th><th>价格份数</th><th>金金倍数</th><th>应投份数</th><th>成交价</th><th>成交额</th><th>执行状态</th><th>备注</th></tr></thead><tbody>'+(btcLoading?'':entries.map(btcEntryRow).join(''))+'</tbody></table></div><div class="row btc-actions"><button onclick="btcAddEntry()" '+(!btcLoaded||btcSaveBusy?'disabled':'')+'>新增记录</button><span id="btc-save-status" role="status">'+(btcLoadError?'尚未读取记录':btcVersion?'已读取并同步':'图片中的两条示例记录，首次保存后写入私人数据库')+'</span></div></section>'
}
function btcSetField(id,key,value){const row=btcPlan.entries.find(x=>x.id===id);if(!row)return;if(key==='date'||key==='note')row[key]=value;else row[key]=btcNumber(value);const el=document.getElementById('btc-row-'+id);if(!el)return;const tier=btcTier(row.btcPrice),shares=btcShares(row);el.querySelector('.btc-tier').textContent=tier?tier.label+' · 第 '+tier.n+' 档':'待获取 BTC 价格';el.querySelector('.btc-price-parts').textContent=tier?tier.n:'—';el.querySelector('.btc-share-total').textContent=shares??'—'}
async function btcSave(){
 if(!btcLoaded||btcSaveBusy)return;btcSaveBusy=true;const status=document.getElementById('btc-save-status');if(status)status.textContent='正在保存…';document.querySelectorAll('.btc-done input').forEach(x=>x.disabled=true);
 try{const response=await fetch('/api/investments/btc',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan:btcPlan,expectedVersion:btcVersion})}),data=await response.json();if(!response.ok){if(data.conflict){btcVersion=null;btcLoadError=data.error||'云端版本冲突，请刷新页面核对'}throw Error(data.error||'保存失败')}btcVersion=data.version;if(status)status.textContent='已保存到私人数据库并核实'}catch(error){if(status)status.textContent='保存失败：'+(error.message||'未知错误')+'；请勿关闭页面，原输入仍保留'}finally{btcSaveBusy=false;document.querySelectorAll('.btc-done input').forEach(x=>x.disabled=false)}
}
function btcToggleExecuted(id,checked){const row=btcPlan.entries.find(x=>x.id===id);if(!row)return;row.executed=!!checked;const label=document.querySelector('#btc-row-'+id+' .btc-done span');if(label)label.textContent=row.executed?'已执行':'待执行';btcSave()}
function btcAddEntry(){if(!btcLoaded)return;const last=btcPlan.entries.at(-1),base=last?.date||today,d=new Date(base+'T12:00:00+08:00');d.setUTCDate(d.getUTCDate()+1);const next=d.toISOString().slice(0,10);btcPlan.entries.push({id:'entry-'+crypto.randomUUID(),date:next,btcPrice:null,jinjinMultiple:2,executionPrice:null,amount:null,executed:false,note:'每日定投'});render();btcSave()}
const btcPreviousRender=render;render=function(){btcPreviousRender();if(page==='五个领域'&&activeDomain===1){const intro=$('#app .domain-intro')?.parentElement;if(intro){intro.insertAdjacentHTML('afterend',btcPanel());btcEnsureLoaded()}}};
