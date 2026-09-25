import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import Database from "better-sqlite3";
import { backupDirectory, backupName, databasePath } from "./local-db.mjs";

const sourcePath = databasePath();
await mkdir(backupDirectory, { recursive: true });
const destinationPath = join(backupDirectory, backupName());
const database = new Database(sourcePath, { readonly: true, fileMustExist: true });
try {
  await database.backup(destinationPath);
  console.log(`Backup saved: ${destinationPath}`);
} finally {
  database.close();
}
