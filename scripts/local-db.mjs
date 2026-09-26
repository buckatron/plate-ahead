import { existsSync, readFileSync } from "node:fs";
import { resolve, relative, isAbsolute, join, sep } from "node:path";

export const projectRoot = resolve(import.meta.dirname, "..");
if (process.env.BACKUP_DIR && !isAbsolute(process.env.BACKUP_DIR)) {
  throw new Error("BACKUP_DIR must be an absolute path.");
}
export const backupDirectory = process.env.BACKUP_DIR
  ? resolve(process.env.BACKUP_DIR)
  : join(projectRoot, "backups");

export function within(root, target) {
  const path = relative(root, target);
  return path !== "" && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

export function databasePath() {
  let url = process.env.DATABASE_URL;
  if (!url && existsSync(join(projectRoot, ".env"))) {
    const line = readFileSync(join(projectRoot, ".env"), "utf8").split(/\r?\n/)
      .find((item) => /^\s*DATABASE_URL\s*=/.test(item));
    url = line?.split("=").slice(1).join("=").trim().replace(/^(?:"([^"]*)"|'([^']*)')$/, "$1$2");
  }
  if (!url?.startsWith("file:") || url.includes("?") || url.includes("#")) {
    throw new Error("DATABASE_URL must point to a SQLite file such as file:./dev.db or file:/app/data/plate-ahead.db.");
  }
  const filePath = url.slice("file:".length);
  if (!filePath || filePath.startsWith("//") || filePath.includes("\0")) {
    throw new Error("DATABASE_URL must name a local SQLite .db file.");
  }
  const path = resolve(projectRoot, filePath);
  if (!isAbsolute(filePath) && !within(projectRoot, path)) {
    throw new Error("A relative SQLite database path must stay inside this project.");
  }
  if (!path.endsWith(".db") || path === backupDirectory || within(backupDirectory, path)) {
    throw new Error("The SQLite database must be a .db file outside the backups directory.");
  }
  return path;
}

export function backupName(prefix = "plate-ahead") {
  return `${prefix}-${new Date().toISOString().replace(/[:.]/g, "-")}.db`;
}
