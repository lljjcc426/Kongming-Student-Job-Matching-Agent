# 孔明职配云端业务网关

这是鸿蒙原生应用的轻量 Node.js 24 后端，不是 Web 套壳，也不运行 Vite 开发服务。仅依赖 `ws`，复用现有岗位采集、模型调用、限流和错误脱敏逻辑。

## 安全边界

- 默认只监听 `127.0.0.1:8787`，不直接开放公网业务接口。
- 只提供 `/api/gateway`，不提供静态文件，不提供 `.env`、源码或私有工作区下载。
- JSON 请求最大 8MB；非法 JSON、超大请求和异常统一返回安全错误。
- 默认忽略客户端伪造的代理 IP。只有经过明确配置、且来自本机代理的请求才接受 `X-Real-IP`；反向代理必须覆盖而不是透传该字段。
- 岗位缓存写入 `/var/lib/kongming/jobs.json`，不包含用户简历和面试工作区。
- 模型凭证存放于服务器 `/etc/kongming/gateway.env`，权限为 `600`，不得进入安装包、Git 或前端。

## 安装阶段

1. 通过可信的云控制台核对 SSH 主机指纹，配置部署公钥。
2. 在 Ubuntu 24.04 上安装 Node.js 24 LTS、npm 和 curl。
3. 将部署包解压到独立的临时目录。
4. 单独、安全地写入 `/etc/kongming/gateway.env`。参考 `gateway.env.example`，凭证不得通过聊天传递；不要照搬本机的 Windows `JOB_STORE_PATH`。
5. 执行 `sudo bash install.sh`，以 `kongming` 非登录用户运行 systemd 服务。
6. 在服务器本机检查岗位、匿名面试首题、追问和结构化反馈，不能只凭状态接口声称模型可用。

安装器保留旧 release，不清空岗位缓存，不安装宝塔，不修改 SSH 配置、防火墙或安全组。

## 公网发布门禁

完成可信 HTTPS、用户访问认证、流量费用告警及相关备案要求后，才能配置公网反向代理并切换正式 HAP 地址。CORS 和按 IP 限流不是用户认证，不能将本机接口不加保护地转为公开的付费模型调用入口。

阶段一私有服务可用不等于公网已上线。私有部署包仍不包含 Nginx 公网开放配置、真实模型凭证、个人简历、前端资源或 HAP。

## 阶段二：受限 HTTPS 内测

`nginx-private-https.conf`、`enable-private-https.sh`、`reload-nginx.sh` 与 `kongming-certbot-renew.service/timer` 独立部署，不放入初次私有 TGZ。启用器仅接受一个公网 IPv4 `/32` 内测来源，检查可信证书链与服务器 IP 匹配后再修改 Nginx；配置校验失败会恢复先前的 Nginx 配置。

此阶段需要已安装 Nginx、启用 `nginx-bootstrap.conf`、公网 80 证书路径可达，并在云安全组仅允许内测来源访问 443。不能将 `/32` 改为 `0.0.0.0/0` 当成正式多用户发布方案。浏览器根路径不提供网页版。

当前使用官方 Certbot 5.8.0 与 Let’s Encrypt `shortlived` IP 证书。Certbot 安装在服务器独立 Python venv，使用 HTTPS PyPI 源，不使用系统预设的 HTTP 包镜像：

```bash
sudo apt-get install -y python3-venv
sudo python3 -m venv /opt/kongming/certbot
sudo /opt/kongming/certbot/bin/python -m pip --isolated install --index-url=https://pypi.org/simple certbot==5.8.0
sudo /opt/kongming/certbot/bin/certbot certonly --webroot -w /var/lib/kongming-acme \
  --ip-address 121.41.44.243 --cert-name kongming-ip --required-profile shortlived \
  --non-interactive --agree-tos --register-unsafely-without-email
```

`--agree-tos` 接受证书机构条款；团队应在运行前审阅条款。当前注册未提供电子邮箱，不应依赖邮件提醒判断证书状态。IP 证书短期有效，启用器同时安装每 6 小时检查的 systemd timer 与成功续期后的 Nginx reload hook：

```bash
sudo bash enable-private-https.sh 121.41.44.243 "$ALLOWED_CIDR"
sudo /opt/kongming/certbot/bin/certbot renew --cert-name kongming-ip \
  --dry-run --run-deploy-hooks --no-random-sleep-on-renew
systemctl list-timers kongming-certbot-renew.timer
```

`ALLOWED_CIDR` 必须是从实际 SSH 连接或可信出口检测确认的开发机公网 IP 加 `/32`，不能填服务器地址。更换网络时，同时更新云安全组和 Nginx 来源限制，再验证 HTTPS。

TLS 只代理 `/api/gateway`，上游保持 `127.0.0.1:8787`。Nginx 覆盖 `X-Real-IP`、`X-Forwarded-For` 和协议字段；后端 `GATEWAY_TRUST_PROXY=1` 仅接受本机代理提供的真实 IP。80 除证书路径外保持 `403`，其他 HTTPS 路径保持 `404`；不要开放开发端口。

本次部署与验收范围见 `docs/CLOUD_GATEWAY_DEPLOYMENT_20260928.md`。设备端只验证隔离模拟器的岗位搜索与在线首题；正式签名、真机全流程、独立告警和多用户身份认证仍是后续事项。

官方依据：

- https://letsencrypt.org/2026/01/15/6day-and-ip-general-availability/
- https://eff-certbot.readthedocs.io/en/stable/using.html
