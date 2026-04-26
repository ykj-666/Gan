import * as fs from "fs";
import * as path from "path";
import { sql } from "drizzle-orm";
import { getDb } from "../queries/connection";

const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_BACKUPS = 7;

export function startBackupSchedule() {
  const dbPath = path.join(process.cwd(), "local.db");
  const backupDir = path.join(process.cwd(), "backups");

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  async function doBackup() {
    try {
      const db = getDb();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = path.join(backupDir, `backup-${timestamp}.db`);

      await db.run(sql`VACUUM INTO ${backupPath}`);

      const files = fs
        .readdirSync(backupDir)
        .filter((f) => f.startsWith("backup-") && f.endsWith(".db"))
        .map((f) => ({
          name: f,
          time: fs.statSync(path.join(backupDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time);

      for (const file of files.slice(MAX_BACKUPS)) {
        fs.unlinkSync(path.join(backupDir, file.name));
      }

      console.log(`[backup] Database backed up to ${backupPath}`);
    } catch (e) {
      console.error("[backup] Backup failed:", e);
    }
  }

  setInterval(doBackup, BACKUP_INTERVAL_MS);
  doBackup();
}
