/**
 * Gan 项目部署库
 * 只保留线上部署必需逻辑。
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const os = require("os");

const SERVER_IP = "118.89.134.207";
const REMOTE_DIR = "/home/ubuntu/gan";
const PORT = "3000";

function ensureSSH2(projectRoot) {
  try {
    require("ssh2");
    return true;
  } catch {
    console.log("[首次使用] 正在安装部署依赖...");
    try {
      const deployDir = path.join(projectRoot, "deploy-tool");
      if (!fs.existsSync(path.join(deployDir, "node_modules"))) {
        execSync("npm install", { cwd: deployDir, stdio: "inherit" });
      }
      module.paths.unshift(path.join(deployDir, "node_modules"));
      require("ssh2");
      console.log("[OK] 部署依赖安装完成");
      return true;
    } catch (error) {
      console.log("[错误] 部署依赖安装失败: " + error.message);
      return false;
    }
  }
}

function ensureSSHKey() {
  const sshDir = path.join(os.homedir(), ".ssh");
  const keyPath = path.join(sshDir, "id_ed25519");

  if (fs.existsSync(keyPath)) {
    return keyPath;
  }

  console.log("[首次使用] 正在生成 SSH 密钥...");
  if (!fs.existsSync(sshDir)) {
    fs.mkdirSync(sshDir, { mode: 0o700 });
  }

  try {
    execSync(`ssh-keygen -t ed25519 -C "gan-deploy" -f "${keyPath}" -N ""`, { stdio: "ignore" });
    console.log("[OK] SSH 密钥生成完成");
    return keyPath;
  } catch (error) {
    console.log("[错误] SSH 密钥生成失败: " + error.message);
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
      .on("error", () => {
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
          (error, stream) => {
            if (error) {
              conn.end();
              reject(error);
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
    setTimeout(() => reject(new Error("SSH 操作超时，请检查网络或手动配置免密登录")), 30000);
  });

  await Promise.race([sshTask, timeoutTask]);
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return testSSH(keyPath);
}

function getNodeVersion() {
  try {
    const raw = execSync("node --version", { encoding: "utf-8" }).trim();
    const major = Number.parseInt(raw.slice(1).split(".")[0], 10);
    return { raw, major };
  } catch {
    return null;
  }
}

function checkNodeVersion(minMajor = 20) {
  const version = getNodeVersion();
  if (!version) {
    return { ok: false, message: "未检测到 Node.js，请先安装 Node.js" };
  }

  if (version.major < minMajor) {
    return {
      ok: false,
      message: `Node.js 版本过低: ${version.raw}，需要 >= v${minMajor}.0.0`,
    };
  }

  return { ok: true, message: `Node.js ${version.raw}` };
}

function packProject(projectRoot) {
  const tarFile = path.join(os.tmpdir(), "gan-deploy.tar.gz");
  const excludes = [
    "node_modules",
    ".git",
    "local.db",
    "dist",
    ".env*",
    "*.local",
    "*.log",
    "deploy-tool",
    ".runtime",
    "backups",
  ];
  const excludeArgs = excludes.map((pattern) => `--exclude=${pattern}`).join(" ");

  execSync(`tar -czf "${tarFile}" ${excludeArgs} -C "${projectRoot}" .`, {
    stdio: "ignore",
  });

  const size = (fs.statSync(tarFile).size / 1024 / 1024).toFixed(2);
  return { tarFile, size };
}

async function uploadFile(keyPath, localPath, remotePath) {
  const { Client } = require("ssh2");
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => {
        conn.sftp((error, sftp) => {
          if (error) {
            conn.end();
            reject(error);
            return;
          }

          sftp.fastPut(localPath, remotePath, (putError) => {
            conn.end();
            if (putError) {
              reject(putError);
              return;
            }
            resolve();
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

async function upload(keyPath, tarFile, remotePath = "/tmp/gan-deploy.tar.gz") {
  return uploadFile(keyPath, tarFile, remotePath);
}

async function uploadSharedEnv(keyPath, envFilePath, remotePath = "/tmp/gan-shared.env") {
  return uploadFile(keyPath, envFilePath, remotePath);
}

function resolveDeployEnvPath(projectRoot) {
  const candidates = [".env.production.local", ".env.production", ".env.local", ".env"];

  for (const candidate of candidates) {
    const fullPath = path.join(projectRoot, candidate);
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    const content = fs.readFileSync(fullPath, "utf-8");
    if (/^DATABASE_URL=mysql:\/\//m.test(content)) {
      return fullPath;
    }
  }

  return null;
}

function buildRemoteScript(options) {
  const { remoteDir, port, generateEnv } = options;

  return `set -e

REMOTE_DIR="${remoteDir}"
PORT="${port}"
SHARED_DIR="\${REMOTE_DIR}/shared"
SHARED_ENV="\${REMOTE_DIR}/shared/.env"
UPLOADED_ENV="/tmp/gan-shared.env"

echo "[a] checking Node.js..."
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found, trying automatic install..."
  if sudo -n true 2>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
    sudo apt-get install -y nodejs
  else
    echo "Error: sudo unavailable, cannot install Node.js automatically"
    exit 1
  fi
fi
node -v

echo "[b] checking PM2..."
export PATH="$HOME/.npm-global/bin:$PATH"
PM2_BIN="$(command -v pm2 || true)"
if [ -z "$PM2_BIN" ]; then
  mkdir -p ~/.npm-global
  npm config set prefix '~/.npm-global'
  npm install -g pm2
  PM2_BIN="$HOME/.npm-global/bin/pm2"
fi
if [ ! -x "$PM2_BIN" ]; then
  echo "Error: PM2 install failed"
  exit 1
fi

echo "[c] unpacking release..."
mkdir -p "$REMOTE_DIR"
mkdir -p "$SHARED_DIR"
RELEASE_DIR="$REMOTE_DIR/releases/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RELEASE_DIR"
if [ -f "$SHARED_ENV" ]; then
  cp "$SHARED_ENV" /tmp/gan-dotenv.bak
elif [ -f "$REMOTE_DIR/current/.env" ]; then
  cp "$REMOTE_DIR/current/.env" /tmp/gan-dotenv.bak
elif [ -f "$REMOTE_DIR/.env" ]; then
  cp "$REMOTE_DIR/.env" /tmp/gan-dotenv.bak
fi
tar -xzf /tmp/gan-deploy.tar.gz -C "$RELEASE_DIR"
if [ -f "$UPLOADED_ENV" ]; then
  mv "$UPLOADED_ENV" "$SHARED_ENV"
fi
if [ -f /tmp/gan-dotenv.bak ] && [ ! -f "$SHARED_ENV" ]; then
  mv /tmp/gan-dotenv.bak "$SHARED_ENV"
fi
if [ -f "$SHARED_ENV" ]; then
  chmod 600 "$SHARED_ENV" || true
  cp "$SHARED_ENV" "$RELEASE_DIR/.env"
fi
ln -sfn "$RELEASE_DIR" "$REMOTE_DIR/current"

echo "[d] installing dependencies and building..."
cd "$RELEASE_DIR"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi
npm run build

${generateEnv ? `echo "[d1] ensuring .env..."
if [ ! -f "$SHARED_ENV" ]; then
  cat > "$SHARED_ENV" << 'ENVEOF'
APP_ID=gan-app
APP_SECRET=change-me-in-production
DATABASE_URL=mysql://user:password@127.0.0.1:3306/gan
KIMI_API_KEY=
OWNER_UNION_ID=
ENVEOF
  echo "Created default .env. Configure DATABASE_URL for MySQL, then redeploy."
  exit 1
fi
if ! grep -q '^DATABASE_URL=' "$SHARED_ENV"; then
  echo "Error: DATABASE_URL missing in shared .env"
  exit 1
fi
cp "$SHARED_ENV" "$REMOTE_DIR/current/.env"
` : ""}

if ! grep -Eq '^DATABASE_URL=mysql://' "$REMOTE_DIR/current/.env"; then
  echo "Error: DATABASE_URL must be a mysql:// connection string"
  exit 1
fi

DATABASE_URL_VALUE="$(sed -n 's/^DATABASE_URL=//p' "$REMOTE_DIR/current/.env" | tail -n 1 | tr -d '\\r')"

if [ -z "$DATABASE_URL_VALUE" ]; then
  echo "Error: DATABASE_URL is empty in $REMOTE_DIR/current/.env"
  exit 1
fi

read DB_HOST_B64 DB_PORT_B64 DB_USER_B64 DB_PASSWORD_B64 DB_NAME_B64 <<EOF
$(DATABASE_URL="$DATABASE_URL_VALUE" node -e "const u=new URL(process.env.DATABASE_URL); const values=[u.hostname || '127.0.0.1', u.port || '3306', decodeURIComponent(u.username), decodeURIComponent(u.password), u.pathname.replace(/^\\/+/, '')]; console.log(values.map((value) => Buffer.from(String(value)).toString('base64')).join(' '));")
EOF

decode_b64() {
  printf '%s' "$1" | base64 --decode
}

DB_HOST="$(decode_b64 "$DB_HOST_B64")"
DB_PORT="$(decode_b64 "$DB_PORT_B64")"
DB_USER="$(decode_b64 "$DB_USER_B64")"
DB_PASSWORD="$(decode_b64 "$DB_PASSWORD_B64")"
DB_NAME="$(decode_b64 "$DB_NAME_B64")"

if [ "$DB_HOST" = "127.0.0.1" ] || [ "$DB_HOST" = "localhost" ] || [ "$DB_HOST" = "::1" ]; then
  echo "[d2] ensuring local MySQL user and database..."
  if ! sudo -n true 2>/dev/null; then
    echo "Error: sudo unavailable, cannot install or configure MySQL automatically"
    exit 1
  fi
  DB_NAME="$DB_NAME" DB_USER="$DB_USER" DB_PASSWORD="$DB_PASSWORD" bash scripts/setup-mysql-ubuntu.sh
else
  echo "[d2] skipping MySQL install for remote host $DB_HOST"
fi

echo "[d3] bootstrapping MySQL..."
DATABASE_URL="$DATABASE_URL_VALUE" node db/apply-migration.cjs

echo "[e] starting service..."
"$PM2_BIN" delete gan-app 2>/dev/null || true
DATABASE_URL="$DATABASE_URL_VALUE" NODE_ENV=production PORT=$PORT "$PM2_BIN" start "$REMOTE_DIR/current/dist/boot.js" --name gan-app --cwd "$REMOTE_DIR/current" --update-env
"$PM2_BIN" save

echo "[e2] configuring restart..."
PM2_CRON="@reboot PATH=$HOME/.npm-global/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin $PM2_BIN resurrect >/tmp/gan-pm2-resurrect.log 2>&1"
(crontab -l 2>/dev/null | grep -Fv "$PM2_BIN resurrect" ; echo "$PM2_CRON") | crontab -

echo "[f] waiting for startup..."
sleep 5

echo "[g] health check..."
for i in 1 2 3; do
  if curl -sf http://127.0.0.1:$PORT/api/trpc/ping 2>/dev/null || curl -sf http://127.0.0.1:$PORT 2>/dev/null; then
    echo "[OK] service is responding"
    break
  fi
  echo "waiting... ($i/3)"
  sleep 3
  if [ $i -eq 3 ]; then
    echo "[WARN] health check did not pass yet"
    "$PM2_BIN" logs gan-app --lines 20 --nostream 2>/dev/null || true
  fi
done

echo ""
echo "========================================"
echo "  Deploy complete"
echo "  Visit: http://${SERVER_IP}:${PORT}"
echo "========================================"
`;
}

async function remoteDeploy(keyPath, write = console.log, options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const envFilePath = options.envFilePath || resolveDeployEnvPath(projectRoot);

  if (envFilePath) {
    write(`[env] uploading ${path.basename(envFilePath)} to shared server env\n`);
    await uploadSharedEnv(keyPath, envFilePath);
  }

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
        conn.exec(script, (error, stream) => {
          if (error) {
            conn.end();
            reject(error);
            return;
          }

          stream
            .on("close", (code) => {
              conn.end();
              if (code === 0) {
                resolve();
                return;
              }
              reject(new Error("远程部署退出码 " + code));
            })
            .on("data", (data) => write(data.toString()))
            .stderr.on("data", (data) => write(data.toString()));
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

module.exports = {
  SERVER_IP,
  REMOTE_DIR,
  PORT,
  ensureSSH2,
  ensureSSHKey,
  testSSH,
  setupSSH,
  getNodeVersion,
  checkNodeVersion,
  packProject,
  upload,
  uploadSharedEnv,
  resolveDeployEnvPath,
  remoteDeploy,
};
