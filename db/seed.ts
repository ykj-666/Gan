import { getDb } from "../api/queries/connection";
import { tasks, users, activities } from "./schema";

async function seed() {
  const db = getDb();

  // Clear existing data
  await db.delete(activities);
  await db.delete(tasks);
  await db.delete(users);

  // Seed users
  const userData = [
    {
      unionId: "user_001",
      name: "张明",
      email: "zhangming@example.com",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=zhang",
      role: "admin" as const,
    },
    {
      unionId: "user_002",
      name: "李雪",
      email: "lixue@example.com",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=lixue",
      role: "user" as const,
    },
    {
      unionId: "user_003",
      name: "王浩",
      email: "wanghao@example.com",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=wanghao",
      role: "user" as const,
    },
    {
      unionId: "user_004",
      name: "陈静",
      email: "chenjing@example.com",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=chenjing",
      role: "user" as const,
    },
    {
      unionId: "user_005",
      name: "赵强",
      email: "zhaoqiang@example.com",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=zhaoqiang",
      role: "user" as const,
    },
  ];

  const insertedUsers = [];
  for (const user of userData) {
    const result = await db.insert(users).values(user);
    insertedUsers.push({ id: Number(result[0].insertId), ...user });
  }

  console.log(`Seeded ${insertedUsers.length} users`);

  // Seed tasks
  const taskData = [
    {
      title: "重构前端路由系统",
      description: "将现有的 React Router v5 迁移到 v7，解决嵌套路由渲染问题",
      status: "in_progress" as const,
      priority: "high" as const,
      assigneeId: insertedUsers[0].id,
      creatorId: insertedUsers[0].id,
      dueDate: "2026-04-25",
      tag: "技术债",
    },
    {
      title: "设计新版登录页面",
      description: "基于新的品牌规范重新设计登录和注册流程的 UI",
      status: "done" as const,
      priority: "medium" as const,
      assigneeId: insertedUsers[1].id,
      creatorId: insertedUsers[0].id,
      dueDate: "2026-04-20",
      tag: "设计",
    },
    {
      title: "集成支付网关",
      description: "接入 Stripe 和支付宝支付，实现订阅功能",
      status: "todo" as const,
      priority: "urgent" as const,
      assigneeId: insertedUsers[2].id,
      creatorId: insertedUsers[0].id,
      dueDate: "2026-04-28",
      tag: "后端",
    },
    {
      title: "编写 API 文档",
      description: "使用 OpenAPI 3.0 规范为所有接口生成文档",
      status: "review" as const,
      priority: "medium" as const,
      assigneeId: insertedUsers[3].id,
      creatorId: insertedUsers[1].id,
      dueDate: "2026-04-23",
      tag: "文档",
    },
    {
      title: "性能优化：图片懒加载",
      description: "为产品列表页实现虚拟滚动和图片懒加载机制",
      status: "in_progress" as const,
      priority: "high" as const,
      assigneeId: insertedUsers[4].id,
      creatorId: insertedUsers[2].id,
      dueDate: "2026-04-26",
      tag: "性能",
    },
    {
      title: "用户反馈收集模块",
      description: "开发用户反馈提交和后台管理页面",
      status: "todo" as const,
      priority: "low" as const,
      assigneeId: insertedUsers[1].id,
      creatorId: insertedUsers[0].id,
      dueDate: "2026-05-01",
      tag: "功能",
    },
    {
      title: "数据库备份策略",
      description: "制定每日增量备份和每周全量备份的自动化方案",
      status: "todo" as const,
      priority: "high" as const,
      assigneeId: insertedUsers[2].id,
      creatorId: insertedUsers[3].id,
      dueDate: "2026-04-24",
      tag: "运维",
    },
    {
      title: "移动端适配测试",
      description: "完成 iOS 和 Android 主流设备的兼容性测试报告",
      status: "in_progress" as const,
      priority: "medium" as const,
      assigneeId: insertedUsers[3].id,
      creatorId: insertedUsers[4].id,
      dueDate: "2026-04-27",
      tag: "测试",
    },
    {
      title: "客户数据导入工具",
      description: "开发 CSV/Excel 批量导入客户的工具，支持数据验证",
      status: "review" as const,
      priority: "high" as const,
      assigneeId: insertedUsers[0].id,
      creatorId: insertedUsers[2].id,
      dueDate: "2026-04-22",
      tag: "工具",
    },
    {
      title: "通知系统升级",
      description: "支持邮件、短信、站内信三种通知渠道的可配置化",
      status: "done" as const,
      priority: "medium" as const,
      assigneeId: insertedUsers[4].id,
      creatorId: insertedUsers[1].id,
      dueDate: "2026-04-18",
      tag: "后端",
    },
    {
      title: "安全审计日志",
      description: "实现操作日志的记录和查询接口，满足合规要求",
      status: "in_progress" as const,
      priority: "urgent" as const,
      assigneeId: insertedUsers[2].id,
      creatorId: insertedUsers[0].id,
      dueDate: "2026-04-23",
      tag: "安全",
    },
    {
      title: "数据分析看板",
      description: "为运营团队构建数据可视化仪表盘，包含核心指标",
      status: "todo" as const,
      priority: "low" as const,
      assigneeId: insertedUsers[1].id,
      creatorId: insertedUsers[3].id,
      dueDate: "2026-05-05",
      tag: "数据",
    },
  ];

  const insertedTasks = [];
  for (const task of taskData) {
    const values = {
      ...task,
      dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
    };
    const result = await db.insert(tasks).values(values);
    insertedTasks.push({ id: Number(result[0].insertId), ...task });
  }

  console.log(`Seeded ${insertedTasks.length} tasks`);

  // Seed activities
  const activityData = [
    {
      type: "task_created" as const,
      description: "创建了任务 \"重构前端路由系统\"",
      userId: insertedUsers[0].id,
      taskId: insertedTasks[0].id,
    },
    {
      type: "task_completed" as const,
      description: "完成了任务 \"设计新版登录页面\"",
      userId: insertedUsers[1].id,
      taskId: insertedTasks[1].id,
    },
    {
      type: "task_created" as const,
      description: "创建了紧急任务 \"集成支付网关\"",
      userId: insertedUsers[0].id,
      taskId: insertedTasks[2].id,
    },
    {
      type: "status_changed" as const,
      description: "将任务 \"编写 API 文档\" 移至审核阶段",
      userId: insertedUsers[3].id,
      taskId: insertedTasks[3].id,
    },
    {
      type: "task_assigned" as const,
      description: "将任务 \"性能优化\" 分配给赵强",
      userId: insertedUsers[2].id,
      taskId: insertedTasks[4].id,
    },
  ];

  for (const activity of activityData) {
    await db.insert(activities).values(activity);
  }

  console.log(`Seeded ${activityData.length} activities`);
  console.log("Seed complete!");
}

seed().catch(console.error);
