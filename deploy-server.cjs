/**
 * Gan 项目部署 Web 界面服务器
 * 用法: node deploy-server.cjs
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");

const PORT = 3456;
const PROJECT_ROOT = __dirname;
const LOCAL_URL = `http://localhost:${PORT}`;

const {
  SERVER_IP,
  PORT: SERVICE_PORT,
  GITHUB_REMOTE_URL,
  ensureSSH2,
  ensureSSHKey,
  testSSH,
  packProject,
  syncToGitHub,
  upload,
  remoteDeploy,
} = require("./deploy-lib.cjs");

// 打包
function doPack() {
  return packProject(PROJECT_ROOT);
}

// 上传 + 部署（带 SSE 输出）
async function runDeploy(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const write = (text) => res.write(text);

  try {
    if (!ensureSSH2(PROJECT_ROOT)) {
      write("[错误] 依赖安装失败\n");
      res.end();
      return;
    }

    write("[1/6] 检查 SSH 密钥...\n");
    const keyPath = ensureSSHKey();

    write("[2/6] 测试服务器连接...\n");
    const connected = await testSSH(keyPath);
    if (!connected) {
      write("[错误] 无法免密登录服务器\n");
      write("解决方法：打开 CMD，运行以下命令（需要输入一次密码）：\n");
      write(`ssh-copy-id -i "${keyPath}.pub" ubuntu@${SERVER_IP}\n`);
      write("如果 ssh-copy-id 不存在，运行：\n");
      write(
        `type "%USERPROFILE%\\.ssh\\id_ed25519.pub" | ssh ubuntu@${SERVER_IP} "cat >> ~/.ssh/authorized_keys"\n`
      );
      res.end();
      return;
    }

    write("[3/6] 打包项目...\n");
    const { tarFile, size } = doPack();
    write(`[OK] 打包完成 (${size} MB)\n`);

    write("[4/6] 上传到服务器...\n");
    await upload(keyPath, tarFile);
    write("[OK] 上传完成\n");

    write("[5/6] 在服务器上执行部署...\n");
    await remoteDeploy(keyPath, (text) => write(text), {
      remoteDir: "/home/ubuntu/gan",
      port: SERVICE_PORT,
      generateEnv: true,
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
  const child = spawn("npm", ["run", "dev"], {
    cwd: PROJECT_ROOT,
    shell: true,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  return { ok: true };
}

async function runGitHubSync(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const write = (text) => res.write(text);

  try {
    const result = syncToGitHub(PROJECT_ROOT, write);
    write(`\n[完成] 已同步到 ${result.remoteUrl}\n`);
  } catch (err) {
    write("\n[错误] " + err.message + "\n");
    write("提示: 请确认本机已登录 GitHub，或已配置可推送到该仓库的凭据\n");
  }

  res.end();
}

function openBrowser(url) {
  const platform = process.platform;
  if (platform === "win32") {
    execSync(`start "" "${url}"`, { stdio: "ignore", shell: true });
    return;
  }
  if (platform === "darwin") {
    execSync(`open "${url}"`, { stdio: "ignore" });
    return;
  }
  execSync(`xdg-open "${url}"`, { stdio: "ignore" });
}

function probeExistingDeployUi(url) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const req = http.get(url, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        if (body.length < 512) {
          body += chunk;
        }
      });
      res.on("end", () => finish(res.statusCode === 200 && body.includes("Gan 项目部署工具")));
    });

    req.on("error", () => finish(false));
    req.setTimeout(1500, () => {
      req.destroy();
      finish(false);
    });
  });
}

async function handleServerStartupError(err) {
  if (err.code !== "EADDRINUSE") {
    console.error("\n[错误] 启动部署页面失败: " + err.message);
    process.exit(1);
    return;
  }

  const existingUiReady = await probeExistingDeployUi(LOCAL_URL);
  if (existingUiReady) {
    console.log(`\n[提示] 部署页面已经在运行: ${LOCAL_URL}`);
    try {
      openBrowser(LOCAL_URL);
    } catch {
      console.log("请手动在浏览器中打开上述地址");
    }
    process.exit(0);
    return;
  }

  console.error(`\n[错误] 端口 ${PORT} 已被其他程序占用，无法启动部署页面。`);
  console.error("请关闭占用该端口的程序后重试，或改用其他端口。");
  process.exit(1);
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

  if (req.url === "/api/github-sync") {
    await runGitHubSync(res);
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

server.on("error", (err) => {
  handleServerStartupError(err);
});

server.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  Gan 项目部署工具已启动`);
  console.log(`  请在浏览器中打开:`);
  console.log(`  ${LOCAL_URL}`);
  console.log(`  GitHub: ${GITHUB_REMOTE_URL}`);
  console.log(`========================================\n`);

  try {
    openBrowser(LOCAL_URL);
  } catch {
    console.log("请手动在浏览器中打开上述地址");
  }
});
