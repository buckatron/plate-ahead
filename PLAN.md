# Meal planning app: implementation plan

## 1. Product direction

Help a household of two enjoy varied home cooking without having to invent a menu every week. Propose a coherent week before shopping, allow easy dinner swaps, and give extra food a planned use in a different lunch.

The primary success criterion is whether the household accepts a useful weekly plan with little deliberation. Grocery accuracy and enjoyable reuse support that outcome.

### Confirmed requirements

- Plan before shopping, with the option to swap meals.
- Plan five or six dinners for two each week and usually one night out. Leave any remaining night explicitly flexible; do not fill every slot automatically.
- Include lunches made from selected dinners, with transformed flavors or formats to reduce repetition.
- Neither person has dietary restrictions or strong dislikes.
- Allow roughly an hour of cooking per dinner. Enjoying cooking and exploring different cuisines matters more than minimizing all cooking effort.
- Share ingredients across meals while preserving variety in cuisine, texture, flavor, and cooking technique.
- Learn from both behavior and optional explicit feedback.
- Distinguish dislike from temporary fatigue: a favorite can still need a break.
- Reduce forgotten leftovers without making inventory maintenance another chore.
- Write and edit household recipes, and import a recipe from a pasted website link into an editable review draft.
- Use personal recipes for real weekly planning; the sourced starter catalog is a convenient starting point, not a substitute for the household's own collection.

### Proposed starting defaults, adjustable in the product

- Six home dinners, one night out, and two transformed lunches per week, each serving two.
- Sixty-minute dinner limit, including elapsed time; store active time separately.
- A short editable list of staples and ingredients to use, rather than mandatory full pantry inventory.
- Recent meal history covering several weeks, with stronger penalties for more recent repeats.
- One shared household profile for the first release. Individual partner ratings and accounts can follow.

## 2. MVP experience and boundaries

1. Set household size, cooking days, time budget, desired lunch count, and any ingredients to use.
2. Receive one complete proposed week, with concise reasons for meal selection and ingredient connections.
3. Lock meals worth keeping. When swapping a dinner, choose from three alternatives evaluated against the rest of the week.
4. Preview any affected lunch and grocery changes before confirming the swap.
5. Review a consolidated grocery list, mark items already on hand, and check off purchases.
6. Open a dinner recipe showing what to cook, what to reserve before serving, and the linked lunch instructions.
7. Mark dinner cooked and confirm how many reusable portions actually remain. Update or cancel the lunch if the yield differs.
8. Optionally react: loved it, good, not again, or need a break. Add an effort or leftover-quality reason when helpful.

The weekly plan is the main screen. A shortlist appears when replacing a meal; the user should not need to make six separate initial choices.

### Not part of the first release

- Live grocery ordering, store integrations, price optimization, or delivery.
- Barcode scanning, receipt parsing, or automatic fridge inventory.
- Nutrition targets, medical diet advice, social features, or breakfast planning.
- Push notifications or complex machine learning infrastructure.
- Automatically generated cooking instructions. Support household-written recipes and source-preserving imports alongside the sourced starter catalog, with explicit reuse pairings.
- Public multi-household hosting and individual accounts. Build a local/private household prototype first; add authentication before any public release.

## 3. Proposed architecture

The local prototype follows this architecture. Dependency versions and the lockfile are committed with the application.

| Layer | Proposal | Responsibility |
| --- | --- | --- |
| Web application | Next.js with TypeScript | Responsive weekly plan, recipes, groceries, cooking check-in, and feedback |
| Presentation | React and a small shared component/style system | Accessible controls, clear dependencies, mobile use in the kitchen and store |
| Input validation | Zod schemas | Validate settings, mutations, units, servings, and feedback at server boundaries |
| Domain logic | Framework-independent TypeScript modules | Ranking, weekly composition, component allocation, scaling, grocery calculation |
| Persistence | Prisma with SQLite for the private MVP | Recipes, household settings, plans, history, allocations, and purchases |
| Verification | Unit/integration tests plus Playwright for critical journeys | Meal graph consistency, quantities, persistence, and essential UI behavior |

Use a single application process and database. No queue, vector database, or separate recommendation service is needed for the MVP. A future hosted release can move to PostgreSQL through an explicit migration; do not assume the database providers are interchangeable without validation.

```text
Browser
  Weekly plan / recipe / grocery / cooking / feedback screens
        |
Server actions or route handlers
  Validate input, scope household, check plan revision
        |
Application services
  PlanService -- RecommendationService
       |        RecipeCatalog
       +------- GroceryService
       +------- CookingService / FeedbackService
        |
Domain modules: quantities, components, allocations, ranking
        |
Repository layer -> Prisma -> SQLite
```

### Suggested project structure

```text
src/
  app/                  # Pages and thin server mutation handlers
  components/           # Plan, recipe, grocery, and feedback UI
  domain/
    planning/           # Candidate ranking and weekly composition
    meals/              # Components, transformations, and allocation rules
    groceries/          # Unit normalization and purchase calculations
    feedback/           # Preference and fatigue signals
  services/             # Transactions and use-case coordination
  repositories/         # Database reads/writes scoped to a household
  schemas/              # Validated input/output contracts
  data/                 # Reviewed seed catalog and provenance
prisma/
  schema.prisma
  migrations/
tests/
  unit/
  integration/
  e2e/
```

### Application operations

- `generatePlan(settings, lockedSlots)`: create a draft without overwriting the current accepted plan.
- `getSwapOptions(slotId)`: return three feasible alternatives, their reasons, and dependent changes; do not mutate the plan.
- `applySwap(slotId, option, expectedRevision)`: atomically update the dinner, affected lunches, component allocations, and grocery requirements.
- `acceptPlan(planId, expectedRevision)`: activate the reviewed plan.
- `recordCooking(slotId, actualYield, reservedQuantity, requestId)`: record confirmed cooking and actual reusable food without double-counting retries.
- `recordFeedback(cookingEventId, feedback)`: save or update the household reaction.
- `recordLeftoverUse(batchId, quantity, destination)`: account for consumption, freezing, or discarding.
- `updateGroceryLine(...)`: record on-hand coverage and purchasing progress.

Keep domain calculations on the server and return explicit result objects. Mutations use transactions, plan revisions for stale-tab detection, and idempotency keys where retrying could duplicate cooking or stock. Persist a successful mutation before showing it as saved.

## 4. Data model

Use stable IDs and timestamps throughout. Scope household data by `householdId`. Represent fractional quantities with a decimal-safe type or fixed precision utility, not unbounded floating-point arithmetic. Display rounding is separate from calculation.

### Household and recipe catalog

| Entity | Important fields and relationships |
| --- | --- |
| `Household` | `id`, `name`, `timezone`, `servingsDefault` (2) |
| `HouseholdPreferences` | `householdId`, dinner count, lunch count, maximum dinner minutes, variety preference, optional exclusions |
| `Ingredient` | `id`, canonical name, grocery category, default unit, aliases, optional package size/unit |
| `HouseholdIngredient` | `householdId`, `ingredientId`, optional quantity/unit, `isStaple`, `useFirst`, `confirmedAt`; unknown quantities remain unknown |
| `Recipe` | `id`, `version`, title, summary, dinner/lunch role, base servings, active/total minutes, source URL/attribution, review status |
| `RecipeTag` | `recipeId`, dimension and value: cuisine, main ingredient, technique, flavor, texture, meal format; allow multiple values |
| `RecipeComponent` | `id`, `recipeId`, name, base yield quantity/unit, reservable flag, preparation instructions, storage guidance and its source |
| `RecipeIngredient` | `componentId`, `ingredientId`, quantity, unit, preparation note, optional flag; every ingredient belongs to a component |
| `RecipeStep` | `recipeId`, sequence, text, optional `componentId`, optional reservation instruction |
| `Transformation` | `id`, source component, target lunch recipe, description, compatible source state, reviewed storage/timing guidance |
| `TransformationInput` | `transformationId`, target component, required source quantity/unit per base lunch yield; supports more than one reused component |

A recipe can have a single component for a simple dish or several independently scalable components. For example, increase a chicken component to cover lunch without doubling the dinner potatoes or sauce. The lunch recipe defines the assembly, additional ingredients, and which component inputs are supplied from dinner.

Catalog versions are immutable once referenced by an accepted plan or cooking history. Corrections create a new version so old plans and recorded quantities remain interpretable.

### Plans and planned food dependencies

| Entity | Important fields and relationships |
| --- | --- |
| `MealPlan` | `id`, `householdId`, local week start, draft/active/archived state, settings snapshot, `revision` |
| `PlanSlot` | `id`, `planId`, local date, dinner/lunch kind, cook/transformed-lunch/eat-out/flexible type, recipe version if applicable, servings, locked flag, planned/cooked/skipped/cancelled status |
| `PlannedComponent` | `id`, `slotId`, recipe component, preparation scale, planned yield quantity/unit, quantity allocated to the meal itself |
| `ComponentAllocation` | `id`, source planned component, destination lunch slot, transformation, reserved quantity/unit, planned/fulfilled/cancelled state |

The plan is a directed graph: source dinner components feed later lunches. Enforce these invariants in domain validation and database constraints where possible:

- Source and destination belong to the same household and plan; dates follow the supported reuse schedule.
- No dependency cycles, duplicate active date/meal slots, or allocation to an eat-out slot.
- Dinner consumption plus all reservations cannot exceed planned component yield.
- Every transformed lunch has sufficient compatible input for its serving count.
- A selected dinner does not automatically create extra portions or a lunch.
- Locked meals survive regeneration; incompatible locked dependencies produce an actionable explanation.
- A plan with infeasible lunch or timing requirements is a draft with visible unresolved slots, never silently accepted as complete.

### Actual cooking, leftovers, and learning

| Entity | Important fields and relationships |
| --- | --- |
| `CookingEvent` | `id`, `householdId`, optional `slotId`, recipe version, cooked timestamp, servings served, unique request ID |
| `LeftoverBatch` | `id`, cooking event, component, actual reserved quantity/unit, location (fridge/freezer), stored timestamp, optional user-confirmed use date |
| `LeftoverMovement` | `id`, `batchId`, consume/discard/freeze/thaw/adjust type, quantity/unit where applicable, timestamp, optional destination slot |
| `MealFeedback` | `cookingEventId`, reaction, effort, leftover experience, prior enjoyment retained during a break, revision, update time |
| `RecipePreference` | Proposed future record for manual recipe exclusions or snoozes; current cooldowns derive from dated meal feedback |
| `InteractionEvent` | Local record of plan acceptance and dinner swaps with household, plan, optional slot, and recipe identifiers |

Planned food and actual food are separate. Accepting a plan never creates a leftover batch. Confirmed cooking creates stock; recorded uses reduce it. Derive remaining quantity from the batch and movement ledger. Do not maintain an unrelated second balance. A freeze event changes location, not quantity.

Show upcoming linked lunches and unallocated batches in an in-app reminder area. Food age alone must not be presented as proof that food is safe; any storage recommendations require reviewed source guidance. Unknown storage history remains unknown.

### Groceries

| Entity | Important fields and relationships |
| --- | --- |
| `GroceryList` | `id`, `householdId`, `planId`, generated plan revision |
| `GroceryLine` | `id`, list, ingredient, compatible unit group, required quantity/unit, confirmed on-hand coverage, suggested purchase quantity, purchased quantity/check state |
| `GroceryContribution` | line, slot, component/recipe ingredient, normalized quantity; explains which meals need each item |

Grocery requirements and per-meal contributions are currently derived from the plan on read, rather than stored as rows. A plan-specific `GroceryList` and its `GroceryLine` rows persist optional on-hand coverage and bought checks by ingredient and unit group. Unknown on-hand remains distinct from confirmed zero. Shopping state is user-owned and persists across recalculation; requirements are subtracted by on-hand coverage once across the whole plan. Persisted contribution rows and partial purchase amounts remain future refinements.

## 5. Planning and personalization logic

Use transparent rules first. Keep weights in one configuration module and return the top reasons with each recommendation. No external AI API is required for the first useful version.

### Generate a week

1. Filter reviewed recipes by time budget, exclusions, supported servings, snoozed recipes, and available transformation rules.
2. Preserve locked slots and collect confirmed cooking history. Selections that were never cooked are weaker signals.
3. Compose candidate weeks using a bounded search, such as beam search, with deterministic seeds for reproducibility.
4. Score the whole week for preference fit, varied meals, useful ingredient overlap, achievable lunch allocations, and manageable ingredient surplus.
5. Select transformations and scale source components to meet dinner and lunch needs. Prefer the requested number of lunches instead of creating extras everywhere.
6. Validate dependency quantities and schedule; return the proposed week, explanations, and any unresolved constraints.

Candidate scoring should reward known enjoyment and modest exploration; penalize recent identical dishes most strongly. Repeated cuisine, flavor, main ingredient, format, and technique receive smaller combined penalties. Ingredient overlap is beneficial only while those variety requirements remain satisfied.

Give perishable ingredient reuse more weight than sharing salt or oil. Package surplus estimates apply only when package data is known; do not invent exact waste or money savings.

### Learning rules

- Confirmed cooking is the strongest behavioral history signal; merely viewing a suggestion is not preference evidence.
- Choosing a meal is a weak positive signal. An unexplained swap is not a permanent dislike.
- Explicit reactions outweigh inferred signals. An explicit exclusion is a hard filter.
- “Need a break” applies a temporary recipe cooldown while preserving prior enjoyment.
- “Too much effort” changes effort suitability; it should not imply dislike of the cuisine.
- Poor leftover feedback influences that transformation, not necessarily the original dinner.
- Keep exploration in the shortlist so recommendations do not collapse into existing favorites.
- With little or no history, start from balanced variety and visible reasons. Do not pretend preferences have already been learned.

## 6. Grocery and swap correctness

### Grocery calculation

1. Scale ingredients by component preparation amounts, including intentional reserved portions.
2. Add lunch assembly ingredients. Reused chicken or rice is already counted in its source dinner; do not buy it twice.
3. Normalize ingredient aliases and compatible units. Convert mass to mass and volume to volume; convert between count, mass, and volume only with ingredient-specific data.
4. Sum contributions, subtract confirmed on-hand amounts once across the entire plan, and preserve unknown quantities for review.
5. Round purchase amounts only where package sizing is known. Keep recipe need distinct from suggested purchase amount.
6. Group by grocery category and show contribution details on demand.

### Dinner swaps and changes after cooking

Before shopping, a swap can replace a source dinner and replace or cancel its dependent lunch. Preview the effect before committing; apply it in one transaction and recalculate groceries.

After shopping, preserve purchased items and highlight newly needed ingredients and purchases no longer allocated to a meal. Never uncheck or erase a purchased item merely because its recipe was removed.

After cooking, actual leftover batches remain even if future slots change. Replan their destination instead of rewriting the cooking event. If a dinner is skipped or produces fewer reserved portions, mark its dependent lunch as needing attention and offer a feasible replacement or smaller serving count.

## 7. Ordered implementation tasks

The foundation, planning loop, first catalog slice, and personal recipe feature are implemented. Checked boxes reflect completed code; the remaining boxes require the full browser journey and real weekly trial. Section 10 describes the personal recipe architecture and validation gates.

### Phase 1: Foundation and domain contracts

- [x] Scaffold the TypeScript web app, styling, lint/type checks, package scripts, and local run documentation.
- [x] Configure Prisma, SQLite migrations, and an environment example without secrets.
- [x] Implement household defaults and server input validation.
- [x] Define quantity/unit primitives and immutable recipe versions.
- [x] Define plan slots, component yields, and allocation constraints.
- [x] Add repository helpers that always scope household data.

Acceptance: a new local database can be created and seeded from documented commands; invalid quantities and cross-household references are rejected.

### Phase 2: Reviewed recipe and transformation catalog

Current catalog: 36 dinners and 8 transformed lunches are seeded and browsable, each with a linked published source and an original, concise Plate Ahead adaptation. The 24 original prototype dinners and 8 original lunches were replaced by version 2 recipes; their version 1 records remain in existing databases for historical plans. Four disjoint six-dinner selections, each with two transformed lunches, are covered by catalog tests. The Plate Ahead adaptations have structural and food-safety checks but have not been kitchen-tested.

- [x] Seed 24 varied dinner recipes and 8 reviewed lunch transformations, with complete quantities, steps, tags, timings, and provenance.
- [x] Ensure the catalog can generate at least two distinct six-dinner weeks with the default lunch targets.
- [x] Include practical ingredient-sharing pairs whose flavors and formats differ.
- [x] Model reservation before final seasoning where a transformation depends on a neutral component.
- [x] Add catalog validation for missing ingredients, incompatible inputs, incomplete steps, and unsupported units.
- [x] Build readable recipe detail pages with scaling, active/elapsed time, reservation instructions, and lunch links.

Acceptance: the catalog supports a manually assembled week for two, including correct component quantities for two lunches serving two people each.

### Phase 3: First complete vertical slice

- [ ] Create household setup for new households.
- [x] Add editable weekly settings for the existing household; changes apply to newly generated drafts.
- [x] Implement deterministic week generation with variety, overlap, and time constraints.
- [x] Persist generated drafts and accept a reviewed draft with a revision check; archive the previous active plan for that week.
- [x] Add per-dinner locks and revision-aware edits to draft and accepted plans.
- [x] Build the weekly view with dinners, night out/flexible slots, linked lunches, and concise recommendation reasons.
- [x] Aggregate grocery needs from scaled planned components and lunch additions; group by category with per-meal contributions.
- [x] Add plan-specific on-hand review and persistent bought checks to the grocery list.
- [x] Handle empty candidate sets with useful constraint explanations.

Acceptance: settings produce one complete plan and a grocery list with correctly scaled, deduplicated quantities; refreshing preserves the result.

### Phase 4: Swapping and plan repair

- [x] Rank up to three read-only dinner alternatives against the current week, time limit, and exclusions; show the likely linked-lunch outcome.
- [x] Preview the linked lunch outcome, dinner/lunch preparation time, and full-week ingredient requirement changes without mutating the plan.
- [x] Apply dinner swaps and linked-lunch replacement or explicit cancellation atomically with revision checks; preserve plan-specific grocery review rows.
- [x] Preserve bought checks across swaps and show items no longer needed by the current plan, with an explicit undo action.
- [x] Regenerate safely around locked dinners and their linked lunches, with actionable settings conflicts.
- [x] Support deliberate dinner skip and standalone lunch cancellation.

Acceptance: replacing a dinner never leaves an orphan lunch, overallocated component, stale grocery requirement, or lost purchase checkmark.

### Phase 5: Cooking, leftovers, and feedback

- [x] Add an idempotent cooked check-in with actual servings and reserved quantities.
- [x] Create actual leftover batches only after confirmation.
- [x] Record consumption of a planned linked lunch against confirmed leftover batches with an idempotent movement ledger.
- [x] Freeze/thaw whole confirmed batches and record partial or full discards without treating a location move as consumption.
- [x] Record lunch consumption, freezing, adjustments, and discarding with an auditable batch movement ledger.
- [x] Show linked lunches still on the plan and confirmed batch quantities without a planned use across household weeks.
- [x] Capture editable, optional enjoyment, effort, and leftover-experience feedback on confirmed cooked dinners.
- [x] Add optional reactions, effort/leftover reasons, and recipe cooldowns.
- [x] Feed confirmed history and explicit preferences into future recommendations and swap suggestions.

Acceptance: cooking and consuming a linked lunch reconciles actual stock, handles shortages, and changes future recommendations appropriately.

### Phase 5A: Personal recipes and recipe-link import

Implement these increments in order, each usable and verified before proceeding:

- [x] Add household-owned recipe identities, editable drafts, source metadata, explicit planner eligibility, and version-safe publishing; identify the existing catalog as prototype content.
- [x] Build the shared recipe editor and manual creation flow: ingredients, ordered steps, servings, timings, meal role, save draft, review, publish, and edit as a new version.
- [x] Add ingredient parsing and correction controls, canonical ingredient matching, and explicit handling of unmeasured or unsupported amounts in scaling and groceries.
- [x] Integrate personal recipes into the library, detail pages, planner and swaps; add archive and a saved preference to include/exclude prototype recipes.
- [x] Implement bounded, SSRF-protected URL fetching and Schema.org Recipe extraction into the same draft editor, with provenance, duplicate URL handling, and recoverable failures.
- [x] Support pasted recipe text when a site cannot be imported; preserve original lines, parse ingredient candidates, and let the user organize instructions in the editor.
- [x] Add an optional advanced editor for components and explicit dinner-to-lunch reuse mappings, without requiring it for an ordinary dinner recipe.
- [ ] Verify manual and imported recipes through planning, shopping, cooking, feedback, editing, and history; document supported imports and remaining limitations.

The manual recipe flow has been exercised in an isolated SQLite copy through publishing, dinner-to-lunch pairing, plan generation, grocery calculation, and revision history. Repeatable integration tests now publish manual and imported recipes in temporary SQLite, plan a personal-only week, review on-hand groceries and purchases, cook both dinners, save feedback, revise a recipe, and confirm that editing and archiving do not change the historical meal. Parser and network-boundary tests cover representative JSON-LD, unsafe IP addresses, redirects to private addresses, and oversized responses. The single-recipe import path reuses its first fetched page when creating the draft. A blocked import offers a manual draft that retains the submitted source link. A live Love and Lemons URL was imported and published into the household library. Browser inspection of that saved recipe exposed misread ingredient ranges and alternatives; new drafts now require correction, and existing recipes and grocery lists flag their original ambiguous lines without rewriting history. Current personal recipes offer a direct edit action on the detail page, while historical versions link back to the current version. The complete browser journey for an imported recipe still needs hands-on verification. The prototype catalog is distinguished by a null household recipe entry, so seeding cannot overwrite household-owned recipes.

Acceptance: the household can write a recipe or paste a supported recipe URL, correct the draft, save it to its library, and use it in a weekly plan with correct groceries. Editing or archiving it never changes a historical meal. Unsupported websites and incomplete recipes have a useful recovery path.

### Phase 6: End-to-end readiness

- [ ] Verify mobile layout, keyboard navigation, readable recipes, grocery checkboxes, loading, and recoverable errors. Recipe count amounts now display beside ingredient names without `each`, and repeated ingredient lines keep distinct render keys; a full accessibility pass remains.
- [ ] Test the complete default-household journey: generate, swap, shop, cook, consume lunch, react, generate another week. An isolated SQLite integration test now covers the full service-level cycle with the seeded catalog; browser interaction and accessibility remain to verify.
- [x] Add local SQLite export through a backup command and documented backup/restore for household data.
- [x] Record lightweight product events for evaluating acceptance and swaps; keep them local in the MVP.
- [x] Document remaining limitations and the additional authentication, migration, backup, and deployment work required for public hosting.
- [ ] Use the app for a real weekly planning cycle and adjust based on observed friction.

## 8. Verification priorities

Focus tests on quantities and state transitions that can break trust:

- Scaling only the reserved protein component leaves unrelated dinner sides at two servings.
- Source ingredients plus lunch additions yield the correct grocery list without counting reused food twice.
- Compatible units merge; unsupported conversions remain separate and visible.
- Multiple lunches cannot reserve the same portions twice.
- Dinner consumption is included when checking total component yield.
- Swapping a source repairs its dependent lunches and preserves locked meals and purchases.
- Skipping or under-producing dinner makes the dependent lunch visibly unresolved.
- Retrying a cooking confirmation cannot create duplicate batches.
- Consuming, freezing, or discarding food preserves the correct batch balance.
- Uncooked selections do not become confirmed meal history.
- A cooldown suppresses a recently enjoyed recipe without turning it into a permanent dislike.
- First-run, all-locked, insufficient-catalog, stale-revision, and no-quantity pantry cases return understandable outcomes.

Use fixed catalog fixtures and deterministic planner seeds for unit tests, a temporary database for transactional integration tests, and a small number of browser tests for the critical household journeys.

## 9. How we will judge the first version

- How long does it take to accept a weekly plan?
- How many proposed dinners survive without a swap, and why are others replaced?
- How many planned dinners are actually cooked?
- How many transformed lunches are eaten and enjoyed?
- Are reserved portions consumed, frozen, discarded, or simply unreported? Missing reports must not be counted as waste.
- Does the household feel less bored with meals and less burdened by planning?

Collect a baseline during the first real use rather than inventing success targets. The first release is successful enough to expand when it reliably handles one household's weekly loop and its suggestions are worth cooking.

## 10. Personal recipe authoring and URL import design

### Product flow and implementation choice

Use one editor and publishing pipeline for both entry points: **Write a recipe** opens a blank draft; **Import from a link** extracts a source recipe and opens a populated draft. The user can save incomplete work and return later. Publishing saves a usable version to the library; inclusion in automatic planning is a separate, visible choice with any missing requirements explained.

The initial importer should use structured recipe data from the source page, without an AI service or a browser automation service. This keeps the local app inexpensive and preserves the source's wording. Schema.org provides recipe ingredients, yield, timing and instructions; instructions may be text, steps or sections. These formats are documented in [Schema.org Recipe](https://schema.org/Recipe) and [Google's recipe structured-data documentation](https://developers.google.com/search/docs/appearance/structured-data/recipe). Use an HTML parser to extract JSON-LD without executing page scripts, plus a small isolated adapter that normalizes the supported fields. Keep network retrieval, extraction, ingredient parsing and publication separate so another extractor can be added later.

Do not promise that every URL can be imported. For missing structured data, blocked sites or pages requiring login, explain the outcome and offer **Paste recipe text** in the same editor. A future optional model-based extractor can propose structured fields from pasted text if this fallback proves too laborious; it is not required for the first release and must never invent missing ingredients, quantities, timings or instructions.

### Shared editor and recipe readiness

- Basic fields: title, optional description, dinner/lunch role, source/author when applicable, base servings, optional active time, total time, ingredient lines, ordered instruction sections/steps, and optional cuisine/technique/flavor tags. Allow adding, removing and reordering ingredient groups and steps.
- Start with one non-reservable component for the entire recipe. Infer its internal serving yield from confirmed base servings. Ordinary recipe entry must not require knowledge of component allocation.
- Accept freeform ingredient lines such as `2 eggs`, `1 1/2 cups flour` and `salt to taste`. Show editable structured values alongside the original text: amount, unit, ingredient, preparation and optional status. Display count units as `eggs`, `onions`, etc., rather than asking the user to enter vague `each` quantities.
- Parse fractions, Unicode fractions, mixed numbers and common unit aliases deterministically. Flag ranges, alternatives, package quantities and ambiguous lines for review. For `2 (400 g) cans tomatoes`, retain both package and contents information; do not convert cans to mass without the stated package size. Do not silently choose between `1–2 onions` or assume what `one bunch` weighs.
- Suggest matches to canonical ingredients and aliases, but require confirmation for ambiguous matches. Allow creation of a new ingredient with a grocery category and an appropriate unit. Preserve repeated ingredient lines and group assignments, including the same ingredient used at different steps.
- Drafts may be incomplete. A readable library recipe requires a title, ingredients and instructions; automatic planning additionally requires confirmed positive servings, usable total time and grocery-ready ingredient lines. Unknown active time remains unknown rather than being copied from prep time. Do not impose the prototype validator's three-tag minimum or 60-minute ceiling on personal recipes; the household's time limit filters planner candidates.
- Explicit `to taste`/`as needed` ingredients may be marked unmeasured and shown in groceries as **Check amount**, never as zero. Unsupported measurable amounts must be corrected or the recipe remains excluded from automatic planning. Unknown values must not enter quantity calculations as guessed numbers.
- Retain original yield text such as `1 loaf` or `12 cookies`; ask for servings when the yield is not a serving count. Display the original recipe text alongside any warnings so corrections are easy to verify.

### Data model and versioning changes

Keep published `Recipe` rows as immutable versions, and introduce a stable library record plus a separate mutable draft. This avoids weakening the planner's quantity requirements just to save incomplete imports.

| Record/change | Purpose and proposed fields |
| --- | --- |
| `RecipeEntry` | Stable personal identity: id/recipeKey, household owner, origin (`manual`, `url_import`), current published version id, archived timestamp, include-in-planning flag, created/updated timestamps. Bundled prototype recipes have no entry. Enforce ownership and current-version consistency in publication transactions. |
| `RecipeDraft` | Household owner, optional entry id, based-on version id, schema-versioned editable payload and immutable import snapshot, revision, timestamps. Holds unresolved fields and raw source text without making them planner candidates. |
| `Recipe` additions | Optional entry relationship and a version-specific import snapshot. Keep confirmed servings, required total time, content hashes, and monotonically increasing versions; zero active minutes means unspecified. |
| Provenance snapshot | Submitted/final source URL, source canonical URL when valid, author/site attribution, import time, extraction method/version and original ingredient/yield/instruction text. Preserve only relevant recipe data, not entire pages or credentials. Manual edits retain attribution. |
| `RecipeIngredient` / `RecipeStep` additions | Original text, ordering/group labels and an explicit amount kind (`measured` or `unmeasured`). Only explicitly unmeasured published lines may have null numeric quantities. Extend validators and consumers before allowing these values in published recipes. |
| Household preference | `includePrototypeRecipes`, initially preserving existing behavior; expose it in the library/settings so the household can plan exclusively from its own collection. |

Use the draft revision for stale-tab protection. Publishing validates, creates all version children, updates the entry's current-version pointer, and removes the draft in one transaction, so a retry cannot create another version from that draft. Draft edits never mutate a published version. Existing plan slots and cooking events continue referencing their original version. Archive hides a recipe from new suggestions without deleting history. Copying a bundled recipe into a household-owned entry remains a possible future refinement.

Refactor the current recipe repository and catalog loader to select accessible, unarchived, explicitly eligible current versions, rather than selecting the highest `reviewed` row alone. User confirmation is not a claim of kitchen testing or a food-safety review; record provenance and readiness separately. Ensure seeding updates only bundled entries and cannot overwrite personal recipes. Include new records in backup/restore and any future household reset policy.

### Import pipeline and boundaries

1. Validate the submitted URL and fetch a bounded HTML response on the server. Return specific errors for invalid links, timeouts, oversized pages, blocked access, missing recipes and invalid structured data. Keep the pasted URL available for correction/retry.
2. Inspect JSON-LD scripts for Recipe objects, including arrays, nested objects and `@graph` with bounded traversal. If a page contains several recipes, present titles for selection. Support type arrays, text ingredients and supported structured ingredient values; preserve unknown forms as review items. Normalize ordered HowToStep/HowToSection instructions into editor sections without losing order.
3. Decode text safely and map supported title, description, author, ingredients, instructions, yield and ISO duration fields into the draft. Do not mistake elapsed cook/prep duration for active labor. Missing fields become visible questions, not synthesized content.
4. Suggest ingredient normalization and tags, display source attribution and unresolved fields, and save the editable draft. Nothing enters planning until the user confirms it and readiness checks pass.
5. Compare a normalized source URL against household entries. If already imported, explain that it is in the library; edit that version to update it. Strip fragments and known tracking parameters only; preserve meaningful query parameters. A changed URL import never silently overwrites a prior recipe. Content fingerprint comparison and deliberate separate copies remain future refinements.

Treat pasted URLs as untrusted network destinations. Follow [OWASP's SSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html): permit HTTP(S) only, reject embedded credentials and non-public destinations, validate IPv4/IPv6 and every DNS result, and prevent DNS rebinding by connecting only to validated addresses. Disable automatic redirects; validate and resolve each permitted hop. Set explicit request/decompression size limits, timeouts and redirect counts. Do not forward cookies or authorization. Never execute downloaded scripts or render source HTML directly. Use a bounded fetch layer supported by the Node runtime, with tests proving these protections before enabling URL imports. Do not bypass login or access barriers. Initial import does not fetch or host remote images.

### Planner, groceries and leftover integration

Personal recipes participate in the existing ranking and feedback rules by stable recipe key. Missing optional tags contribute no invented variety evidence. Show useful constraints when disabling the prototype catalog leaves too few dinners or no compatible lunches; do not silently re-enable it.

An ordinary imported dinner is usable without a lunch transformation. Reuse requires a deliberate advanced step: identify a reservable source component, its yield and preparation state, select a lunch recipe/component and required amount, and provide storage guidance with a source. Do not infer reuse compatibility or safe storage from scraped text. Update transformations to bind compatible published component/version identities; editing either recipe requires revalidation for new plans, while existing plans retain their original allocations. This addresses the current mix of a version-specific source component and a target recipe key.

Extend grocery aggregation, scaling and recipe rendering together for unmeasured lines. Keep them visible with meal contributions and allow shopping checks without presenting an invented numeric total. Draft warnings, library readiness and planner exclusion reasons should share one validator so a recipe cannot appear ready in the editor but fail later in planning.

### Verification and delivery gates

- Manual entry: save/reopen incomplete work, publish a quantified dinner, include it in a plan, verify scaled groceries, cook it and save feedback. Confirm a second edit leaves the first plan and cooking history unchanged; exercise stale edits and publish retries.
- Import fixtures: single and multiple recipes, nested JSON-LD, instruction sections, fractions, package sizes, ranges, unmeasured ingredients, non-serving yields, missing fields, malformed markup, duplicate URLs and changed source content. Use small authored fixtures for automated tests and a few live sites for a manual compatibility check; tests must not depend on live websites.
- Network boundary: blocked IPv4/IPv6 destinations, DNS changes, redirect to a private address, timeout, excessive response/decompression size and malicious markup. Reject unauthorized cross-household draft and recipe mutations.
- Integration: a personal-only library, too few eligible recipes, unknown optional tags/times, preservation of prototype seed data and user edits across reseeding, archive with historical references, and edited reuse pairings. Run the complete household journey with at least one manually written and one imported recipe before the real weekly trial.
