# Sub2API 自定义菜单接入

Sub2API 网站地址固定为 `https://www.open1.codes/`，直连模式使用 `https://www.open1.codes/v1`，Docker 默认使用同源代理。地址、供应商和异步模式已内置，网页仅需填写 API Key。

直接访问工作台时正常进入页面，点击右上角「API Key」填写并保存即可。只有链接携带非空 `token`，或当前标签页已有网站认证会话时，才校验身份、读取图像分组 Key 并自动配置。没有认证信息时，根路径和 `/image/` 均可直接进入。

在 Sub2API 的「系统设置 → 自定义菜单页面」添加菜单，填写工作台的完整 URL（例如 `https://www.open1.codes/image/`），打开方式选择「新标签页打开」，按需设置用户或管理员可见。旧菜单默认继续使用嵌入方式。

菜单沿用网站已有的参数：`token`、`user_id`、`src_host`、`src_url`、`theme`、`lang`。新标签页的 `ui_mode` 为 `standalone`。工作台读取网站登录凭据后清理地址栏里的认证参数，使用 `/api/v1/auth/me` 验证真实用户身份，再分页读取 `/api/v1/keys`。

## 自动配置

- 只展示当前用户的有效 Key；分组必须启用 `allow_image_generation`，状态为 `active`，平台为 `openai` 或 `grok`，与 Sub2API 异步图像接口的条件一致。分组名称无需包含 `image`。
- 顶部按分组选择 Key，首次默认选中最新的可用 Key；刷新后保留选中的配置，失效时切换至可用项。
- 自动使用内置供应商 `sb2api-async`（显示为 `sub2api（异步）`），直连地址为来源网站的 `/v1`；启用 Docker 专用代理时使用工作台同源 `/sub2api-api/v1`。关闭流式输出和通用 API 代理。
- 手动填写 Key 时使用 `gpt-image-2`；自动读取分组时，OpenAI 默认模型为 `gpt-image-2`，Grok 默认模型为 `grok-imagine-image`。图片尺寸、质量和数量仍可在生成栏中调整。
- 提交接口为 `/v1/images/generations/async` 或 `/v1/images/edits/async`，通过 `/v1/images/tasks/{task_id}` 轮询结果。
- 没有符合条件的 Key 时，显示「去创建 API Key」和「刷新 Key 列表」。创建时需选择已开启图片生成的分组。

## 部署

推荐使用已配好参数的 [Docker Compose 部署](docker-compose.md)：在仓库根目录执行 `docker compose up -d --build`。默认通过容器转发到 `https://www.open1.codes/`，涵盖认证、Key 列表和异步图像接口，浏览器无需跨域请求。Compose 默认绑定宿主机 `127.0.0.1:8081`。

两个项目仍各自构建和部署。Sub2API 本次修改包含后端菜单字段，发布时需同时更新 Sub2API 前端和后端。工作台的 `dist/` 可由独立静态站点提供，也可在同站点 `/image/` 下提供；访问子目录时保留末尾的 `/`。仅设置菜单 URL 不会自动部署工作台文件。

工作台页面开放访问，通过菜单携带认证时自动配置；认证模式下，同源部署会跟随 Sub2API 当前登录状态更新 token。网站地址已固定，部署时只需按需调整端口和代理开关。

```sh
npm ci
npm run build
npm test
```

浏览器直连 API 的跨域部署需在 Sub2API 的 CORS 配置中允许工作台域名及 `Authorization` 请求头。同源部署或开启 Compose 专用代理后无需额外 CORS 配置。Sub2API 服务端还需启用异步图像任务及对象存储；Key 分组权限和异步服务是否启用是两项独立条件。

例如，工作台页面来源为 `https://gpt-image-playground.cooksleep.dev`、API 为 `https://www.open1.codes` 时，在 Sub2API 实际加载的 `config.yaml` 中合并以下配置并重启服务：

```yaml
cors:
  allowed_origins:
    - "https://gpt-image-playground.cooksleep.dev"
```

保留已有的允许来源；之后将修改后的工作台部署到自己的域名时，再加入它的完整 Origin（协议、域名及非默认端口，无路径和末尾斜杠）。这里填写的是**工作台页面来源**。Sub2API 现有中间件已支持 `Authorization`、`Content-Type`、`GET`、`POST` 和 `OPTIONS`，无需额外修改生图请求代码。若前置 Nginx/CDN 自行响应或拦截 `OPTIONS`，也需让预检请求正常到达 Sub2API，并避免把 API 请求重定向到另一个域名。

将工作台静态文件放在 `https://www.open1.codes/image/`，API 也使用 `https://www.open1.codes/v1`，则浏览器请求为同源。使用新标签页也能避开 iframe 的第三方存储环境；浏览器扩展引起的 Tracking Prevention、自动填充语言或 PWA 提示需与 API CORS 错误分别处理。

网站 token 仅保存在当前标签页的 `sessionStorage`，API Key 只存于内存，刷新时重新拉取。配置、画廊和图片按网站来源及经服务端验证的用户 ID 分开保存。页面每分钟及重新聚焦时检查会话和 Key；登录失效后显示登录提示。同源退出登录会同步关闭工作台，跨域登录过期后需从 Sub2API 菜单重新打开。

菜单继承已有的 URL 携带 token 机制，因此静态站点访问日志应避免记录查询字符串。工作台会尽早清理地址栏，并使用 `no-referrer` 防止后续资源请求携带页面 URL。
