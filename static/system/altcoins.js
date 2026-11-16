/* Independent altcoin buy log. Private trade data is never seeded in source. */
let investmentProject='btc',altPlan={entries:[]},altVersion=null,altLoaded=false,altLoading=false,altBusy=false,altConflict=false,altMessage='',altPendingEntry=null;
let altDraft={date:today,symbol:'',unitPrice:'',amount:''};
function altEsc(value){return esc(value??'')}
function altSelect(project){investmentProject=project;render()}
function altDraftSet(key,value){altDraft[key]=value}
function altFormat(value){return Number(value).toLocaleString('zh-CN',{maximumFractionDigits:12})}
function altVisible(){return page==='五个领域'&&activeDomain===1&&investmentProject==='alt'}
async function altEnsureLoaded(force=false){
 if(altLoading||altBusy||altLoaded&&!force)return;altLoading=true;altMessage='正在读取山寨买入记录…';
 try{const response=await fetch('/api/investments/altcoins',{cache:'no-store'}),data=await response.json();if(!response.ok)throw Error(data.error||'读取失败');altPlan=data.plan||{entries:[]};altVersion=data.version;altLoaded=true;altConflict=false;
  if(altPendingEntry&&altPlan.entries.some(row=>row.id===altPendingEntry.id)){const same=altDraft.date===altPendingEntry.date&&altDraft.symbol.trim().toUpperCase()===altPendingEntry.symbol&&Number(altDraft.unitPrice)===altPendingEntry.unitPrice&&Number(altDraft.amount)===altPendingEntry.amount;altPendingEntry=null;if(same)altDraft={date:altDraft.date,symbol:'',unitPrice:'',amount:''};altMessage='上次买入记录已保存并重新读取核实'+(same?'':'；当前新输入已保留')}else altMessage=altVersion?'山寨买入记录已读取':'暂无已保存的山寨买入记录';
 }catch(error){altMessage='读取失败：'+error.message}finally{altLoading=false;if(altVisible())render()}
}
function altPanel(){const disabled=!altLoaded||altBusy||altConflict;return '<section class="card alt-plan"><header><h2>山寨投资计划</h2><p>独立记录山寨币买入，价格与金额单位为 USDT（U）。</p></header><h3>山寨买入</h3><div class="alt-table-scroll"><table class="alt-table" aria-label="山寨买入记录"><thead><tr><th>日期</th><th>币种</th><th>买入单价（USDT）</th><th>买入金额（USDT）</th></tr></thead><tbody>'+(altPlan.entries||[]).map(row=>'<tr><td>'+altEsc(row.date)+'</td><td>'+altEsc(row.symbol)+'</td><td>'+altFormat(row.unitPrice)+'</td><td>'+altFormat(row.amount)+'</td></tr>').join('')+'</tbody></table></div>'+(!altPlan.entries.length?'<p class="alt-muted">暂无山寨买入记录。</p>':'')+'<form class="alt-form" onsubmit="event.preventDefault();altSaveBuy()"><label>日期<input aria-label="山寨买入日期" type="date" required value="'+altEsc(altDraft.date)+'" '+(altBusy?'disabled':'')+' oninput="altDraftSet(\'date\',this.value)"></label><label>币种<input aria-label="山寨币种" required maxlength="20" placeholder="币种代码" value="'+altEsc(altDraft.symbol)+'" '+(altBusy?'disabled':'')+' oninput="altDraftSet(\'symbol\',this.value)"></label><label>买入单价（USDT）<input aria-label="山寨买入单价" type="number" min="0.000000000001" step="any" required value="'+altEsc(altDraft.unitPrice)+'" '+(altBusy?'disabled':'')+' oninput="altDraftSet(\'unitPrice\',this.value)"></label><label>买入金额（USDT）<input aria-label="山寨买入金额" type="number" min="0.000000000001" step="any" required value="'+altEsc(altDraft.amount)+'" '+(altBusy?'disabled':'')+' oninput="altDraftSet(\'amount\',this.value)"></label><div class="alt-actions"><button type="submit" '+(disabled?'disabled':'')+'>'+(altBusy?'正在保存…':'保存买入记录')+'</button><button type="button" onclick="altEnsureLoaded(true)" '+(altBusy||altLoading?'disabled':'')+'>重新读取记录</button></div></form><p id="alt-status" role="status">'+altEsc(altMessage)+'</p></section>'}
async function altSaveBuy(){
 if(!altLoaded||altBusy||altConflict)return;
 const draft={date:altDraft.date,symbol:altDraft.symbol.trim().toUpperCase(),unitPrice:Number(altDraft.unitPrice),amount:Number(altDraft.amount)};
 if(!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)||!/^[A-Z0-9][A-Z0-9._-]{0,19}$/.test(draft.symbol)||![draft.unitPrice,draft.amount].every(n=>Number.isFinite(n)&&n>0&&n<=1e9)){altMessage='请填写有效日期、币种、买入单价和买入金额';render();return}
 const same=altPendingEntry&&['date','symbol','unitPrice','amount'].every(key=>altPendingEntry[key]===draft[key]);
 const entry=same?altPendingEntry:{id:'alt-'+crypto.randomUUID(),...draft};altPendingEntry=entry;
 const candidate={...altPlan,entries:[...altPlan.entries.filter(row=>row.id!==entry.id),entry]};
 altBusy=true;altMessage='正在保存山寨买入记录…';render();
 try{const response=await fetch('/api/investments/altcoins',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan:candidate,expectedVersion:altVersion})}),data=await response.json();if(!response.ok){if(data.conflict)altConflict=true;throw Error(data.error||'保存失败')}if(data.verified!==true||!data.version)throw Error('保存回执未核实');altPlan=candidate;altVersion=data.version;altPendingEntry=null;altDraft={date:draft.date,symbol:'',unitPrice:'',amount:''};altMessage='山寨买入记录已保存到私人数据库并回读核实';
 }catch(error){altMessage='保存失败：'+error.message+'；原输入已保留。'+(altConflict?'请重新读取记录后核对。':'可重试保存。')}
 finally{altBusy=false;if(altVisible())render()}
}
const altPreviousRender=render;render=function(){altPreviousRender();if(page!=='五个领域'||activeDomain!==1)return;const btc=document.querySelector('.btc-plan');if(!btc)return;btc.insertAdjacentHTML('beforebegin','<div class="investment-project-tabs" role="tablist" aria-label="投资计划板块"><button role="tab" aria-selected="'+(investmentProject==='btc')+'" onclick="altSelect(\'btc\')">BTC 投资计划</button><button role="tab" aria-selected="'+(investmentProject==='alt')+'" onclick="altSelect(\'alt\')">山寨投资计划</button></div>');btc.hidden=investmentProject!=='btc';if(investmentProject==='alt'){btc.insertAdjacentHTML('afterend',altPanel());if(!altLoaded&&!altLoading&&!altMessage)altEnsureLoaded()}};
window.addEventListener('beforeunload',event=>{if(altBusy||altDraft.symbol||altDraft.unitPrice||altDraft.amount){event.preventDefault();event.returnValue=''}});
