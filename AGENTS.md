# IP Lens：Agent 接手指南

## 项目与边界

IP Lens 是中文 IP 检测聚合工具。沿用静态前端 + 轻量 Worker 的架构，不引入付费套餐、数据库或额外登录系统，除非用户明确要求。

- 前端：https://baihejiangnan.github.io/ip-lens/
- 仓库：https://github.com/baihejiangnan/ip-lens
- Worker：https://ip-lens-api.ip-lens.workers.dev
- Node.js 24；原生 HTML / CSS / JavaScript ES modules，无前端框架。

## 先读哪里

- `README.md`：启动、数据路径、部署与协作说明。
- `site/index.html`、`site/styles.css`、`site/app.js`：页面结构、样式与交互。
- `sources/*.json`：交叉检测网站的唯一配置来源，一站一文件。
- `site/source-model.mjs`：配置校验、GitHub 草稿链接及本地偏好迁移。
- `scripts/build-sources.mjs`：生成 `site/catalog.js` 并更新入口资源的内容版本。
- `worker/index.mjs`、`wrangler.jsonc`：公开查询接口和部署配置。
- `tests/`、`.github/workflows/`：自动检查及发布流程。

`site/catalog.js` 是被 Git 忽略的构建产物，不能手工维护。修改配置或前端后运行构建；`site/index.html` 的资源版本会自动更新。

## 本地运行与验证

```sh
npm ci
npm run build
npm run check
npm test
python -m http.server 8765 --directory site
```

打开 `http://127.0.0.1:8765/`，不要直接用 `file://`，ES modules 需要 HTTP 服务。正式 Worker 允许该本地来源。若开发 Worker，按 README 配置本地 `.dev.vars` 和 `site/config.js`，不要把本地 apiBase 推送成线上配置。

配置修改后必须重新运行 `npm run build`。构建、语法检查和现有测试都通过后，再做与变更有关的浏览器验证。界面变更重点看桌面 / 手机、问号的悬停 / 聚焦 / 点击、Esc 关闭、对话框，以及新旧浏览器偏好。不要为静态文案重复写镜像测试；配置校验、权限边界或数据路径变化应补有意义的测试。

## 添加或修改检测网站

网站“继续交叉验证”右侧的“添加检测网站”会生成配置并跳转 GitHub 新建文件页。GitHub 负责登录和仓库写入权限；前端不会自行认证合作者，也没有保存配置的公开后端接口。无写入权限的用户至多提出 fork / PR 建议，不能直接改变官方站点。

Agent 也可直接创建 `sources/<id>.json`，格式如下：

```json
{
  "id": "example-ip",
  "name": "Example IP",
  "url": "https://example.com/check",
  "description": "IP 信誉与代理标记查询",
  "initial": "EX",
  "hint": "说明主要检测内容、评分方向和结果的限制。",
  "type": "原站查询",
  "order": 100
}
```

- `id` 唯一且稳定，小写字母开头，只能含小写字母、数字、短横线，文件名必须与之相同。不要重命名现有 id；用户偏好以此为键。`ipinfo`、`scam` 为保留名称。
- URL 必须 HTTPS，无内嵌账号密码；不得存储密钥、私人链接或敏感参数。添加前核对原站的实际功能，不凭站名推断。
- `type` 仅支持 `原站查询`、`检测当前连接`、`打开自动检测`。只有实测打开即检测时才选最后一种；它只是说明，不会自动点击第三方页面。
- `initial` 为 1–3 个字符；`order` 为 0–9999 的整数，小的在前。其他字段限制见 `validateSource`。
- 所有来源都带紧凑问号提示，提示不应撑高卡片。解释分数时明确高低方向；原站风险值、伪装正确率不可混为一谈。
- 配置只能提供原站快捷跳转。新增真正的 API 集成需要单独修改数据路径、权限、失败处理和测试，不能仅加一个 URL 冒充接入。
- 新增来源应追加到用户现有排序，保留已关闭项目；移除来源时清理失效偏好。不要重置整个 localStorage。
- 更新后运行构建和检查。在 GitHub 提交到 main 或合并 PR 后，Pages 工作流会生成新目录并发布。旧页面可能需要刷新以加载最新 HTML。

## 必须保持的数据含义

- IPinfo 当前使用免费 Lite：仅提供国家 / 大洲和 ASN 等基础信息。VPN、住宅身份、AS Type、Company、Hosted domains、Anycast 等缺失字段必须显示“未提供 / 待确认”，不能伪造或把缺失视为安全。
- 当前出口优先由浏览器向 IPinfo 获取，再把固定 IP 交给 Worker。不能在 Worker 直接查“自己的 IP”后当成用户 IP。回退来源必须明确标注。
- Scamalytics 保持带查询 IP 的外部跳转，不展示模拟风险分，也不调用未申请到的 API。
- BrowserLeaks 使用 `https://browserleaks.com/dns`，打开会自动检测当前浏览器连接。提示留意中国（CN）DNS 地区，但地区只是线索，不能单凭地区判定泄漏。
- 开启代理分流时，不同网站可能看到不同出口。当前连接测试与手动输入的目标 IP 是两回事。
- 不同数据源可以有不同结论。低分或住宅标签不能保证第三方平台可用。

## 安全与部署

- `IPINFO_TOKEN` 只能放 Cloudflare Secret / 本地忽略文件。不要打印密钥，不要写入前端、仓库、测试快照或 URL。测试用虚构值。
- 公共界面的全部配置文本都必须转义，不能作为 HTML 注入；URL 和配置由构建校验，不能信任输入。新增字段时同步校验和测试。
- Worker CORS 不是用户鉴权，不能拿 Origin 白名单保护写操作。GitHub 写权限也不应靠前端隐藏按钮或硬编码用户名判断。
- Worker 只请求固定 IPinfo 上游，保留 IP 校验、返回字段白名单、错误正文脱敏和 5 分钟成功缓存。不要随意开放任意上游代理。
- `main` 推送自动发布 `site/`；PR 只运行检查，不部署。前端 / 检测源变更无需部署 Worker。Worker 变更才按当前任务授权执行 `npm run deploy:worker`。
- 不自动开通付费套餐，不改变仓库成员权限，不添加额外 Token。需要新权限、密钥或服务时先说明具体原因。
- 发布后检查 Actions 成功及线上实际行为；汇报真实结果，失败或尚未验证的部分要说清楚。

## 协作习惯

以当前用户要求为准，小范围修改，保持现有中文文案和紧凑视觉风格。先检查工作区，保留他人的未提交改动。文档随最终行为更新，避免把废弃方案留作当前操作说明。交接时说明改了什么、如何验证、是否发布以及剩余限制；不要重复任何凭据。
