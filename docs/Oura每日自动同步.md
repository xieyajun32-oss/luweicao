# Oura 每日自动同步（部署配置）

## 运行方式

部署完成后，独立 Cloudflare Worker `luweicao-oura-sync` 使用 Cron Trigger 每天 00:30 UTC（北京时间 08:30）调用 `https://luweicao.pages.dev/api/integrations/oura/sync`，回补最近 7 天数据并跟进分页，覆盖 Oura 已授权的 19 类数据。同步复用网站现有 OAuth 凭据和既有 `PRIVATE_DB` 保存逻辑，不新建或绑定 D1，也不在 Worker 保存 Oura Token。Cron Worker 部署并配置两端密钥之前，自动同步尚未启用。

## 必需配置

- Pages 项目 `luweicao` 的 Production Secret：`OURA_SYNC_CRON_SECRET`
- 定时 Worker 的 Secret：`OURA_SYNC_SECRET`
- 两项 Secret 必须填入同一随机值，建议至少 32 字节；不要放入代码、GitHub 或聊天。
- 部署定时 Worker 时使用 `workers/oura-sync/wrangler.toml`；其 cron 为 `30 0 * * *`。

收到正确的 `X-Oura-Sync-Secret` 后，Pages Middleware 只为这个精确的 POST 同步路由跳过网站登录态校验；其他路由仍按私人登录验证。请求值以常量时间比较。

## 运行核对

Cloudflare Worker > Settings > Triggers > Cron Triggers 可查看表达式；Settings > Trigger Events 可查看最近运行状态。Observability 日志只记录日期范围、导入数量、分页数和错误类型，不记录健康指标、Oura Token 或 Secret。
