import { existsSync, readFileSync } from "node:fs";
import { resolve, relative, isAbsolute, join, sep } from "node:path";

export const projectRoot = resolve(import.meta.dirname, "..");
export const backupDirectory = join(projectRoot, "backups");

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
  if (!url?.startsWith("file:./") || url.includes("?") || url.includes("#")) {
    throw new Error("DATABASE_URL must point to a local SQLite file such as file:./dev.db.");
  }
  const path = resolve(projectRoot, url.slice("file:".length));
  if (!within(projectRoot, path) || !path.endsWith(".db")) {
    throw new Error("The SQLite database must be a .db file inside this project.");
  }
  return path;
}

export function backupName(prefix = "misewell") {
  return `${prefix}-${new Date().toISOString().replace(/[:.]/g, "-")}.db`;
}
