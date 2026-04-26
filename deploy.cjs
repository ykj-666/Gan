/**
 * Gan 项目一键部署工具 (CLI)
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const readline = require("readline");

const PROJECT_ROOT = __dirname;

const {
  SERVER_IP,
  PORT,
  GITHUB_REMOTE_URL,
  ensureSSH2,
  ensureSSHKey,
  testSSH,
  setupSSH,
  checkNodeVersion,
  checkGitStatus,
  checkLocalBuild,
  syncToGitHub,
  packProject,
  upload,
  remoteDeploy,
  getServerStatus,
} = require("./deploy-lib.cjs");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(q) {
  return new Promise((resolve) => rl.question(q, resolve));
}

async function menuDeploy() {
  console.log("\n========== 一键部署到服务器 ==========\n");

  // 1. 环境检查
  const nodeCheck = checkNodeVersion(20);
  if (!nodeCheck.ok) {
    console.log(`[错误] ${nodeCheck.message}`);
    await ask("按回车返回菜单...");
    return;
  }
  console.log(`[OK] ${nodeCheck.message}`);

  if (!ensureSSH2(PROJECT_ROOT)) {
    await ask("按回车返回菜单...");
    return;
  }

  const keyPath = ensureSSHKey();
  if (!keyPath) {
    await ask("按回车返回菜单...");
    return;
  }

  // 2. Git 检查
  const gitCheck = checkGitStatus(PROJECT_ROOT);
  if (!gitCheck.ok) {
    console.log(`[警告] ${gitCheck.message}`);
    const proceed = await ask("仍要部署吗？输入 y 继续: ");
    if (proceed.trim().toLowerCase() !== "y") {
      await ask("按回车返回菜单...");
      return;
    }
  } else {
    console.log(`[OK] ${gitCheck.message}`);
  }

  // 3. 可选：本地构建预检
  const buildCheckFirst = await ask("是否在本地先执行构建预检？(y/N): ");
  if (buildCheckFirst.trim().toLowerCase() === "y") {
    console.log("[进行中] 本地构建预检...");
    const buildResult = checkLocalBuild(PROJECT_ROOT);
    if (!buildResult.ok) {
      console.log(`[错误] ${buildResult.message}`);
      if (buildResult.details) console.log(buildResult.details);
      await ask("按回车返回菜单...");
      return;
    }
    console.log(`[OK] ${buildResult.message}`);
  }

  // 4. SSH 连接
  console.log("[1/5] 检查服务器连接...");
  if (!(await testSSH(keyPath))) {
    console.log("\n[首次部署] 需要配置免密登录");
    console.log("您的 ubuntu 密码只用于这一次，不会被保存\n");
    const password = await ask("请输入服务器 ubuntu 密码: ");
    console.log("[进行中] 正在复制公钥到服务器...");
    const ok = await setupSSH(keyPath, password);
    if (!ok) {
      console.log("[错误] 免密登录配置失败");
      console.log(
        `请手动运行: type %USERPROFILE%\\.ssh\\id_ed25519.pub | ssh ubuntu@${SERVER_IP} "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"`
      );
      await ask("按回车返回菜单...");
      return;
    }
    console.log("[OK] 免密登录配置成功");
  } else {
    console.log("[OK] 服务器连接正常");
  }

  // 5. 打包
  console.log("[2/5] 打包项目代码...");
  let tarFile, size;
  try {
    ({ tarFile, size } = packProject(PROJECT_ROOT));
    console.log(`[OK] 打包完成 (${size} MB)`);
  } catch (err) {
    console.log("[错误] 打包失败: " + err.message);
    await ask("按回车返回菜单...");
    return;
  }

  // 6. 上传
  console.log("[3/5] 上传到服务器...");
  try {
    await upload(keyPath, tarFile);
    console.log("[OK] 上传完成");
  } catch (err) {
    console.log("[错误] 上传失败: " + err.message);
    await ask("按回车返回菜单...");
    return;
  }

  // 7. 远程部署
  console.log("[4/5] 在服务器上部署...\n");
  try {
    await remoteDeploy(keyPath, (text) => process.stdout.write(text), {
      remoteDir: "/home/ubuntu/gan",
      port: PORT,
      generateEnv: true,
    });
  } catch (err) {
    console.log("\n[错误] 部署失败: " + err.message);
    await ask("按回车返回菜单...");
    return;
  }

  console.log("[5/5] 部署完成！");
  console.log("\n========================================");
  console.log("  部署成功！");
  console.log("  访问地址: http://" + SERVER_IP + ":" + PORT);
  console.log("  账号: admin");
  console.log("  密码: admin123");
  console.log("========================================");
  console.log("\n提示: 如果无法访问，请去腾讯云安全组开放 " + PORT + " 端口\n");
  await ask("按回车返回菜单...");
}

async function menuLocalDev() {
  console.log("\n========== 启动本地开发服务器 ==========\n");
  const nodeCheck = checkNodeVersion(20);
  if (!nodeCheck.ok) {
    console.log(`[错误] ${nodeCheck.message}`);
    await ask("按回车返回菜单...");
    return;
  }
  console.log(`[OK] ${nodeCheck.message}`);
  console.log("本地地址: http://localhost:3000");
  console.log("账号: admin / 密码: admin123\n");
  console.log("关闭此窗口即可停止服务器\n");
  const child = spawn("npm", ["run", "dev"], { cwd: PROJECT_ROOT, shell: true, stdio: "inherit" });
  await new Promise((resolve) => child.on("close", resolve));
}

async function menuStatus() {
  console.log("\n========== 查看服务器状态 ==========\n");
  const keyPath = path.join(require("os").homedir(), ".ssh", "id_ed25519");
  if (!fs.existsSync(keyPath)) {
    console.log("[错误] 未配置 SSH，请先执行部署");
    await ask("按回车返回菜单...");
    return;
  }
  console.log("[进行中] 正在连接服务器...\n");
  const result = getServerStatus(keyPath);
  if (result.ok) {
    console.log(result.output);
  } else {
    console.log("[错误] 连接失败: " + result.error);
  }
  await ask("\n按回车返回菜单...");
}

async function menuGitHubSync() {
  console.log("\n========== 同步到 GitHub ==========\n");
  try {
    const result = syncToGitHub(PROJECT_ROOT, (text) => process.stdout.write(text));
    console.log("\n========================================");
    console.log("  GitHub 同步成功！");
    console.log("  仓库: " + result.remoteUrl);
    console.log("  分支: " + result.branch);
    console.log("========================================");
  } catch (err) {
    console.log("\n[错误] GitHub 同步失败: " + err.message);
    console.log("提示: 请确认本机已登录 GitHub，或已配置可推送到该仓库的凭据");
  }
  await ask("\n按回车返回菜单...");
}

async function menuHelp() {
  console.log("\n========== 部署说明 ==========\n");
  console.log("首次部署: 选择 [1]，输入 ubuntu 密码，等待自动完成");
  console.log("更新代码: 修改后再次选择 [1]，无需输入密码");
  console.log("本地测试: 选择 [2]，在本地浏览器测试功能");
  console.log("GitHub 同步: 选择 [4]，自动提交当前改动并推送到 " + GITHUB_REMOTE_URL);
  console.log("\n重要提示:");
  console.log("  如果部署后无法访问，请去腾讯云控制台");
  console.log("  安全组 -> 入站规则 -> 添加 TCP " + PORT + " 端口");
  console.log("\n数据库:");
  console.log("  使用 SQLite，数据保存在服务器上");
  console.log("  每次更新时自动备份和恢复，不会丢失");
  await ask("\n按回车返回菜单...");
}

async function main() {
  while (true) {
    console.log("\n========================================");
    console.log("       Gan 项目一键部署工具");
    console.log("       服务器: " + SERVER_IP);
    console.log("========================================\n");
    console.log("  [1] 一键部署到服务器（首次或更新）");
    console.log("  [2] 启动本地开发服务器（本地测试）");
    console.log("  [3] 查看服务器运行状态");
    console.log("  [4] 一键同步到 GitHub");
    console.log("  [5] 查看部署说明");
    console.log("  [6] 退出\n");
    console.log("========================================");
    const choice = (await ask("\n请输入数字（1-6）然后按回车: ")).trim();

    switch (choice) {
      case "1":
        await menuDeploy();
        break;
      case "2":
        await menuLocalDev();
        break;
      case "3":
        await menuStatus();
        break;
      case "4":
        await menuGitHubSync();
        break;
      case "5":
        await menuHelp();
        break;
      case "6":
        console.log("\n再见！\n");
        rl.close();
        process.exit(0);
      default:
        console.log("\n无效的选择，请重新输入\n");
    }
  }
}

main().catch((err) => {
  console.log("\n发生错误: " + err.message);
  process.exit(1);
});
