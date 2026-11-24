# BTC 数据保护与核验

仅适用于 BTC 投资计划的私人数据接口，不改变其他模块和资金口径。

## 程序约束

- 云端读取缺失或异常时禁止示例交易回填；已存在历史但主记录缺失时禁止重新初始化。
- BTC 每次更新和删除前，由数据库触发器在同一 SQL 语句中保留原件；写历史失败必须使原改写回滚。历史只追加，应用接口不提供历史改写或删除。
- 所有保存比较云端版本，版本时间严格递增；拒绝丢失原有记录 ID、原字段的整表提交。没有自动删除或静默合并。
- 页面编辑立即保存本机草稿，短延迟提交云端；云端成功回执核实后才清除对应草稿。连续编辑按最新版本串行续存。
- 页面重新获得焦点时核对云端；未确认草稿、版本差异或读取期间发生新编辑时保留原输入并停止覆盖。
- 本机保留最近确认副本及最近 30 个内容不同的确认副本。放弃未确认草稿前另存归档。浏览器存储失败必须提示，可下载 JSON 备份。
- “查看保存版本”为已登录私有接口，只读，不自动恢复；下载备份包含所选历史及本机草稿，不上传其他服务。

## 回归测试

Node 22 或更新版本：

```sh
node --experimental-default-type=module tests/btc-investment.test.mjs
node --experimental-default-type=module tests/btc-investment-update.test.mjs
node --experimental-default-type=module tests/btc-summary.test.mjs
node --experimental-default-type=module tests/btc-data-protection.test.mjs
```

整页测试需在测试环境提供 jsdom 22，可用 `BTC_JSDOM_MODULE` 指定既有安装的绝对模块路径：

```sh
node --experimental-default-type=module --experimental-vm-modules tests/btc-data-protection-runtime.test.mjs
```

必须实际验证读取、编辑、断网草稿、冲突、版本历史及既有入口；不得向正式网站提交匿名测试交易。

## 数据异常处理

先保留现状及原设备标签页；核对私人接口 `GET /api/investments/btc`、本机草稿与确认副本。`?history=1` 按 ID 分页列出版本，`?snapshot=ID` 精确回读。确认原件后才按明确恢复范围操作；不要猜测金额、日期、份数或执行状态。历史数据不得加入源码库。

新增保护仅能保留启用时仍存在的记录及之后的改动，不能追溯生成此前没有保留的交易版本。本机存储随设备、浏览器和清缓存而变化，不等于独立异地备份。Cloudflare 的平台级历史需另行核验实际数据库与保留窗口；禁止为恢复一条 BTC 记录直接回退含日记等资料的整库。
