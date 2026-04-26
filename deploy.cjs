/**
 * Gan 项目一键部署工具
 */

const fs = require("fs");
const path = require("path");
const { execSync, spawn } = require("child_process");
const readline = require("readline");
const os = require("os");

const SERVER_IP = "118.89.134.207";
const REMOTE_DIR = "/home/ubuntu/gan";
const PORT = "3000";
const PROJECT_ROOT = __dirname;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(q) {
  return new Promise((resolve) => rl.question(q, resolve));
}

function ensureSSH2() {
  try {
    require("ssh2");
    return true;
  } catch {
    console.log("[首次使用] 正在安装部署依赖（约需 30 秒）...");
    try {
      const deployDir = path.join(PROJECT_ROOT, "deploy-tool");
      if (!fs.existsSync(path.join(deployDir, "node_modules"))) {
        execSync("npm install", { cwd: deployDir, stdio: "inherit" });
      }
      module.paths.unshift(path.join(deployDir, "node_modules"));
      require("ssh2");
      console.log("[OK] 依赖安装完成");
      return true;
    } catch (err) {
      console.log("[错误] 依赖安装失败: " + err.message);
      return false;
    }
  }
}

function ensureSSHKey() {
  const sshDir = path.join(os.homedir(), ".ssh");
  const keyPath = path.join(sshDir, "id_ed25519");
  if (fs.existsSync(keyPath)) {
    console.log("[OK] SSH 密钥已存在");
    return keyPath;
  }
  console.log("[首次] 正在生成 SSH 密钥...");
  if (!fs.existsSync(sshDir)) fs.mkdirSync(sshDir, { mode: 0o700 });
  try {
    execSync(`ssh-keygen -t ed25519 -C "gan-deploy" -f "${keyPath}" -N ""`, { stdio: "ignore" });
    console.log("[OK] SSH 密钥生成完成");
    return keyPath;
  } catch (err) {
    console.log("[错误] 生成密钥失败: " + err.message);
    return null;
  }
}

async function testSSH(keyPath) {
  const { Client } = require("ssh2");
  return new Promise((resolve) => {
    const conn = new Client();
    conn.on("ready", () => { conn.end(); resolve(true); })
        .on("error", (err) => { console.log("[调试] SSH 测试失败: " + err.message); resolve(false); })
        .connect({ host: SERVER_IP, username: "ubuntu", privateKey: fs.readFileSync(keyPath), readyTimeout: 15000 });
  });
}

async function setupSSH(keyPath) {
  console.log("\n[首次部署] 需要配置免密登录");
  console.log("您的 ubuntu 密码只用于这一次，不会被保存\n");
  const password = await ask("请输入服务器 ubuntu 密码: ");
  console.log("[进行中] 正在复制公钥到服务器...");

  const { Client } = require("ssh2");
  const pubkey = fs.readFileSync(`${keyPath}.pub`, "utf-8").trim();

  const sshTask = new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on("ready", () => {
      console.log("[调试] SSH 连接成功，正在执行远程命令...");
      conn.exec(
        `mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '${pubkey}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`,
        (err, stream) => {
          if (err) { conn.end(); reject(err); return; }
          stream.on("close", (code, signal) => {
            console.log(`[调试] 远程命令结束，退出码: ${code}, signal: ${signal}`);
            conn.end();
            resolve();
          });
          stream.on("data", (data) => {
            console.log("[远程输出] " + data.toString().trim());
          });
          stream.stderr.on("data", (data) => {
            console.log("[远程错误] " + data.toString().trim());
          });
        }
      );
    }).on("error", (err) => {
      console.log("[调试] SSH 连接错误: " + err.message);
      reject(err);
    }).on("end", () => {
      console.log("[调试] SSH 连接已关闭");
    }).connect({ host: SERVER_IP, username: "ubuntu", password, readyTimeout: 30000 });
  });

  const timeoutTask = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("SSH 操作超时 (30秒)，请检查网络或手动配置免密登录")), 30000);
  });

  try {
    await Promise.race([sshTask, timeoutTask]);
  } catch (err) {
    console.log("[错误] " + err.message);
    return false;
  }

  console.log("[调试] 等待 2 秒后测试免密登录...");
  await new Promise(r => setTimeout(r, 2000));

  if (await testSSH(keyPath)) {
    console.log("[OK] 免密登录配置成功");
    return true;
  } else {
    console.log("[错误] 免密登录测试失败");
    console.log("请手动运行: type %USERPROFILE%\\.ssh\\id_ed25519.pub | ssh ubuntu@" + SERVER_IP + " \"mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys\"");
    return false;
  }
}

async function packProject() {
  const tarFile = path.join(os.tmpdir(), "gan-deploy.tar.gz");
  console.log("[进行中] 正在打包项目...");
  try {
    execSync(
      `tar -czf "${tarFile}" --exclude=node_modules --exclude=.git --exclude=local.db --exclude=dist --exclude=.env --exclude="*.log" --exclude=deploy-tool -C "${PROJECT_ROOT}" .`,
      { stdio: "ignore" }
    );
    const size = (fs.statSync(tarFile).size / 1024 / 1024).toFixed(2);
    console.log(`[OK] 打包完成 (${size} MB)`);
    return tarFile;
  } catch (err) {
    console.log("[错误] 打包失败: " + err.message);
    return null;
  }
}

async function upload(keyPath, tarFile) {
  console.log("[进行中] 正在上传到服务器...");
  const { Client } = require("ssh2");
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on("ready", () => {
      conn.sftp((err, sftp) => {
        if (err) { conn.end(); reject(err); return; }
        sftp.fastPut(tarFile, "/tmp/gan-deploy.tar.gz", (err) => {
          conn.end();
          if (err) reject(err);
          else { console.log("[OK] 上传完成"); resolve(); }
        });
      });
    }).on("error", reject).connect({ host: SERVER_IP, username: "ubuntu", privateKey: fs.readFileSync(keyPath) });
  });
}

async function remoteDeploy(keyPath) {
  console.log("[进行中] 正在服务器上部署...\n");
  const { Client } = require("ssh2");
  const script = `set -e

echo "[a] 检查 Node.js..."
if ! command -v node &> /dev/null; then
  echo "Node.js 未安装，尝试自动安装..."
  if sudo -n true 2>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
    sudo apt-get install -y nodejs
  else
    echo "错误: 没有 sudo 权限，无法自动安装 Node.js"
    echo "解决方法: 通过宝塔面板安装 Node.js，或联系管理员"
    exit 1
  fi
fi
node -v

echo "[b] 检查 PM2..."
export PATH="$HOME/.npm-global/bin:$PATH"
PM2_BIN="$(command -v pm2 || true)"
if [ -z "$PM2_BIN" ]; then
  echo "PM2 未安装，正在安装到用户目录..."
  mkdir -p ~/.npm-global
  npm config set prefix '~/.npm-global'
  npm install -g pm2
  PM2_BIN="$HOME/.npm-global/bin/pm2"
fi
if [ ! -x "$PM2_BIN" ]; then
  echo "错误: PM2 安装失败或不可执行"
  exit 1
fi

echo "[c] 解压代码..."
mkdir -p ${REMOTE_DIR}
cd ${REMOTE_DIR}
if [ -f local.db ]; then cp local.db /tmp/gan-local.db.bak; fi
tar -xzf /tmp/gan-deploy.tar.gz -C ${REMOTE_DIR}
if [ -f /tmp/gan-local.db.bak ]; then mv /tmp/gan-local.db.bak ${REMOTE_DIR}/local.db; fi

echo "[d] 安装依赖并构建..."
cd ${REMOTE_DIR}
npm install
npm run build

echo "[d2] 初始化数据库..."
node db/apply-migration.cjs

echo "[e] 启动服务..."
"$PM2_BIN" delete gan-app 2>/dev/null || true
NODE_ENV=production PORT=${PORT} "$PM2_BIN" start dist/boot.js --name gan-app --cwd ${REMOTE_DIR} --update-env
"$PM2_BIN" save

echo "[e2] 配置开机自恢复..."
PM2_CRON="@reboot PATH=$HOME/.npm-global/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin $PM2_BIN resurrect >/tmp/gan-pm2-resurrect.log 2>&1"
(crontab -l 2>/dev/null | grep -Fv "$PM2_BIN resurrect" ; echo "$PM2_CRON") | crontab -

sleep 3
echo "[验证] 检查端口是否监听..."
if ss -tlnp | grep -q ":${PORT}"; then
  echo "[OK] 端口 ${PORT} 已正常监听"
else
  echo "[警告] 端口 ${PORT} 未监听，可能启动失败"
  echo "[诊断] PM2 日志如下:"
  "$PM2_BIN" logs gan-app --lines 20 --nostream 2>/dev/null || true
fi

echo ""
echo "========================================"
echo "  部署完成!"
echo "  访问: http://${SERVER_IP}:${PORT}"
echo "========================================"
`;
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on("ready", () => {
      conn.exec(script, (err, stream) => {
        if (err) { conn.end(); reject(err); return; }
        stream.on("close", (code) => { conn.end(); code === 0 ? resolve() : reject(new Error("退出码 " + code)); })
              .on("data", (d) => process.stdout.write(d))
              .stderr.on("data", (d) => process.stdout.write(d));
      });
    }).on("error", reject).connect({ host: SERVER_IP, username: "ubuntu", privateKey: fs.readFileSync(keyPath), readyTimeout: 20000 });
  });
}

async function menuDeploy() {
  console.log("\n========== 一键部署到服务器 ==========\n");
  if (!ensureSSH2()) { await ask("按回车返回菜单..."); return; }
  const keyPath = ensureSSHKey();
  if (!keyPath) { await ask("按回车返回菜单..."); return; }

  console.log("[1/5] 检查服务器连接...");
  if (!(await testSSH(keyPath))) {
    if (!(await setupSSH(keyPath))) { await ask("按回车返回菜单..."); return; }
  } else {
    console.log("[OK] 服务器连接正常");
  }

  console.log("[2/5] 打包项目代码...");
  const tarFile = await packProject();
  if (!tarFile) { await ask("按回车返回菜单..."); return; }

  console.log("[3/5] 上传到服务器...");
  try { await upload(keyPath, tarFile); } catch (err) { console.log("[错误] 上传失败: " + err.message); await ask("按回车返回菜单..."); return; }

  console.log("[4/5] 在服务器上部署...");
  try { await remoteDeploy(keyPath); } catch (err) { console.log("[错误] 部署失败: " + err.message); await ask("按回车返回菜单..."); return; }

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
  console.log("本地地址: http://localhost:3000");
  console.log("账号: admin / 密码: admin123\n");
  console.log("关闭此窗口即可停止服务器\n");
  const child = spawn("npm", ["run", "dev"], { cwd: PROJECT_ROOT, shell: true, stdio: "inherit" });
  await new Promise((resolve) => child.on("close", resolve));
}

async function menuStatus() {
  console.log("\n========== 查看服务器状态 ==========\n");
  const keyPath = path.join(os.homedir(), ".ssh", "id_ed25519");
  if (!fs.existsSync(keyPath)) {
    console.log("[错误] 未配置 SSH，请先执行部署");
    await ask("按回车返回菜单...");
    return;
  }
  console.log("[进行中] 正在连接服务器...\n");
  try {
    const output = execSync(
      `ssh -o BatchMode=yes -o ConnectTimeout=5 -i "${keyPath}" ubuntu@${SERVER_IP} "bash -lc 'PM2_BIN=\\$(command -v pm2 || true); if [ -x \\\"\\$HOME/.npm-global/bin/pm2\\\" ]; then PM2_BIN=\\\"\\$HOME/.npm-global/bin/pm2\\\"; fi; if [ -n \\\"\\$PM2_BIN\\\" ]; then \\\"\\$PM2_BIN\\\" status gan-app 2>/dev/null; else echo 服务未运行; fi'"`,
      { encoding: "utf-8", timeout: 10000 }
    );
    console.log(output.trim());
  } catch (err) {
    console.log("[错误] 连接失败: " + err.message);
  }
  await ask("\n按回车返回菜单...");
}

async function menuHelp() {
  console.log("\n========== 部署说明 ==========\n");
  console.log("首次部署: 选择 [1]，输入 ubuntu 密码，等待自动完成");
  console.log("更新代码: 修改后再次选择 [1]，无需输入密码");
  console.log("本地测试: 选择 [2]，在本地浏览器测试功能");
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
    console.log("  [4] 查看部署说明");
    console.log("  [5] 退出\n");
    console.log("========================================");
    const choice = (await ask("\n请输入数字（1-5）然后按回车: ")).trim();

    switch (choice) {
      case "1": await menuDeploy(); break;
      case "2": await menuLocalDev(); break;
      case "3": await menuStatus(); break;
      case "4": await menuHelp(); break;
      case "5":
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
