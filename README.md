# IP Lens

IP 信息与常用风险检测入口聚合工具。前端托管在 GitHub Pages，免费 IPinfo Lite 查询通过 Cloudflare Workers 转发。Scamalytics 暂时使用原位置的带 IP 跳转卡片。

## 当前能力

- 浏览器获取当前出口 IP，支持手动查询 IPv4 / IPv6。
- IPinfo 基础数据、原始返回数据及中文解释。
- 免费方案不提供的 VPN、住宅身份、AS Type、Company 等字段明确显示“未提供”。没有数据不代表低风险。
- Scamalytics 风险评估跳转：分数越低，评估的欺诈风险越低。
- IPOK、Net.Coffee、IPIP.la、BrowserLeaks 快捷入口。
- 可开启、关闭和排序检测源，偏好保存在浏览器本地。

## 免费数据路径

浏览器调用 `https://api.ipinfo.io/ip` 获取访问 IPinfo 时的出口，再把固定 IP 交给 Worker 查询 Lite。不会把 Worker 的出口当作用户 IP。IPinfo 连接失败时，可从 Worker 获取访问检测服务时的出口；页面会标明观察来源。代理分流可能让其他网站看到不同出口。

未配置 Worker 地址时，页面使用 IPinfo 无账号公开 JSON 接口作为过渡方式，受同一出口每天 1,000 次共享额度限制。配置后使用免费 Lite Token，按 IPinfo 当前文档没有每日/月度查询上限。两种路径都不把缺失的高级字段当作安全结论。

## 本地开发

需要 Node.js 24。

```sh
npm ci
npm run check
npm test
python -m http.server 8765 --directory site
```

运行 Worker：在本机创建被 Git 忽略的 `.dev.vars`，填入 `IPINFO_TOKEN`，再运行 `npm run dev:worker`。把 `site/config.js` 中的 `apiBase` 设置为本地 Worker 地址。

## 部署

1. GitHub 仓库 Settings → Pages → Source 选择 GitHub Actions。推送 `main` 后 `.github/workflows/pages.yml` 检查代码并发布 `site/`。
2. 执行 `npx wrangler login`，登录自己的 Cloudflare 账号。
3. 执行 `npm run deploy:worker`，保留返回的 `workers.dev` 地址。
4. 通过 Cloudflare 控制台 Worker → Settings → Variables and Secrets，新增类型为 Secret 的 `IPINFO_TOKEN`。或者执行 `npx wrangler secret put IPINFO_TOKEN` 并在隐藏输入提示下录入。
5. 把 `site/config.js` 的 `apiBase` 改为 Worker HTTPS 地址后推送。

不需要 Scamalytics API Key、付费套餐、数据库或自有域名。密钥不能放进前端、GitHub 仓库或构建产物。修改部署域名时同步修改 `wrangler.jsonc` 的 `ALLOWED_ORIGINS`。

## 后端接口

- `GET /health`：返回服务名称和 Token 是否已配置，不返回 Token。
- `GET /api/ip`：返回 Worker 看到的访问者 IP，不缓存。
- `GET /api/lookup?ip=...`：校验 IP，再查询 IPinfo Lite；成功结果在 Cloudflare 边缘缓存 5 分钟。

API 仅返回文档规定的 Lite 字段；不透传鉴权失败的上游正文，不记录查询历史，不返回密钥。CORS 来源限制是浏览器访问控制，不等于用户身份认证；这是公开的基础 IP 查询接口。Worker Free 额度仍有上限，公开推广前应按访问规模评估限流和防滥用措施。

## 数据来源

- [IPinfo Lite](https://ipinfo.io/developers/lite-api)
- [IPinfo 免费方案说明](https://support.ipinfo.io/hc/en-us/articles/34121895556242-Legacy-Free-API-vs-IPinfo-Lite)
- [Scamalytics](https://scamalytics.com/)

IP address data powered by [IPinfo](https://ipinfo.io).
