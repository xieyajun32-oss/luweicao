# Oura 每日自动同步（部署配置）

## 运行方式

部署完成后，独立 Cloudflare Worker `luweicao-oura-sync` 使用 Cron Trigger 每天 00:30 UTC（北京时间 08:30）调用 `https://luweicao.pages.dev/api/integrations/oura/sync`，回补最近 7 天数据并跟进分页，覆盖 Oura 已授权的 19 类数据。同步复用网站现有 OAuth 凭据和既有 `PRIVATE_DB` 保存逻辑，不新建或绑定 D1，也不在 Worker 保存 Oura Token。Cron Worker 部署并配置两端密钥之前，自动同步尚未启用。

## 必需配置

- 复用 Pages 项目 `luweicao` 已有的 Production Secret：`OWNER_LOGIN_SECRET`，不新增 Pages Secret。
- 定时 Worker 的 Secret 变量也命名为 `OWNER_LOGIN_SECRET`，填入与网站密码完全相同的值。不要放入代码、GitHub 或聊天。
- 部署定时 Worker 时使用 `workers/oura-sync/wrangler.toml`；其 cron 为 `30 0 * * *`。

收到正确的 `X-Owner-Secret` 后，Pages Middleware 只为这个精确的 POST 同步路由跳过网站登录态校验；其他路由仍按私人登录验证。请求值以常量时间比较。复用网站密码会降低密钥隔离：定时 Worker 持有该密码；不要启用请求头日志，也不要在日志中输出环境变量。

## 运行核对

Cloudflare Worker > Settings > Triggers > Cron Triggers 可查看表达式；Settings > Trigger Events 可查看最近运行状态。Observability 日志只记录日期范围、导入数量、分页数和错误类型，不记录健康指标、Oura Token 或 Secret。
