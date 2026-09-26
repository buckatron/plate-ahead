"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { draftSchema, manualDraftFromUrl } from "@/domain/meals/personal-recipe";
import { prisma } from "@/services/prisma";
import { importRecipeUrl, previewRecipePage } from "@/services/import-recipe";
import { createDraft, createRevisionDraft, ensureRecipeEntry, pairPersonalRecipes, PersonalRecipeError, publishDraft, saveDraft, setRecipeArchived } from "@/services/personal-recipes";

const errorText = (cause: unknown) => cause instanceof PersonalRecipeError ? cause.message : "Could not save the recipe. Please try again.";
const toLines = (value: FormDataEntryValue | null) => typeof value === "string" ? value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [];

export async function createRecipeDraftAction() {
  const draft = await createDraft("home");
  redirect(`/recipes/drafts/${draft.id}`);
}

export async function createRecipeDraftFromUrlAction(formData: FormData) {
  const url = String(formData.get("url") ?? "").trim();
  const payload = manualDraftFromUrl(url);
  if (!payload) redirect(`/recipes/new?${new URLSearchParams({ importError: "Use a valid http or https source link without credentials or a custom port.", url })}`);
  const draft = await createDraft("home", payload);
  redirect(`/recipes/drafts/${draft.id}`);
}

export async function importRecipeAction(formData: FormData) {
  const url = String(formData.get("url") ?? "").trim();
  try {
    const selected = formData.get("selection");
    const preview = selected === null ? await previewRecipePage(url) : undefined;
    if (preview && preview.recipes.length > 1) redirect(`/recipes/import/choose?url=${encodeURIComponent(url)}`);
    const draft = await importRecipeUrl("home", url, selected === null ? 0 : Number(selected), preview);
    redirect(`/recipes/drafts/${draft.id}`);
  } catch (cause) {
    if (cause && typeof cause === "object" && "digest" in cause) throw cause;
    const params = new URLSearchParams({ importError: errorText(cause), url });
    redirect(`/recipes/new?${params}`);
  }
}

export async function saveRecipeDraftAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const revision = Number(formData.get("revision"));
  const parsed = draftSchema.safeParse({
    schemaVersion: 1,
    title: formData.get("title"), summary: formData.get("summary"), role: formData.get("role"),
    servings: Number(formData.get("servings")), totalMinutes: Number(formData.get("totalMinutes")),
    activeMinutes: Number(formData.get("activeMinutes")), cuisine: formData.get("cuisine"),
    reservable: formData.get("reservable") === "1",
    storageGuidance: formData.get("storageGuidance"), storageSourceUrl: formData.get("storageSourceUrl"),
    ingredientLines: toLines(formData.get("ingredientLines")), steps: toLines(formData.get("steps")),
    ingredientChoices: Object.fromEntries([...formData.keys()].filter((key) => key.startsWith("match:")).map((key) => {
      const itemKey = key.slice(6);
      return [itemKey, { ingredientId: String(formData.get(key) ?? ""),
        category: String(formData.get(`category:${itemKey}`) ?? "Other"),
        original: String(formData.get(`original:${itemKey}`) ?? "") }];
    })),
    components: Array.from({ length: 4 }, (_, index) => ({
      name: String(formData.get(`componentName:${index}`) ?? "").trim(),
      yieldAmount: Number(formData.get(`componentYield:${index}`)),
      yieldUnit: formData.get(`componentUnit:${index}`),
      ingredientLines: toLines(formData.get(`componentIngredients:${index}`)),
      preparation: formData.get(`componentPreparation:${index}`),
      reservable: formData.get(`componentReservable:${index}`) === "1",
      storageGuidance: formData.get(`componentStorage:${index}`),
      storageSourceUrl: formData.get(`componentStorageUrl:${index}`),
    })).filter((component) => component.name),
    sourceUrl: formData.get("sourceUrl"), sourceAttribution: formData.get("sourceAttribution"),
    originalYield: formData.get("originalYield"), origin: formData.get("origin"),
  });
  if (!parsed.success || !Number.isInteger(revision)) redirect(`/recipes/drafts/${id}?error=Check%20the%20recipe%20fields.`);
  try {
    await saveDraft("home", id, revision, parsed.data);
    if (formData.get("intent") === "publish") {
      const key = await publishDraft("home", id, revision + 1);
      revalidatePath("/recipes");
      revalidatePath("/");
      redirect(`/recipes/${key}`);
    }
  } catch (cause) {
    if (cause && typeof cause === "object" && "digest" in cause) throw cause;
    redirect(`/recipes/drafts/${id}?error=${encodeURIComponent(errorText(cause))}`);
  }
  redirect(`/recipes/drafts/${id}?saved=1`);
}

export async function editRecipeAction(formData: FormData) {
  try {
    const draft = await createRevisionDraft("home", String(formData.get("recipeKey") ?? ""));
    redirect(`/recipes/drafts/${draft.id}`);
  } catch (cause) {
    if (cause && typeof cause === "object" && "digest" in cause) throw cause;
    redirect(`/recipes?error=${encodeURIComponent(errorText(cause))}`);
  }
}

export async function archiveRecipeAction(formData: FormData) {
  try {
    const entry = await ensureRecipeEntry("home", String(formData.get("recipeKey") ?? ""));
    await setRecipeArchived("home", entry.id, formData.get("archived") === "1");
    revalidatePath("/recipes");
    revalidatePath("/");
  } catch (cause) {
    redirect(`/recipes?error=${encodeURIComponent(errorText(cause))}`);
  }
  redirect("/recipes");
}

export async function setPrototypeRecipesAction(formData: FormData) {
  await prisma.householdPreferences.update({ where: { householdId: "home" },
    data: { includePrototypeRecipes: formData.get("include") === "1" } });
  revalidatePath("/recipes");
  revalidatePath("/");
  redirect("/recipes");
}

export async function pairRecipesAction(formData: FormData) {
  try {
    await pairPersonalRecipes({ householdId: "home", sourceComponentId: String(formData.get("sourceComponentId") ?? ""),
      targetComponentId: String(formData.get("targetComponentId") ?? ""), requiredAmount: Number(formData.get("requiredAmount")),
      description: String(formData.get("description") ?? ""), compatibleState: String(formData.get("compatibleState") ?? "") });
    revalidatePath("/recipes");
    redirect("/recipes/pair?saved=1");
  } catch (cause) {
    if (cause && typeof cause === "object" && "digest" in cause) throw cause;
    redirect(`/recipes/pair?error=${encodeURIComponent(errorText(cause))}`);
  }
}

export async function setRecipePlanningAction(formData: FormData) {
  try {
    const entry = await ensureRecipeEntry("home", String(formData.get("recipeKey") ?? ""));
    await prisma.recipeEntry.update({ where: { id: entry.id },
      data: { includeInPlanning: formData.get("include") === "1" } });
  } catch (cause) {
    redirect(`/recipes?error=${encodeURIComponent(errorText(cause))}`);
  }
  revalidatePath("/recipes");
  revalidatePath("/");
  redirect("/recipes");
}
