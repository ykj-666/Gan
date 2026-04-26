# Gan

现场考勤 / 请假 / 出差 / 任务协同系统，前端基于 Vite + React，后端基于 Hono + tRPC，数据库已切换为 MySQL。

## 环境变量

参考下面的样板：

```env
APP_ID=gan-app
APP_SECRET=change-me-in-production
DATABASE_URL=mysql://user:password@127.0.0.1:3306/gan
KIMI_API_KEY=
OWNER_UNION_ID=
```

`DATABASE_URL` 现在必须是 MySQL 连接串，项目不再使用 `file:local.db` 作为运行数据库。

## 本地启动

```bash
npm install
npm run build
npm run start
```

开发模式：

```bash
npm install
npm run dev
```

服务启动时会自动：

- 确保 MySQL 数据库存在
- 执行 [db/mysql-init.sql](/f:/ding/Gan/db/mysql-init.sql:1) 初始化表结构
- 补默认管理员账号 `admin / admin123`（仅首次）

## 旧数据迁移

如果你之前的数据还在 SQLite / libSQL：

```bash
DATABASE_URL=mysql://user:password@127.0.0.1:3306/gan
SQLITE_SOURCE_URL=file:local.db
npm run db:import:sqlite
```

迁移脚本在 [db/migrate-sqlite-to-mysql.ts](/f:/ding/Gan/db/migrate-sqlite-to-mysql.ts:1)。

## 生产部署

部署脚本会要求服务器上的 `.env` 中提供真实的 MySQL 连接串，不会再自动创建 `local.db`。

首次部署建议顺序：

```bash
1. 在服务器安装并启动 MySQL
2. 配置 DATABASE_URL=mysql://...
3. 部署项目
4. 首次启动后检查默认管理员是否已创建
5. 如需迁移旧数据，再执行 db:import:sqlite
```

部署共享逻辑在 [deploy-lib.cjs](/f:/ding/Gan/deploy-lib.cjs:1)。

更完整的线上步骤见 [docs/mysql-online-deploy.md](/f:/ding/Gan/docs/mysql-online-deploy.md:1)、[docs/tencent-cloud-go-live.md](/f:/ding/Gan/docs/tencent-cloud-go-live.md:1) 和 [docs/tencent-cloud-security-group.md](/f:/ding/Gan/docs/tencent-cloud-security-group.md:1)。
