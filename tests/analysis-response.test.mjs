import assert from 'node:assert/strict';
import {onRequestPost,parseAnalysisResponse} from '../functions/api/inbox/analyze.js';
const valid={summary:'测试报告',domains:['健康'],kind:'体测',facts:[{name:'测试指标',value:12.3,source:'测试指标12.3kg',unit:'kg'},null,{name:'虚构指标',value:'99',source:'原文没有99'}]};
for(const response of [valid,JSON.stringify(valid),'```json\n'+JSON.stringify(valid)+'\n```']){const result=await onRequestPost({request:new Request('https://example.test/api/inbox/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'',extractedText:'测试指标12.3kg',files:['test.jpg']})}),env:{AI:{run:async()=>({response})}}});assert.equal(result.status,200);const data=await result.json();assert.equal(data.analysis.facts.length,1);assert.equal(data.analysis.facts[0].value,'12.3');}
assert.throws(()=>parseAnalysisResponse({response:'{"summary":'}));
const bad=await onRequestPost({request:new Request('https://example.test/',{method:'POST',body:JSON.stringify({text:'示例'})}),env:{AI:{run:async()=>({response:{summary:'缺字段'}})}}});assert.equal(bad.status,502);assert.equal((await bad.json()).code,'ANALYSIS_SCHEMA');
console.log('真实处理函数：对象/字符串/代码块响应、数字指标、无效事实过滤、不完整JSON与结构错误区分：通过');
