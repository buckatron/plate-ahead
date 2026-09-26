import { copyFile, mkdir } from "node:fs/promises";
import { existsSync, lstatSync, realpathSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import Database from "better-sqlite3";
import { backupDirectory, backupName, databasePath, within } from "./local-db.mjs";

const sourceArg = process.argv[2];
if (!sourceArg) throw new Error("Pass the path to a .db file in the backups directory.");
const sourcePath = isAbsolute(sourceArg) ? resolve(sourceArg) : resolve(process.cwd(), sourceArg);
if (!within(backupDirectory, sourcePath) || !sourcePath.endsWith(".db") || !existsSync(sourcePath) ||
  !within(realpathSync(backupDirectory), realpathSync(sourcePath))) {
  throw new Error(`Choose an existing .db file inside ${backupDirectory}.`);
}
const destinationPath = databasePath();
if (existsSync(destinationPath) && lstatSync(destinationPath).isSymbolicLink()) {
  throw new Error("Refusing to replace a database path that is a symbolic link.");
}
if (existsSync(`${destinationPath}-wal`) || existsSync(`${destinationPath}-shm`)) {
  throw new Error("The database has active SQLite journal files. Stop the app and close database tools before restoring.");
}
const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
try {
  const integrity = source.pragma("integrity_check");
  if (integrity.length !== 1 || integrity[0].integrity_check !== "ok" || source.pragma("foreign_key_check").length) {
    throw new Error("The selected backup did not pass SQLite integrity checks.");
  }
} finally {
  source.close();
}
await mkdir(backupDirectory, { recursive: true });
if (existsSync(destinationPath)) {
  const safetyPath = join(backupDirectory, backupName("before-restore"));
  const current = new Database(destinationPath, { readonly: true, fileMustExist: true });
  try { await current.backup(safetyPath); }
  finally { current.close(); }
  console.log(`Current database saved first: ${safetyPath}`);
}
await copyFile(sourcePath, destinationPath);
console.log(`Database restored from: ${sourcePath}`);
console.log("Run npm run db:deploy and npm run db:generate before starting the app.");
