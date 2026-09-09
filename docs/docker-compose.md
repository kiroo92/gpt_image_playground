# Docker Compose 部署

默认参数已配置为你的 Sub2API 网站 `https://www.open1.codes/`。认证、图像分组 Key 列表、异步生图和任务轮询都经工作台容器的 Nginx 转发，浏览器只访问工作台自身的域名，无需在 Sub2API 为这个工作台额外添加 CORS 来源。

## 启动

在服务器执行：

```bash
git clone git@github.com:kiroo92/gpt_image_playground.git
cd gpt_image_playground
docker compose up -d --build
```

已有仓库时，在仓库目录执行最后一条命令即可。Compose 从 `deploy/Dockerfile` 构建本仓库源码，无需使用上游官方镜像。默认绑定 `127.0.0.1:8081`，适合同机 Nginx、宝塔或 1Panel 做 HTTPS 反向代理。

## 参数

默认值可直接使用。需要修改时，复制 `.env.example` 为 `.env`：

```dotenv
SUB2API_URL=https://www.open1.codes/
SUB2API_PROXY_ENABLED=true
BIND_ADDRESS=127.0.0.1
WEB_PORT=8081
```

| 参数 | 默认值 | 用途 |
| --- | --- | --- |
| `SUB2API_URL` | `https://www.open1.codes/` | 固定的网站来源，同时用于登录入口、Key 管理链接及容器上游。填写 Origin，可带末尾 `/`，不带 API 路径、用户名或密码 |
| `SUB2API_PROXY_ENABLED` | `true` | 启用认证与图像接口的同源转发；关闭后浏览器直连 Sub2API，需要配置 CORS |
| `BIND_ADDRESS` | `127.0.0.1` | 宿主机监听地址；跨机器反代或直接通过服务器 IP 访问时设置 `0.0.0.0` |
| `WEB_PORT` | `8081` | 宿主机端口，避开 Sub2API 常用的 `8080` |

运行参数在容器启动时注入，修改 `.env` 后执行 `docker compose up -d` 即可应用，无需为参数变更重新编译。API Key 在登录后自动获取，不需要填写到 `.env`。图像及历史记录保存在用户浏览器中，容器无需数据库或数据卷；容器日志自动轮转。

## 域名反向代理

工作台使用自己的 HTTPS 域名时，将该域名的反向代理目标设为 `http://127.0.0.1:8081`。同机 Nginx 的站点配置示例（放进已有 HTTPS `server` 块）：

```nginx
location / {
    proxy_pass http://127.0.0.1:8081;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 600m;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;
    proxy_buffering off;
}
```

若将工作台挂在现有 `www.open1.codes` 的 `/image/` 下，保留 Sub2API 现有站点配置，并增加以下位置：

```nginx
location = /image {
    return 301 /image/;
}

location /image/ {
    # 末尾 / 用于去掉 /image/ 前缀，容器内仍从根目录提供静态文件。
    proxy_pass http://127.0.0.1:8081/;
    proxy_set_header Host $host;
}

location /sub2api-api/ {
    # 保留该前缀，交给工作台容器内的专用代理处理。
    proxy_pass http://127.0.0.1:8081;
    proxy_set_header Host $host;
    client_max_body_size 600m;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;
    proxy_buffering off;
}
```

反代本身运行在另一个容器时，`127.0.0.1` 指向该反代容器。可将两个容器加入同一 Docker 网络，并将目标设为 `http://gpt-image:80`，无需通过宿主机端口。

在 Sub2API「自定义菜单页面」填写最终工作台 URL，选择「新标签页打开」。菜单继续携带网站认证，工作台自动加载当前用户可用的图像 Key。服务端仍需启用异步图像任务、对象存储及对应分组的图片生成权限。

前置 Nginx/CDN 的访问日志也应仅记录路径，避免保留菜单传入的认证查询参数；容器内的访问日志已经按此配置。

## 更新与停止

```bash
git pull --ff-only
docker compose up -d --build
```

```bash
docker compose down
```

停止或重建容器不会删除浏览器里的历史图像。保持工作台域名不变，即可继续访问原有记录。

