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
- Automatically generated cooking instructions. Start with a reviewed recipe catalog and explicit reuse pairings.
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

The foundation, planning loop, and first catalog slice are implemented. Checked boxes reflect completed code; the remaining boxes are still planned.

### Phase 1: Foundation and domain contracts

- [x] Scaffold the TypeScript web app, styling, lint/type checks, package scripts, and local run documentation.
- [x] Configure Prisma, SQLite migrations, and an environment example without secrets.
- [x] Implement household defaults and server input validation.
- [x] Define quantity/unit primitives and immutable recipe versions.
- [x] Define plan slots, component yields, and allocation constraints.
- [x] Add repository helpers that always scope household data.

Acceptance: a new local database can be created and seeded from documented commands; invalid quantities and cross-household references are rejected.

### Phase 2: Reviewed recipe and transformation catalog

Current slice: 12 dinners and 4 transformed lunches are seeded and browsable. Two disjoint six-dinner selections, each with two transformed lunches, are covered by catalog tests. Automatic week generation now saves a draft with linked lunches; the larger catalog target remains open.

- [ ] Seed approximately 24 varied dinner recipes and 8–12 reviewed lunch transformations, with complete quantities, steps, tags, timings, and provenance.
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

### Phase 6: End-to-end readiness

- [ ] Verify mobile layout, keyboard navigation, readable recipes, grocery checkboxes, loading, and recoverable errors.
- [ ] Test the complete default-household journey: generate, swap, shop, cook, consume lunch, react, generate another week.
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
