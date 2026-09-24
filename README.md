# Misewell

A private meal planning prototype for a household of two. The app is being built in checkpoints from [PLAN.md](PLAN.md).

## Current checkpoint

The Next.js and local SQLite prototype has twelve reviewed dinners and four linked lunches. Browse and scale recipes under `/recipes`, set preferences on the home page, generate a draft, and accept it before shopping. New drafts can preserve dinners marked **Keep in next draft**; conflicts with changed settings are explained. The **Groceries** page combines meal ingredients, on-hand review, and bought checks, including ingredients purchased for meals later removed from the plan. Dinner alternatives preview recipe, lunch, timing, and grocery changes before swapping. Plan revisions reject stale tabs. Recipes have structural checks and food safety references but have not been kitchen-tested; purchase quantities and meal feedback are not tracked yet.

On the week page, **Skip this dinner** opens that night and cancels its linked lunch; **Cancel this lunch** removes the extra dinner portion reservation without changing dinner itself. Both recalculate grocery needs and reject stale tabs. These are planning edits, not cooking or leftover check-ins.

On an accepted week, **Mark dinner cooked** records servings eaten and the reusable amount actually saved for each component. This creates leftover batches only for confirmed positive amounts. A shortfall flags the linked lunch for attention; lunch consumption, freezing, and discarding are not yet tracked. Once a dinner is recorded, that accepted week cannot be replaced by another draft.

## Run locally

Requires Node.js 20.19+, 22.12+, or 24+. Run these commands from the project directory.

### After changes: update, migrate, seed, and restart

Use this path after pulling changes, changing `package.json`, changing the Prisma schema, or setting up this checkout for the first time. `npm install` reuses the existing `node_modules` folder, so it is much faster for normal development. Stop any existing dev server with `Ctrl+C` before starting again.

```powershell
npm install --prefer-offline --no-audit --no-fund
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run db:deploy
npm run db:generate
npm run db:seed
npm run dev
```

Use `npm ci` only when you specifically need a clean dependency reset (for example, after deleting `node_modules` or when diagnosing a corrupted install). It removes and recreates the entire dependency tree, including the native SQLite binary, so it is expected to be slower.

If you changed `prisma/schema.prisma`, create the migration before `db:deploy`:

```powershell
npm run db:migrate -- --name descriptive_change
npm run db:generate
npm run db:seed
npm run dev
```

### Already initialized: start the app

Use this shorter path when dependencies, `.env`, migrations, generated Prisma client, and seed data are already current. It starts the existing local database without reinstalling or reseeding it.

```powershell
npm run dev
```

If the app was already running, Next.js will usually apply code changes automatically. Restart it with `Ctrl+C`, then `npm run dev`, after `npm run db:generate`, a dependency change, or any change that affects the Prisma client.

For the grocery review update, no package install is needed. Stop the app, run `npm run db:deploy` and `npm run db:generate`, then run `npm run dev` again.

For the dinner swap update, no package install or database migration is needed. Restart the app with `npm run dev` if it is not already running.

For the cooking check-in update, no package install is needed. Stop the app, run `npm run db:deploy` and `npm run db:generate`, then restart with `npm run dev`.

The local SQLite runtime uses Prisma’s official `@prisma/adapter-better-sqlite3`, which includes a native `better-sqlite3` binary. The first install can pause while npm downloads or builds that binary; later installs reuse npm’s cache. The repository `.npmrc` enables offline preference and disables audit/funding network calls so startup is not delayed by unrelated registry work. npm may still print `prebuild-install` and ESLint deprecation notices from upstream packages; they are transitive/toolchain notices and do not indicate a Misewell runtime error.

Open `http://localhost:3000`.

Prisma CLI, client, and SQLite adapter are pinned to version 7.10.0. This schema keeps the database URL in `prisma.config.ts`, as Prisma 7 requires. If a command reports Prisma 6, run `npm ci` in this project and check with `npx prisma --version` before migrating. Do not add `url` to `schema.prisma` to work around a version mismatch.

Use `npm run db:migrate -- --name descriptive_change` only after changing the schema; a fresh setup applies the checked-in migrations with `npm run db:deploy`. The SQLite file is local and ignored by Git. Run `npm run typecheck`, `npm run lint`, and `npm test` after changes.

If a development server was already running while `npm run db:generate` updated the Prisma client, restart that server before using grocery review.
