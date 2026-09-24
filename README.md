# Misewell

A private meal planning prototype for a household of two. The app is being built in checkpoints from [PLAN.md](PLAN.md).

## Current checkpoint

The Next.js shell, local SQLite database, household defaults, and planning contracts are in place. The catalog currently has twelve original prototype dinners and four lunches linked to reservable components. Browse `/recipes` and open a recipe to scale servings or include a transformed lunch. On the home page, edit planning preferences and save them before generating a draft. **Generate my week** saves a draft for the next Monday–Sunday week with varied dinners, an eat-out night, and linked next-day lunches with their extra source portions reserved. **Use this plan** accepts the draft for that week. A newer draft can replace the accepted plan; the previous one remains archived. **Generate another draft** uses the latest preferences while preserving earlier drafts in the database. Use **Keep in next draft** on a dinner to retain its date, recipe, and linked lunch when regenerating. Conflicting time limits, exclusions, or lunch targets produce an explanation instead of changing a kept meal. The **Groceries** page totals required ingredients by category, shows which meals use them, lets you record what is on hand, and saves bought checks. Counted ingredients use names such as eggs rather than a generic count unit. A blank on-hand field means unknown; entering zero confirms none is available. Recipe needs stay visible alongside the amount to buy. Each planned dinner links to up to three alternatives, filtered by the saved time limit and exclusions. Each option previews the linked lunch outcome, cooking time, and changes to full-week recipe ingredient needs. Confirming a swap updates dinner, reservations, and its lunch together; an option without a reviewed pairing explicitly cancels that lunch. Plan revisions reject stale tabs. Grocery on-hand and bought checks remain saved across swaps. Bought ingredients no longer used by the current plan appear in a separate section with an explicit undo action; purchase quantities are not recorded yet. These recipes have structural checks and food safety references but have not been kitchen-tested. Cooking check-ins and feedback remain future steps.

On the week page, **Skip this dinner** opens that night and cancels its linked lunch; **Cancel this lunch** removes the extra dinner portion reservation without changing dinner itself. Both recalculate grocery needs and reject stale tabs. These are planning edits, not cooking or leftover check-ins.

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

The local SQLite runtime uses Prisma’s official `@prisma/adapter-better-sqlite3`, which includes a native `better-sqlite3` binary. The first install can pause while npm downloads or builds that binary; later installs reuse npm’s cache. The repository `.npmrc` enables offline preference and disables audit/funding network calls so startup is not delayed by unrelated registry work. npm may still print `prebuild-install` and ESLint deprecation notices from upstream packages; they are transitive/toolchain notices and do not indicate a Misewell runtime error.

Open `http://localhost:3000`.

Prisma CLI, client, and SQLite adapter are pinned to version 7.10.0. This schema keeps the database URL in `prisma.config.ts`, as Prisma 7 requires. If a command reports Prisma 6, run `npm ci` in this project and check with `npx prisma --version` before migrating. Do not add `url` to `schema.prisma` to work around a version mismatch.

Use `npm run db:migrate -- --name descriptive_change` only after changing the schema; a fresh setup applies the checked-in migrations with `npm run db:deploy`. The SQLite file is local and ignored by Git. Run `npm run typecheck`, `npm run lint`, and `npm test` after changes.

If a development server was already running while `npm run db:generate` updated the Prisma client, restart that server before using grocery review.
