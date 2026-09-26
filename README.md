# Plate Ahead

A private meal planning prototype for a household of two. The app is being built in checkpoints from [PLAN.md](PLAN.md).

## Current checkpoint

The Next.js and local SQLite prototype has 24 dinners and 8 linked lunches. Browse and scale recipes under `/recipes`, set preferences on the home page, generate a draft, and accept it before shopping. New drafts can preserve dinners marked **Keep in next draft**; conflicts with changed settings are explained. The **Groceries** page combines meal ingredients, on-hand review, and bought checks, including ingredients purchased for meals later removed from the plan. Dinner alternatives preview recipe, lunch, timing, and grocery changes before swapping. Plan revisions reject stale tabs. Recipes have structural checks and food safety references but have not been kitchen-tested; purchase quantities are not tracked yet.

On the week page, **Skip this dinner** opens that night and cancels its linked lunch; **Cancel this lunch** removes the extra dinner portion reservation without changing dinner itself. Both recalculate grocery needs and reject stale tabs. These are planning edits, not cooking or leftover check-ins.

On an accepted week, **Mark dinner cooked** records servings eaten and the reusable amount actually saved for each component. This creates leftover batches only for confirmed positive amounts. A shortfall flags the linked lunch for attention. Once a dinner is recorded, that accepted week cannot be replaced by another draft.

After recording dinner, **How was this meal?** lets you optionally save or edit whether you would cook it again, how the effort felt, and whether its leftovers sounded appealing. The **History** page keeps those cooked meals and their feedback accessible. Confirmed cooking discourages recent repeats; “Loved it” and “Good” can favor a recipe once enough time has passed. “Need a break” removes it from new suggestions for four weeks, while “Not again” removes it until you change the feedback. An unappealing leftover rating prevents that dinner from supplying a new linked lunch. The current planner uses simple, visible rules, not a trained model.

Once the source dinner is cooked, **Mark lunch eaten** records the planned lunch servings and deducts its reserved quantity from the confirmed batch. The remaining balance is calculated from that batch and its movements, and duplicate submissions cannot consume it twice. You can mark a batch frozen or thawed, record a partial or full discard, or correct a mistaken remaining amount (including zero). These changes are recorded in the movement ledger; they do not rewrite the original cooking entry. Linked lunches are flagged when too little remains and restored when a correction supplies enough. Partial lunches are still future work.

The home-page sidebar now shows linked lunches still on accepted plans and confirmed saved food beyond any outstanding lunch reservation. It includes food from earlier weeks so an unused batch is not hidden when you generate a new plan. Stored dates are memory aids, not food-safety advice.

## Add your own recipes

Open **Recipes → Add a recipe** to write a recipe or import a public recipe link. Link import reads the site's Schema.org recipe data into an editable draft. The app server needs outbound web access for this; opening the site in your browser is not enough if the server is running in a network-restricted environment. Save incomplete drafts and publish after confirming servings, total time, ingredient amounts, and steps. If a site blocks import or has no structured recipe data, choose **Continue manually with this link** to open a blank draft with the source URL preserved, then paste its ingredient and instruction text. Imports do not execute page scripts or fetch images. The original source URL, author, and extracted recipe fields are kept with published versions.

The ingredient review lists parsed amounts and suggests grocery matches. Choose a category for new ingredients. `Salt to taste` and similar lines remain visible as **Check amount** on groceries, with a shopping check instead of a fabricated quantity. The parser assumes a 240 mL cup, a 15 mL tablespoon, and a 5 mL teaspoon; check imported measures against the source, especially for recipes using regional cup sizes. Ranges, alternatives, package sizes, and measured lines with optional `to taste` amounts need manual correction before publishing. Previously saved recipes with such lines show a review warning on their recipe page and when used in a grocery list; their stored quantities are not silently changed.

Published personal recipes appear in the library and can be used by the planner and dinner swaps. **Show only my recipes** removes the prototype catalog from new suggestions. You can pause a personal recipe in suggestions or archive it without changing meals already planned or cooked. Editing creates a new version; historical plans link to the version they used. To turn reserved dinner food into lunch, mark a recipe component reservable with sourced storage guidance, write a separate lunch recipe, and use **Link dinner to lunch**. Separate components let you scale only the reserved part.

This is still a private, single-household app. Recipe import works best on pages with Schema.org Recipe JSON-LD; login-only pages, blocked sites, and arbitrary page layouts need manual paste. Source ingredient wording and storage advice require your review before cooking.

The Love and Lemons lemon-orzo page has been tested as a live import. Some sites, including Serious Eats, Simply Recipes, and Allrecipes, returned HTTP 403 to the server during local checks; use the manual draft when a site blocks automatic access. Website behavior can change independently of the app.

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

The history, cooldown, and local event update adds migrations. After pulling it, stop the app, run `npm run db:deploy` and `npm run db:generate`, then restart with `npm run dev`. No package reinstall is needed. To add new catalog recipes to an existing database, run `npm run db:seed` before restarting. Seeding preserves existing recipe versions and plan history.

The local SQLite runtime uses Prisma’s official `@prisma/adapter-better-sqlite3`, which includes a native `better-sqlite3` binary. The first install can pause while npm downloads or builds that binary; later installs reuse npm’s cache. The repository `.npmrc` enables offline preference and disables audit/funding network calls so startup is not delayed by unrelated registry work. npm may still print `prebuild-install` and ESLint deprecation notices from upstream packages; they are transitive/toolchain notices and do not indicate a Plate Ahead runtime error.

Open `http://localhost:3000`.

Prisma CLI, client, and SQLite adapter are pinned to version 7.10.0. This schema keeps the database URL in `prisma.config.ts`, as Prisma 7 requires. If a command reports Prisma 6, run `npm ci` in this project and check with `npx prisma --version` before migrating. Do not add `url` to `schema.prisma` to work around a version mismatch.

Use `npm run db:migrate -- --name descriptive_change` only after changing the schema; a fresh setup applies the checked-in migrations with `npm run db:deploy`. The SQLite file is local and ignored by Git. Run `npm run typecheck`, `npm run lint`, and `npm test` after changes. `npm run test:integration` checks personal-recipe publishing and revision history against a temporary SQLite database; it does not touch your household data.

If a development server was already running while `npm run db:generate` updated the Prisma client, restart that server before using the app.

## Back up or restore your local data

`npm run db:backup` creates a consistent SQLite copy in the ignored `backups/` folder. Copy that `.db` file somewhere else for safekeeping; Git does not include it. Back up before upgrading or changing machines.

To restore, stop the app and any database tools, then run:

```powershell
npm run db:restore -- backups/plate-ahead-YOUR-BACKUP.db
npm run db:deploy
npm run db:generate
npm run dev
```

Restore accepts only a `.db` file inside this project's `backups/` folder, including backups made under the old `misewell-` name. It checks SQLite integrity and first saves the current database as `backups/before-restore-...db`. Restoring replaces the local database, including any plans and feedback created since the selected backup. The backup files contain all household data; keep them private. If the database uses active SQLite journal files, restore stops and asks you to close the app first.

## Current limits

This is a single-household local prototype. It has no accounts, public access controls, or automatic off-device backups. The 24 dinners and 8 transformed lunches are original prototype formulations with structurally checked quantities and instructions; they have not been kitchen-tested. Cooking temperatures and leftover storage guidance follow [FoodSafety.gov’s temperature chart](https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures) and [cold storage chart](https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts). Lunch consumption records the planned serving amount; partial lunches and purchase quantities are not recorded. The current recommendation rules use recent cooking and feedback, but do not estimate food waste or savings.

Public hosting would require household authentication and authorization on every read and write, a hosted database migration, protected backups and restore procedures, deployment configuration, and a review of data retention and recipe content. Do not expose this local build on the public internet as-is.
