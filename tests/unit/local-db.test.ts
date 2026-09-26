import { afterEach, describe, expect, it } from "vitest";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { databasePath, projectRoot } from "../../scripts/local-db.mjs";

const originalUrl = process.env.DATABASE_URL;
afterEach(() => {
  if (originalUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalUrl;
});

describe("backup database path", () => {
  it("keeps the existing project-relative SQLite path", () => {
    process.env.DATABASE_URL = "file:./dev.db";
    expect(databasePath()).toBe(resolve(projectRoot, "dev.db"));
  });

  it("accepts an absolute mounted SQLite path", () => {
    const path = join(tmpdir(), "plate-ahead.db");
    process.env.DATABASE_URL = `file:${path}`;
    expect(databasePath()).toBe(path);
  });

  it("rejects non-file URLs and paths in the backup directory", () => {
    process.env.DATABASE_URL = "https://example.com/data.db";
    expect(() => databasePath()).toThrow("DATABASE_URL");
    process.env.DATABASE_URL = "file:./backups/data.db";
    expect(() => databasePath()).toThrow("outside the backups directory");
    process.env.DATABASE_URL = "file://example.com/data.db";
    expect(() => databasePath()).toThrow("DATABASE_URL");
    process.env.DATABASE_URL = "file:../../outside.db";
    expect(() => databasePath()).toThrow("inside this project");
  });
});
