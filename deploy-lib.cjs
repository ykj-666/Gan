/**
 * Gan 项目部署共享库
 * 被 deploy.cjs (CLI) 和 deploy-server.cjs (Web UI) 共用
 */

const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");
const os = require("os");
const http = require("http");

const SERVER_IP = "118.89.134.207";
const REMOTE_DIR = "/home/ubuntu/gan";
const PORT = "3000";
const GITHUB_REMOTE_NAME = "origin";
const GITHUB_REMOTE_URL = "https://github.com/ykj-666/Gan.git";

// ── SSH2 依赖管理 ──────────────────────────────────────────────

function ensureSSH2(projectRoot) {
  try {
    require("ssh2");
    return true;
  } catch {
    console.log("[首次使用] 正在安装部署依赖（约需 30 秒）...");
    try {
      const deployDir = path.join(projectRoot, "deploy-tool");
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

// ── SSH 密钥 ───────────────────────────────────────────────────

function ensureSSHKey() {
  const sshDir = path.join(os.homedir(), ".ssh");
  const keyPath = path.join(sshDir, "id_ed25519");
  if (fs.existsSync(keyPath)) {
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
    conn
      .on("ready", () => {
        conn.end();
        resolve(true);
      })
      .on("error", (err) => {
        resolve(false);
      })
      .connect({
        host: SERVER_IP,
        username: "ubuntu",
        privateKey: fs.readFileSync(keyPath),
        readyTimeout: 15000,
      });
  });
}

async function setupSSH(keyPath, password) {
  const { Client } = require("ssh2");
  const pubkey = fs.readFileSync(`${keyPath}.pub`, "utf-8").trim();

  const sshTask = new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => {
        conn.exec(
          `mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '${pubkey}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`,
          (err, stream) => {
            if (err) {
              conn.end();
              reject(err);
              return;
            }
            stream.on("close", () => {
              conn.end();
              resolve();
            });
          }
        );
      })
      .on("error", reject)
      .connect({
        host: SERVER_IP,
        username: "ubuntu",
        password,
        readyTimeout: 30000,
      });
  });

  const timeoutTask = new Promise((_, reject) => {
    setTimeout(
      () =>
        reject(new Error("SSH 操作超时 (30秒)，请检查网络或手动配置免密登录")),
      30000
    );
  });

  await Promise.race([sshTask, timeoutTask]);
  await new Promise((r) => setTimeout(r, 2000));
  return testSSH(keyPath);
}

// ── 本地预检 ───────────────────────────────────────────────────

function getNodeVersion() {
  try {
    const v = execSync("node --version", { encoding: "utf-8" }).trim();
    const major = parseInt(v.slice(1).split(".")[0], 10);
    return { raw: v, major };
  } catch {
    return null;
  }
}

function checkNodeVersion(minMajor = 20) {
  const ver = getNodeVersion();
  if (!ver) {
    return { ok: false, message: "未检测到 Node.js，请先安装" };
  }
  if (ver.major < minMajor) {
    return {
      ok: false,
      message: `Node.js 版本过低: ${ver.raw}，需要 >= v${minMajor}.0.0`,
    };
  }
  return { ok: true, message: `Node.js ${ver.raw}` };
}

function checkGitStatus(projectRoot) {
  try {
    const status = execSync("git status --porcelain", {
      cwd: projectRoot,
      encoding: "utf-8",
    }).trim();
    if (status) {
      return {
        ok: false,
        message: "检测到未提交的更改，建议先 git commit 再部署",
        details: status,
      };
    }
    return { ok: true, message: "工作区干净" };
  } catch {
    return { ok: true, message: "非 Git 仓库，跳过检查" };
  }
}

function checkLocalBuild(projectRoot) {
  try {
    execSync("npm run build", { cwd: projectRoot, stdio: "pipe", env: { ...process.env, CI: "true" } });
    return { ok: true, message: "本地构建成功" };
  } catch (err) {
    return {
      ok: false,
      message: "本地构建失败，请先修复后再部署",
      details: err.message,
    };
  }
}

function runGitCommand(projectRoot, args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: projectRoot,
    encoding: "utf-8",
    windowsHide: true,
  });

  const stdout = (result.stdout || "").trim();
  const stderr = (result.stderr || "").trim();
  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !options.allowFailure) {
    const message = stderr || stdout || `git ${args.join(" ")} failed with exit code ${result.status}`;
    const error = new Error(message);
    error.status = result.status;
    error.stdout = stdout;
    error.stderr = stderr;
    throw error;
  }

  return {
    ok: result.status === 0,
    status: result.status || 0,
    stdout,
    stderr,
  };
}

function ensureGitRepo(projectRoot) {
  const result = runGitCommand(projectRoot, ["rev-parse", "--is-inside-work-tree"], { allowFailure: true });
  return result.ok && result.stdout === "true";
}

function getGitBranch(projectRoot) {
  const result = runGitCommand(projectRoot, ["branch", "--show-current"], { allowFailure: true });
  return result.ok ? result.stdout.trim() : "";
}

function ensureGitHubRemote(projectRoot) {
  if (!ensureGitRepo(projectRoot)) {
    throw new Error("当前目录不是 Git 仓库，无法同步到 GitHub");
  }

  const remoteResult = runGitCommand(projectRoot, ["remote", "get-url", GITHUB_REMOTE_NAME], {
    allowFailure: true,
  });

  if (!remoteResult.ok) {
    runGitCommand(projectRoot, ["remote", "add", GITHUB_REMOTE_NAME, GITHUB_REMOTE_URL]);
    return {
      remoteName: GITHUB_REMOTE_NAME,
      remoteUrl: GITHUB_REMOTE_URL,
      changed: true,
      message: `已添加远程仓库 ${GITHUB_REMOTE_NAME}: ${GITHUB_REMOTE_URL}`,
    };
  }

  if (remoteResult.stdout !== GITHUB_REMOTE_URL) {
    runGitCommand(projectRoot, ["remote", "set-url", GITHUB_REMOTE_NAME, GITHUB_REMOTE_URL]);
    return {
      remoteName: GITHUB_REMOTE_NAME,
      remoteUrl: GITHUB_REMOTE_URL,
      changed: true,
      message: `已更新远程仓库 ${GITHUB_REMOTE_NAME}: ${GITHUB_REMOTE_URL}`,
    };
  }

  return {
    remoteName: GITHUB_REMOTE_NAME,
    remoteUrl: GITHUB_REMOTE_URL,
    changed: false,
    message: `远程仓库已就绪: ${GITHUB_REMOTE_NAME}: ${GITHUB_REMOTE_URL}`,
  };
}

function buildSyncCommitMessage() {
  const stamp = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
  return `chore: sync to github ${stamp}`;
}

function syncToGitHub(projectRoot, write = console.log) {
  if (!ensureGitRepo(projectRoot)) {
    throw new Error("当前目录不是 Git 仓库，无法同步到 GitHub");
  }

  write("[1/4] 检查 GitHub 远程仓库...\n");
  const remoteInfo = ensureGitHubRemote(projectRoot);
  write(`[OK] ${remoteInfo.message}\n`);

  const branch = getGitBranch(projectRoot);
  if (!branch) {
    throw new Error("当前不在任何分支上，请先切回 main 后再同步");
  }

  write(`[2/4] 准备同步分支 ${branch}...\n`);
  const statusResult = runGitCommand(projectRoot, ["status", "--porcelain"]);
  let commitMessage = null;

  if (statusResult.stdout) {
    write("[提示] 检测到未提交改动，正在自动提交...\n");
    runGitCommand(projectRoot, ["add", "-A"]);
    commitMessage = buildSyncCommitMessage();
    const commitResult = runGitCommand(projectRoot, ["commit", "-m", commitMessage], {
      allowFailure: true,
    });

    if (!commitResult.ok) {
      const details = commitResult.stderr || commitResult.stdout;
      throw new Error(`自动提交失败: ${details || "请检查 git 用户信息和提交状态"}`);
    }

    write(`[OK] 已创建提交: ${commitMessage}\n`);
  } else {
    write("[OK] 工作区没有新的本地改动\n");
  }

  write("[3/4] 推送到 GitHub...\n");
  const pushResult = runGitCommand(projectRoot, ["push", "-u", GITHUB_REMOTE_NAME, branch], {
    allowFailure: true,
  });

  if (!pushResult.ok) {
    const details = pushResult.stderr || pushResult.stdout;
    throw new Error(`推送失败: ${details || "请检查 GitHub 登录状态或远程分支冲突"}`);
  }

  if (pushResult.stdout) write(pushResult.stdout + "\n");
  if (pushResult.stderr) write(pushResult.stderr + "\n");
  write(`[4/4] GitHub 同步完成: ${GITHUB_REMOTE_URL}\n`);

  return {
    branch,
    remoteName: GITHUB_REMOTE_NAME,
    remoteUrl: GITHUB_REMOTE_URL,
    commitMessage,
  };
}

// ── 打包 ───────────────────────────────────────────────────────

function packProject(projectRoot) {
  const tarFile = path.join(os.tmpdir(), "gan-deploy.tar.gz");
  const excludes = [
    "node_modules",
    ".git",
    "local.db",
    "dist",
    ".env",
    "*.log",
    "deploy-tool",
    "backups",
  ];
  const excludeArgs = excludes.map((e) => `--exclude=${e}`).join(" ");
  execSync(`tar -czf "${tarFile}" ${excludeArgs} -C "${projectRoot}" .`, {
    stdio: "ignore",
  });
  const size = (fs.statSync(tarFile).size / 1024 / 1024).toFixed(2);
  return { tarFile, size };
}

// ── 上传 ───────────────────────────────────────────────────────

async function upload(keyPath, tarFile, remotePath = "/tmp/gan-deploy.tar.gz") {
  const { Client } = require("ssh2");
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => {
        conn.sftp((err, sftp) => {
          if (err) {
            conn.end();
            reject(err);
            return;
          }
          sftp.fastPut(tarFile, remotePath, (err) => {
            conn.end();
            if (err) reject(err);
            else resolve();
          });
        });
      })
      .on("error", reject)
      .connect({
        host: SERVER_IP,
        username: "ubuntu",
        privateKey: fs.readFileSync(keyPath),
      });
  });
}

// ── 远程部署脚本 ───────────────────────────────────────────────

function buildRemoteScript(options) {
  const { remoteDir, port, generateEnv } = options;

  return `set -e

REMOTE_DIR="${remoteDir}"
PORT="${port}"

echo "[a] 检查 Node.js..."
if ! command -v node &> /dev/null; then
  echo "Node.js 未安装，尝试自动安装..."
  if sudo -n true 2>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
    sudo apt-get install -y nodejs
  else
    echo "错误: 没有 sudo 权限，无法自动安装 Node.js"
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

echo "[c] 备份并解压代码..."
mkdir -p "${REMOTE_DIR}"
RELEASE_DIR="${REMOTE_DIR}/releases/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RELEASE_DIR"
if [ -f "${REMOTE_DIR}/local.db" ]; then
  cp "${REMOTE_DIR}/local.db" /tmp/gan-local.db.bak
fi
if [ -f "${REMOTE_DIR}/.env" ]; then
  cp "${REMOTE_DIR}/.env" /tmp/gan-dotenv.bak
fi
tar -xzf /tmp/gan-deploy.tar.gz -C "$RELEASE_DIR"
# 迁移旧数据
if [ -f /tmp/gan-local.db.bak ]; then
  mv /tmp/gan-local.db.bak "$RELEASE_DIR/local.db"
fi
if [ -f /tmp/gan-dotenv.bak ]; then
  mv /tmp/gan-dotenv.bak "$RELEASE_DIR/.env"
fi
# 原子替换 current 软链接
ln -sfn "$RELEASE_DIR" "${REMOTE_DIR}/current"

echo "[d] 安装依赖并构建..."
cd "$RELEASE_DIR"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi
npm run build

echo "[d2] 初始化数据库..."
node db/apply-migration.cjs

${generateEnv ? `echo "[d3] 检查环境变量..."
if [ ! -f "${REMOTE_DIR}/current/.env" ]; then
  cat > "${REMOTE_DIR}/current/.env" << 'ENVEOF'
APP_ID=gan-app
APP_SECRET=change-me-in-production
KIMI_API_KEY=
OWNER_UNION_ID=
ENVEOF
  echo "已生成默认 .env，请登录服务器修改敏感配置"
fi
` : ""}

echo "[e] 启动服务..."
"$PM2_BIN" delete gan-app 2>/dev/null || true
NODE_ENV=production PORT=${PORT} "$PM2_BIN" start "${REMOTE_DIR}/current/dist/boot.js" --name gan-app --cwd "${REMOTE_DIR}/current" --update-env
"$PM2_BIN" save

echo "[e2] 配置开机自恢复..."
PM2_CRON="@reboot PATH=$HOME/.npm-global/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin $PM2_BIN resurrect >/tmp/gan-pm2-resurrect.log 2>&1"
(crontab -l 2>/dev/null | grep -Fv "$PM2_BIN resurrect" ; echo "$PM2_CRON") | crontab -

echo "[f] 等待服务启动..."
sleep 5

echo "[g] 健康检查..."
for i in 1 2 3; do
  if curl -sf http://127.0.0.1:${PORT}/api/trpc/health.check 2>/dev/null || curl -sf http://127.0.0.1:${PORT} 2>/dev/null; then
    echo "[OK] 服务响应正常"
    break
  fi
  echo "等待中... ($i/3)"
  sleep 3
  if [ $i -eq 3 ]; then
    echo "[警告] 健康检查未通过，但服务可能仍在启动中"
    echo "[诊断] PM2 日志:"
    "$PM2_BIN" logs gan-app --lines 20 --nostream 2>/dev/null || true
  fi
done

echo ""
echo "========================================"
echo "  部署完成!"
echo "  访问: http://${SERVER_IP}:${PORT}"
echo "========================================"
`;
}

async function remoteDeploy(keyPath, write = console.log, options = {}) {
  const script = buildRemoteScript({
    remoteDir: options.remoteDir || REMOTE_DIR,
    port: options.port || PORT,
    generateEnv: options.generateEnv !== false,
  });

  const { Client } = require("ssh2");
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => {
        conn.exec(script, (err, stream) => {
          if (err) {
            conn.end();
            reject(err);
            return;
          }
          stream
            .on("close", (code) => {
              conn.end();
              if (code === 0) resolve();
              else reject(new Error("远程部署退出码 " + code));
            })
            .on("data", (d) => write(d.toString()))
            .stderr.on("data", (d) => write(d.toString()));
        });
      })
      .on("error", reject)
      .connect({
        host: SERVER_IP,
        username: "ubuntu",
        privateKey: fs.readFileSync(keyPath),
        readyTimeout: 20000,
      });
  });
}

// ── 服务器状态 ─────────────────────────────────────────────────

function getServerStatus(keyPath) {
  try {
    const output = execSync(
      `ssh -o BatchMode=yes -o ConnectTimeout=5 -i "${keyPath}" ubuntu@${SERVER_IP} "bash -lc 'PM2_BIN=\\$(command -v pm2 || true); if [ -x \\"\\$HOME/.npm-global/bin/pm2\\" ]; then PM2_BIN=\\"\\$HOME/.npm-global/bin/pm2\\"; fi; if [ -n \\"\\$PM2_BIN\\" ]; then \\"\\$PM2_BIN\\" status gan-app 2>/dev/null; else echo 服务未运行; fi'"`,
      { encoding: "utf-8", timeout: 10000 }
    );
    return { ok: true, output: output.trim() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── 导出 ───────────────────────────────────────────────────────

module.exports = {
  SERVER_IP,
  REMOTE_DIR,
  PORT,
  GITHUB_REMOTE_NAME,
  GITHUB_REMOTE_URL,
  ensureSSH2,
  ensureSSHKey,
  testSSH,
  setupSSH,
  getNodeVersion,
  checkNodeVersion,
  checkGitStatus,
  checkLocalBuild,
  ensureGitRepo,
  getGitBranch,
  ensureGitHubRemote,
  syncToGitHub,
  packProject,
  upload,
  remoteDeploy,
  getServerStatus,
};
