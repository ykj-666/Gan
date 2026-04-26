# MySQL 线上部署

## 1. 服务器安装 MySQL

在 Ubuntu 服务器执行：

```bash
chmod +x scripts/setup-mysql-ubuntu.sh
DB_NAME=gan \
DB_USER=gan_user \
DB_PASSWORD='你的强密码' \
bash scripts/setup-mysql-ubuntu.sh
```

执行完成后会输出可直接使用的 `DATABASE_URL`。

## 2. 配置服务器环境变量

服务器 `.env` 至少需要：

```env
APP_ID=gan-app
APP_SECRET=替换为强随机字符串
DATABASE_URL=mysql://gan_user:你的强密码@127.0.0.1:3306/gan
KIMI_API_KEY=
OWNER_UNION_ID=
```

## 3. 部署应用

直接执行：

```bash
node deploy.cjs
```

## 4. 初始化数据库

应用启动时会自动初始化表结构。若需手动执行：

```bash
DATABASE_URL=mysql://gan_user:你的强密码@127.0.0.1:3306/gan
node db/apply-migration.cjs
```

## 5. 迁移旧 SQLite 数据

```bash
DATABASE_URL=mysql://gan_user:你的强密码@127.0.0.1:3306/gan
SQLITE_SOURCE_URL=file:local.db
npm run db:import:sqlite
```

## 6. 验证

```bash
curl http://127.0.0.1:3000/api/trpc/ping
```
