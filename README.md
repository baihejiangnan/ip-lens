# IP Lens

IP 信息与常用风险检测入口聚合工具。前端托管在 GitHub Pages，免费 IPinfo Lite 查询通过 Cloudflare Workers 转发。Scamalytics 暂时使用原位置的带 IP 跳转卡片。

- 网站：https://baihejiangnan.github.io/ip-lens/
- 后端：https://ip-lens-api.ip-lens.workers.dev

## 当前能力

- 浏览器获取当前出口 IP，支持手动查询 IPv4 / IPv6。
- IPinfo 基础数据、原始返回数据及中文解释。
- 免费方案不提供的 VPN、住宅身份、AS Type、Company 等字段明确显示“未提供”。没有数据不代表低风险。
- Scamalytics 风险评估跳转：分数越低，评估的欺诈风险越低。
- IPOK、Net.Coffee、IPIP.la、BrowserLeaks 快捷入口。BrowserLeaks 直达 `https://browserleaks.com/dns`，专页会自动启动 DNS 泄漏检测，无需再点击 IP 综合页的 Run DNS Leak Test 按钮。
- 四张交叉检测卡片均通过问号展示检测重点和结果解读，支持悬停、键盘聚焦或点击查看，保持卡片紧凑。IPOK 风险值越低表示不利证据越少；Net.Coffee 用于核对各网站出口与预期分流；IPIP.la 伪装正确率越高表示该站判定的环境匹配程度越高。
- BrowserLeaks 提示留意 DNS 结果是否出现中国（CN）地区；地区是排查线索，不能单凭地区判定泄漏。该检测使用浏览器当前连接，与上方手动输入的目标 IP 无关。
- 可开启、关闭和排序检测源，偏好保存在浏览器本地。
- “添加检测网站”入口生成 GitHub 文件草稿，由有写入权限的合作者确认提交；新增入口会保留访客已有的显示偏好。

## 协作者添加网站

在“继续交叉验证”旁点击“添加检测网站”，填写名称、唯一标识、HTTPS 网址、简述、检测方式和悬停提示，生成草稿后点击“在 GitHub 确认添加”。新文件内容会预填到 GitHub；若未预填，可从弹窗中复制配置。用有仓库写入权限的 GitHub 账号核对并提交；进入 main 后会自动检查、构建并发布。

协作者接受仓库邀请后，使用自己的 GitHub 账号操作即可。建议在 GitHub 提交时选择新建分支并创建 PR，由仓库维护者审核合并后上线。

入口可被所有人看见，但表单只生成待提交配置，不会直接写入本站。发布权限由 GitHub 服务端控制。无写入权限的访客不能直接修改官方仓库，可能只能提出 fork / PR 建议；仓库合作者需审核后合并。不需要把 GitHub Token 填进网站，也不需要额外管理员账号或后端写入接口。

检测源存放在 `sources/*.json`，每站一个文件。修改现有来源可从弹窗“编辑已有检测源”进入；新增真正的 API 查询功能仍需要开发接入，普通配置只添加快捷跳转。字段格式、开发边界与接手流程见 [AGENTS.md](AGENTS.md)。

## 协作者交接：用 agent 接手开发

仓库地址：[baihejiangnan/ip-lens](https://github.com/baihejiangnan/ip-lens)。先接受 GitHub 协作邀请，再用自己的账号克隆仓库：

```sh
git clone https://github.com/baihejiangnan/ip-lens.git
cd ip-lens
```

用 Codex 等 agent 工具打开整个 `ip-lens` 项目文件夹，让 agent 先阅读根目录的 [AGENTS.md](AGENTS.md) 和本 README。AGENTS.md 包含项目结构、检测源配置格式、数据含义、验证步骤与部署边界。

可以直接把下面这段发给 agent，替换其中的需求：

```text
请先阅读根目录 AGENTS.md 和 README.md，检查当前分支及未提交改动，
了解项目结构，再完成以下需求：【填写需求】。
请新建工作分支，保留已有改动，按项目指南运行构建、语法检查和测试；
涉及界面时验证桌面与手机效果。
完成后说明改动和验证结果，提交 PR 供审核，不要直接推送 main。
```

如果只添加快捷检测网站，也可以让 agent 按指南创建 `sources/<id>.json`，无需修改页面逻辑。每个来源都要填写检测重点与结果读法，明确分数方向；不要把新增跳转入口描述为已接入真实接口。

本地启动命令见下方“本地开发”。修改界面、提示文案或检测源配置，不需要 Cloudflare 权限，也不需要 API 密钥；现有正式 Worker 可供本地允许的来源查询。需要修改或部署后端时，再与仓库维护者协调 Cloudflare 权限和 Secret，不要把凭据放进代码或聊天。

日常协作流程是：新建分支 → 修改并验证 → 推送分支并创建 PR → 维护者审核合并。PR 自动运行检查，合并进入 main 后自动发布前端；前端变更无需重新部署 Worker。

## 免费数据路径

浏览器调用 `https://api.ipinfo.io/ip` 获取访问 IPinfo 时的出口，再把固定 IP 交给 Worker 查询 Lite。不会把 Worker 的出口当作用户 IP。IPinfo 连接失败时，可从 Worker 获取访问检测服务时的出口；页面会标明观察来源。代理分流可能让其他网站看到不同出口。

未配置 Worker 地址时，页面尝试 IPinfo 无账号公开 JSON 接口作为过渡方式，受同一出口每天 1,000 次共享额度限制。浏览器跨域策略或代理分流可能让该备用接口不可用，因此正式部署已配置 Worker。配置后使用免费 Lite Token，按 IPinfo 当前文档没有每日/月度查询上限。两种路径都不把缺失的高级字段当作安全结论。

## 本地开发

需要 Node.js 24。

```sh
npm ci
npm run build
npm run check
npm test
python -m http.server 8765 --directory site
```

配置或前端改动后重新运行 `npm run build`，它会校验检测源、生成被忽略的 `site/catalog.js`，并更新 HTML 资源版本，避免新增来源时沿用旧缓存。不要手工编辑目录构建产物。

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
