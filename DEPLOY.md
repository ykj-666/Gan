# Gan 项目部署指南

## 一键部署

在项目根目录执行：

```bash
node deploy.cjs
```

或使用图形界面：

```bash
node deploy-server.cjs
```

首次运行会自动：
1. 检查 Node.js 版本（需要 v20+）
2. 检查是否有未提交的 Git 更改
3. 安装部署依赖（`ssh2`，约需 30 秒）
4. 生成 SSH 密钥对（本地）
5. 复制公钥到服务器（需要输入一次 ubuntu 密码）
6. 打包项目代码
7. 上传到服务器
8. 在服务器上安装 Node.js、PM2（如缺失）
9. 安装依赖并构建
10. 执行数据库迁移
11. 启动服务并健康检查

## 后续更新部署

代码修改后，再次执行：

```bash
node deploy.cjs
```

由于已经配置好免密登录，后续不再需要输入密码，真正实现一键部署。

## 服务器信息

- **IP**: 118.89.134.207
- **端口**: 3000
- **访问地址**: http://118.89.134.207:3000
- **部署目录**: /home/ubuntu/gan
- **当前版本软链接**: /home/ubuntu/gan/current

## 重要提示

### 1. 开放安全组端口

首次部署后，如果无法访问，请前往腾讯云控制台 → 安全组 → 入站规则，添加：

| 协议 | 端口 | 来源 | 策略 |
|------|------|------|------|
| TCP | 3000 | 0.0.0.0/0 | 允许 |

### 2. 数据库说明

- 使用 SQLite（本地文件 `local.db`）
- 每次更新时会自动备份和恢复数据库，数据不会丢失
- 备份路径：部署前会备份到 `/tmp/gan-local.db.bak`
- 历史版本保留在 `/home/ubuntu/gan/releases/` 目录

### 3. 进程管理

服务器上使用 PM2 管理 Node 进程：

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs gan-app

# 重启
pm2 restart gan-app

# 停止
pm2 stop gan-app
```

### 4. 配置域名（可选）

有域名后，可在宝塔面板中：
1. 添加站点 → 填写域名
2. 设置 → 反向代理 → 目标 URL: `http://127.0.0.1:3000`
3. 申请 SSL 证书（可选）

### 5. 环境变量

首次部署后，服务器会生成默认 `.env` 文件。如需修改敏感配置，请 SSH 登录服务器后编辑：

```bash
ssh ubuntu@118.89.134.207
nano /home/ubuntu/gan/current/.env
pm2 restart gan-app
```

### 6. 默认账号

部署后首次访问，使用默认管理员账号登录：

- 用户名：`admin`
- 密码：`admin123`

登录后建议立即修改密码。

## Docker 部署（可选）

```bash
# 构建镜像
docker build -t gan-app .

# 运行容器（带代理）
docker build -t gan-app --build-arg HTTP_PROXY=http://proxy:port .

# 运行
docker run -d -p 3000:3000 -v $(pwd)/local.db:/app/local.db gan-app
```
