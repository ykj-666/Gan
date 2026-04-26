# 腾讯云上线清单

适用场景：

- Ubuntu 云服务器
- 应用和 MySQL 部署在同一台机器
- 通过 `node deploy.cjs` 发布

## 1. 服务器基础准备

```bash
ssh ubuntu@你的服务器IP
sudo apt-get update
sudo apt-get upgrade -y
```

确认 Node.js 版本不低于 20：

```bash
node -v
```

如果没有安装：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs
```

## 2. 安全组

至少放行：

- `22/TCP`
- `3000/TCP`

## 3. 安装 MySQL

```bash
chmod +x scripts/setup-mysql-ubuntu.sh
DB_NAME=gan \
DB_USER=gan_user \
DB_PASSWORD='替换成强密码' \
bash scripts/setup-mysql-ubuntu.sh
```

## 4. 准备环境变量

```env
APP_ID=gan-app
APP_SECRET=替换成至少32位随机字符串
DATABASE_URL=mysql://gan_user:替换成强密码@127.0.0.1:3306/gan
KIMI_API_KEY=
OWNER_UNION_ID=
NODE_ENV=production
PORT=3000
```

## 5. 部署应用

在本地项目目录执行：

```bash
node deploy.cjs
```

## 6. 验证服务

```bash
pm2 status gan-app
pm2 logs gan-app --lines 50
curl http://127.0.0.1:3000/api/trpc/ping
```
