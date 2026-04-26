/**
 * Gan 项目部署 Web 界面服务器
 * 用法: node deploy-server.cjs
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");
const os = require("os");

const PORT = 3456;
const PROJECT_ROOT = __dirname;
const SERVER_IP = "118.89.134.207";
const REMOTE_DIR = "/home/ubuntu/gan";
const SERVICE_PORT = "3000";

// 确保 ssh2 可用
function ensureSSH2() {
  try {
    require("ssh2");
    return true;
  } catch {
    console.log("[首次使用] 正在安装部署依赖...");
    try {
      const deployDir = path.join(PROJECT_ROOT, "deploy-tool");
      if (!fs.existsSync(path.join(deployDir, "node_modules"))) {
        execSync("npm install", { cwd: deployDir, stdio: "inherit" });
      }
      module.paths.unshift(path.join(deployDir, "node_modules"));
      require("ssh2");
      return true;
    } catch (err) {
      console.error("[错误] 安装依赖失败:", err.message);
      return false;
    }
  }
}

function ensureSSHKey() {
  const sshDir = path.join(os.homedir(), ".ssh");
  const keyPath = path.join(sshDir, "id_ed25519");
  if (fs.existsSync(keyPath)) return keyPath;
  if (!fs.existsSync(sshDir)) fs.mkdirSync(sshDir, { mode: 0o700 });
  execSync(`ssh-keygen -t ed25519 -C "gan-deploy" -f "${keyPath}" -N ""`, { stdio: "ignore" });
  return keyPath;
}

async function testSSH(keyPath) {
  const { Client } = require("ssh2");
  return new Promise((resolve) => {
    const conn = new Client();
    conn.on("ready", () => { conn.end(); resolve(true); })
        .on("error", () => resolve(false))
        .connect({ host: SERVER_IP, username: "ubuntu", privateKey: fs.readFileSync(keyPath), readyTimeout: 5000 });
  });
}

async function setupSSH(keyPath) {
  // 这里返回 false，让前端提示用户输入密码
  return false;
}

// 打包
function packProject() {
  const tarFile = path.join(os.tmpdir(), "gan-deploy.tar.gz");
  execSync(
    `tar -czf "${tarFile}" --exclude=node_modules --exclude=.git --exclude=local.db --exclude=dist --exclude=.env --exclude="*.log" --exclude=deploy-tool -C "${PROJECT_ROOT}" .`,
    { stdio: "ignore" }
  );
  return tarFile;
}

// 上传 + 部署（带 SSE 输出）
async function runDeploy(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  const write = (text) => res.write(text);

  try {
    if (!ensureSSH2()) { write("[错误] 依赖安装失败\n"); res.end(); return; }

    write("[1/6] 检查 SSH 密钥...\n");
    const keyPath = ensureSSHKey();

    write("[2/6] 测试服务器连接...\n");
    const connected = await testSSH(keyPath);
    if (!connected) {
      write("[错误] 无法免密登录服务器\n");
      write("解决方法：打开 CMD，运行以下命令（需要输入一次密码）：\n");
      write(`ssh-copy-id -i "${keyPath}.pub" ubuntu@${SERVER_IP}\n`);
      write("如果 ssh-copy-id 不存在，运行：\n");
      write(`type "%USERPROFILE%\\.ssh\\id_ed25519.pub" | ssh ubuntu@${SERVER_IP} "cat >> ~/.ssh/authorized_keys"\n`);
      res.end();
      return;
    }

    write("[3/6] 打包项目...\n");
    const tarFile = packProject();
    const size = (fs.statSync(tarFile).size / 1024 / 1024).toFixed(2);
    write(`[OK] 打包完成 (${size} MB)\n`);

    write("[4/6] 上传到服务器...\n");
    const { Client } = require("ssh2");
    await new Promise((resolve, reject) => {
      const conn = new Client();
      conn.on("ready", () => {
        conn.sftp((err, sftp) => {
          if (err) { conn.end(); reject(err); return; }
          sftp.fastPut(tarFile, "/tmp/gan-deploy.tar.gz", (err) => {
            conn.end();
            if (err) reject(err);
            else { write("[OK] 上传完成\n"); resolve(); }
          });
        });
      }).on("error", reject).connect({ host: SERVER_IP, username: "ubuntu", privateKey: fs.readFileSync(keyPath) });
    });

    write("[5/6] 在服务器上执行部署...\n");
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
NODE_ENV=production PORT=${SERVICE_PORT} "$PM2_BIN" start dist/boot.js --name gan-app --cwd ${REMOTE_DIR} --update-env
"$PM2_BIN" save

echo "[e2] 配置开机自恢复..."
PM2_CRON="@reboot PATH=$HOME/.npm-global/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin $PM2_BIN resurrect >/tmp/gan-pm2-resurrect.log 2>&1"
(crontab -l 2>/dev/null | grep -Fv "$PM2_BIN resurrect" ; echo "$PM2_CRON") | crontab -

echo ""
echo "========================================"
echo "  部署完成!"
echo "  访问: http://${SERVER_IP}:${SERVICE_PORT}"
echo "========================================"
`;
    await new Promise((resolve, reject) => {
      const conn = new Client();
      conn.on("ready", () => {
        conn.exec(script, (err, stream) => {
          if (err) { conn.end(); reject(err); return; }
          stream.on("close", (code) => { conn.end(); code === 0 ? resolve() : reject(new Error("退出码 " + code)); })
                .on("data", (d) => write(d.toString()))
                .stderr.on("data", (d) => write(d.toString()));
        });
      }).on("error", reject).connect({ host: SERVER_IP, username: "ubuntu", privateKey: fs.readFileSync(keyPath), readyTimeout: 20000 });
    });

    write("\n[6/6] 部署成功！\n");
    write(`访问地址: http://${SERVER_IP}:${SERVICE_PORT}\n`);
  } catch (err) {
    write("\n[错误] " + err.message + "\n");
  }
  res.end();
}

// 启动本地开发服务器
async function runLocalDev() {
  const child = spawn("npm", ["run", "dev"], { cwd: PROJECT_ROOT, shell: true, detached: true, stdio: "ignore" });
  child.unref();
  return { ok: true };
}

// HTTP 服务器
const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.url === "/" || req.url === "/index.html") {
    const html = fs.readFileSync(path.join(PROJECT_ROOT, "deploy-ui.html"), "utf-8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  if (req.url === "/api/deploy") {
    await runDeploy(res);
    return;
  }

  if (req.url === "/api/local-dev") {
    const result = await runLocalDev();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n========================================`);
  console.log(`  Gan 项目部署工具已启动`);
  console.log(`  请在浏览器中打开:`);
  console.log(`  ${url}`);
  console.log(`========================================\n`);

  // 自动打开浏览器
  const platform = process.platform;
  try {
    if (platform === "win32") {
      execSync(`start ${url}`, { stdio: "ignore" });
    } else if (platform === "darwin") {
      execSync(`open ${url}`, { stdio: "ignore" });
    } else {
      execSync(`xdg-open ${url}`, { stdio: "ignore" });
    }
  } catch {
    console.log("请手动在浏览器中打开上述地址");
  }
});
