/**
 * Gan 项目一键部署脚本
 * 只负责线上部署，不再包含本地开发、GitHub 同步、网页界面等功能。
 */

const path = require("path");
const readline = require("readline");

const PROJECT_ROOT = __dirname;

const {
  SERVER_IP,
  PORT,
  REMOTE_DIR,
  ensureSSH2,
  ensureSSHKey,
  testSSH,
  setupSSH,
  checkNodeVersion,
  packProject,
  upload,
  remoteDeploy,
} = require("./deploy-lib.cjs");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function ensureServerAccess(keyPath) {
  process.stdout.write("[1/4] 检查服务器连接...\n");

  if (await testSSH(keyPath)) {
    process.stdout.write("[OK] SSH 连接正常\n");
    return;
  }

  process.stdout.write("首次部署需要配置免密登录。\n");
  process.stdout.write("下面输入的是服务器 ubuntu 账号密码，仅用于本次复制公钥。\n");
  const password = await ask("请输入服务器 ubuntu 密码: ");

  process.stdout.write("正在配置免密登录...\n");
  const ok = await setupSSH(keyPath, password);
  if (!ok) {
    throw new Error(
      `免密登录配置失败。可手动执行: type %USERPROFILE%\\.ssh\\id_ed25519.pub | ssh ubuntu@${SERVER_IP} "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"`
    );
  }

  process.stdout.write("[OK] 免密登录配置完成\n");
}

async function main() {
  process.stdout.write("========================================\n");
  process.stdout.write(" Gan 项目线上部署\n");
  process.stdout.write(` 服务器: ${SERVER_IP}\n`);
  process.stdout.write(` 目录: ${REMOTE_DIR}\n`);
  process.stdout.write("========================================\n\n");

  const nodeCheck = checkNodeVersion(20);
  if (!nodeCheck.ok) {
    throw new Error(nodeCheck.message);
  }
  process.stdout.write(`[OK] ${nodeCheck.message}\n`);

  if (!ensureSSH2(PROJECT_ROOT)) {
    throw new Error("部署依赖安装失败");
  }

  const keyPath = ensureSSHKey();
  if (!keyPath) {
    throw new Error("SSH 密钥准备失败");
  }

  await ensureServerAccess(keyPath);

  process.stdout.write("[2/4] 打包项目...\n");
  const { tarFile, size } = packProject(PROJECT_ROOT);
  process.stdout.write(`[OK] 打包完成 (${size} MB)\n`);
  process.stdout.write(`包文件: ${path.basename(tarFile)}\n`);

  process.stdout.write("[3/4] 上传到服务器...\n");
  await upload(keyPath, tarFile);
  process.stdout.write("[OK] 上传完成\n");

  process.stdout.write("[4/4] 执行远程部署...\n\n");
  await remoteDeploy(keyPath, (text) => process.stdout.write(text), {
    projectRoot: PROJECT_ROOT,
    remoteDir: REMOTE_DIR,
    port: PORT,
    generateEnv: true,
  });

  process.stdout.write("\n========================================\n");
  process.stdout.write(" 部署完成\n");
  process.stdout.write(` 访问地址: http://${SERVER_IP}:${PORT}\n`);
  process.stdout.write(" 默认账号: admin\n");
  process.stdout.write(" 默认密码: admin123\n");
  process.stdout.write("========================================\n");
}

main()
  .catch((error) => {
    process.stderr.write(`\n[错误] ${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => {
    rl.close();
  });
