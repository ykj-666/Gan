const net = require("net");

process.env.NODE_ENV = "production";
require("../load-env.cjs").loadAppEnv(process.env.NODE_ENV);

const port = process.env.PORT || "3000";
process.env.PORT = port;

function canConnect(host, portNumber, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = net.createConnection({
      host,
      port: portNumber,
    });

    const finish = (result) => {
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function main() {
  const databaseUrl = (process.env.DATABASE_URL || "").trim();

  if (!databaseUrl) {
    console.error("[ENV] DATABASE_URL 未配置。");
    console.error(
      "[ENV] 请在 .env、.env.local 或 .env.production.local 中设置 mysql://user:password@127.0.0.1:3306/gan",
    );
    process.exit(1);
  }

  try {
    const parsed = new URL(databaseUrl);
    const databasePort = Number(parsed.port || 3306);
    const isLocalMysql =
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "::1";

    if (isLocalMysql) {
      const isMysqlReachable = await canConnect("127.0.0.1", databasePort);
      if (!isMysqlReachable) {
        console.error(`[DB] 未检测到本机 MySQL 服务，127.0.0.1:${databasePort} 当前无法连接。`);
        console.error("[DB] 请先安装并启动 MySQL，再重新运行本地服务。");
        process.exit(1);
      }
    }
  } catch (error) {
    console.error("[ENV] DATABASE_URL 格式无效：", error.message);
    process.exit(1);
  }

  import("../dist/boot.js").catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

main();
