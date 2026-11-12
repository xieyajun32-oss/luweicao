import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../static/system/views.js',import.meta.url),'utf8');
const view=source.slice(source.indexOf('function domainView(){'),source.indexOf('\nfunction openNotebookDate'));
assert(view.includes('打开人生时间轴'));
assert(view.includes('篇相关记录'));
assert(!view.includes('domainText('));
assert(!view.includes('阅读完整记录'));
console.log('五个领域项目页仅显示关联数量，不在项目下方展开日记原文；完整内容仍可从人生时间轴查看：通过');
