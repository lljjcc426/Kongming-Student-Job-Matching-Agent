# 服务器部署

应用使用 Node.js 24 提供页面和同源 API。以下以 Ubuntu、Nginx 和 systemd 为例；其他环境也可直接运行 `npm start`。

## 构建与目录

在开发机或构建环境执行：

```bash
npm ci
npm run build
npm run verify:server
```

将 `dist/`、`server/`、`package.json`、`package-lock.json`、`scripts/ocr-requirements.txt`、`scripts/backup-memory.mjs` 与 `deploy/` 上传至服务器的 `/opt/kongming/releases/<版本号>/`，在该目录执行 `npm ci --omit=dev`。前端产物可在开发机生成，无需在服务器上重复构建。

推荐布局：

```text
/opt/kongming/releases/<版本号>/   应用与构建产物
/opt/kongming/current             指向当前版本的符号链接
/etc/kongming/kongming.env         服务端配置，root 所有，权限 600
/var/lib/kongming/                账号数据库、备份、OCR 缓存、岗位数据和索引
```

安装 Node.js 24 和 Nginx，确认 `node` 位于 `/usr/local/bin/node`，或修改服务文件中的路径。创建运行账号与目录：

```bash
sudo useradd --system --create-home --home-dir /var/lib/kongming --shell /usr/sbin/nologin kongming
sudo install -d -m 755 /opt/kongming/releases /etc/kongming /var/www/acme
```

程序目录由管理员维护，运行账号只需读取权限。OCR 缓存、岗位数据和索引目录需要由 `kongming` 账号读写。

## 配置与启动

通过服务器本地编辑器创建 `/etc/kongming/kongming.env`，按[模型配置教程](configuration.md)填写自己的模型连接参数。配置文件不随发布包上传，不放入 `dist/`，也不使用 `VITE_*` 保存密钥。

```bash
sudo chmod 600 /etc/kongming/kongming.env
sudo ln -sfn /opt/kongming/releases/<版本号> /opt/kongming/current
sudo cp /opt/kongming/current/deploy/kongming.service /etc/systemd/system/
sudo cp /opt/kongming/current/deploy/nginx.conf /etc/nginx/sites-available/kongming
sudo ln -s /etc/nginx/sites-available/kongming /etc/nginx/sites-enabled/kongming
sudo unlink /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable --now kongming nginx
sudo systemctl reload nginx
```

上述 `unlink` 仅用于新服务器默认站点；已有网站时先调整虚拟主机，避免覆盖其他服务。云安全组需允许 Web 端口 80、443；应用端口 3000 保持监听 `127.0.0.1`。

```bash
curl --fail http://127.0.0.1:3000/api/health
sudo systemctl status kongming --no-pager
sudo journalctl -u kongming -n 50 --no-pager
```

`/api/health` 检查应用进程可响应，不调用付费模型。上线后再用虚构简历验证一次实际模型调用。

## 数据库与备份

SQLite 适用于当前单实例部署。数据库采用 WAL 模式，账号、会话、对话、反馈、面试记录和成长计划均按账号存储。首次启动前创建私有目录：

```bash
sudo install -d -o kongming -g kongming -m 700 /var/lib/kongming/memory /var/lib/kongming/backups
```

在服务端环境文件中配置：

```dotenv
AGENT_MEMORY_DB_PATH=/var/lib/kongming/memory/agent-memory.sqlite3
AGENT_MEMORY_BACKUP_DIR=/var/lib/kongming/backups
```

数据库与发布目录分离，应用更新或回滚不会覆盖记录。不要将数据库、WAL 文件或备份放入静态目录、Git 仓库和发布压缩包。启用每日备份：

```bash
sudo cp /opt/kongming/current/deploy/kongming-backup.service /etc/systemd/system/
sudo cp /opt/kongming/current/deploy/kongming-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now kongming-backup.timer
sudo systemctl start kongming-backup.service
sudo systemctl list-timers kongming-backup.timer
```

备份使用 SQLite 在线备份接口，可在应用运行时执行；文件仅由运行账号读取，自动清理超过 14 天的本工具备份。备份包含用户数据和会话信息，应按数据库同等标准保护。当前备份保存在同一服务器，仍需按实际运维要求安排异机副本。

恢复时先停止 `kongming`，将现有数据库及其 `-wal`、`-shm` 文件移到另一个私有目录保留，再将选定备份复制到 `AGENT_MEMORY_DB_PATH`，恢复 `kongming` 所有权及 `600` 权限后启动服务。不要在进程运行时直接覆盖数据库文件。

## OCR 与岗位知识库

OCR 为可选服务，可按[安装说明](getting-started.md#ocr)建立独立 Python 环境，并设置 `OCR_PROVIDER=local`、`OCR_PYTHON_PATH` 和 `OCR_MODEL_CACHE=/var/lib/kongming/ocr`。首次识别会下载模型；确保模型目录由运行账号读写。Ubuntu 使用 OpenCV 时还需安装系统库 `libgl1`。Node.js 停止时会关闭所属 Python 工作进程。

岗位知识库需自行准备数据、嵌入模型和索引。配置 `JOB_RAG_DATA_PATH` 后生产服务才会启用它，其余路径见[配置教程](configuration.md)。这些数据保存在发布目录之外，更新应用时保留。检索模型和可选重排模型占用额外内存，应根据实际模型评估机器容量。

## HTTPS

浏览器摄像头、麦克风相关功能通常需要 HTTPS 或 localhost。使用域名时，解析到服务器并为 Nginx 配置可信证书及自动续期。

没有域名也可使用支持 IP 证书的 ACME 客户端。Let's Encrypt 提供有效期约六天的 IP 证书；Certbot 的 webroot 方式需要 5.4 或更新版本，详见[官方说明](https://letsencrypt.org/2026/03/11/shorter-certs-certbot)。先启动 HTTP 站点，再安装客户端并签发证书：

```bash
sudo apt-get install python3-venv
sudo python3 -m venv /opt/certbot
sudo /opt/certbot/bin/pip install 'certbot>=5.4'
sudo /opt/certbot/bin/certbot certonly --webroot --webroot-path /var/www/acme \
  --preferred-profile shortlived --ip-address <服务器公网IP> --cert-name kongming-ip
```

按客户端提示完成注册。证书签发后，启用 HTTPS 配置和定时续期：

```bash
sudo cp /opt/kongming/current/deploy/nginx-https.conf /etc/nginx/sites-available/kongming
sudo nginx -t
sudo systemctl reload nginx
sudo cp /opt/kongming/current/deploy/kongming-certbot.service /etc/systemd/system/
sudo cp /opt/kongming/current/deploy/kongming-certbot.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now kongming-certbot.timer
sudo /opt/certbot/bin/certbot renew --dry-run --no-random-sleep-on-renew
```

HTTPS 模板使用证书名称 `kongming-ip`；名称或路径不同时同步修改配置。定时器每六小时检查一次，实际签发由 Certbot 判断，续期成功后重新加载 Nginx。域名证书可按实际名称替换相应路径，并设置 `server_name`。

## 更新与回滚

每次发布使用新版本目录，安装依赖后切换 `current` 并重启：

```bash
sudo ln -sfn /opt/kongming/releases/<新版本号> /opt/kongming/current
sudo systemctl restart kongming
curl --fail http://127.0.0.1:3000/api/health
```

出现问题时，将符号链接切回上一版本并再次重启。环境变量、证书和 `/var/lib/kongming` 内的数据不随版本切换。systemd 负责开机启动及异常退出后的重启；运行日志通过 `journalctl -u kongming` 查看。
