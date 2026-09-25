import "server-only";

import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { createDraft, PersonalRecipeError } from "./personal-recipes";
import { extractRecipeJsonLd } from "@/domain/meals/recipe-jsonld";
import { publicImportAddress } from "@/domain/meals/public-import-address";
import type { RecipeDraftData } from "@/domain/meals/personal-recipe";

async function fetchHtml(rawUrl: string, redirects = 0): Promise<{ html: string; url: string }> {
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new PersonalRecipeError("Enter a complete recipe URL."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || !url.hostname || url.port) {
    throw new PersonalRecipeError("Use a public http or https recipe link without credentials or a custom port.");
  }
  const addresses = await lookup(url.hostname, { all: true, verbatim: true }).catch(() => []);
  if (!addresses.length || addresses.some((item) => !publicImportAddress(item.address))) {
    throw new PersonalRecipeError("This link does not resolve to a public website.");
  }
  const selected = addresses[0];
  return new Promise((resolve, reject) => {
    const requester = url.protocol === "https:" ? httpsRequest : httpRequest;
    const req = requester(url, { method: "GET", timeout: 8000,
      headers: { "User-Agent": "MisewellRecipeImport/1.0", Accept: "text/html", "Accept-Encoding": "identity" },
      lookup: (_hostname, _options, callback) => callback(null, selected.address, selected.family),
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirects >= 3) return reject(new PersonalRecipeError("This link redirects too many times."));
        return void fetchHtml(new URL(res.headers.location, url).href, redirects + 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new PersonalRecipeError(`The recipe site returned ${res.statusCode ?? "an error"}.`)); }
      if (!(res.headers["content-type"] ?? "").includes("text/html")) { res.resume(); return reject(new PersonalRecipeError("This link did not return a recipe page.")); }
      if (Number(res.headers["content-length"] ?? 0) > 2_000_000) { res.destroy(); return reject(new PersonalRecipeError("This page is too large to import.")); }
      let bytes = 0;
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > 2_000_000) { res.destroy(); reject(new PersonalRecipeError("This page is too large to import.")); }
        else chunks.push(chunk);
      });
      res.on("end", () => resolve({ html: Buffer.concat(chunks).toString("utf8"), url: url.href }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new PersonalRecipeError("The recipe site took too long to respond.")));
    req.on("error", reject);
    req.end();
  });
}

export async function previewRecipeUrl(url: string): Promise<RecipeDraftData[]> {
  const result = await fetchHtml(url);
  return extractRecipeJsonLd(result.html, result.url);
}

function comparableUrl(raw: string): string {
  const url = new URL(raw);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || ["fbclid", "gclid", "mc_cid", "mc_eid"].includes(key.toLowerCase())) url.searchParams.delete(key);
  }
  return url.href;
}

export async function importRecipeUrl(householdId: string, url: string, selection = 0) {
  const result = await fetchHtml(url);
  const recipes = extractRecipeJsonLd(result.html, result.url);
  if (!recipes.length) throw new PersonalRecipeError("No structured recipe was found. Paste the ingredient and instruction text into a manual draft.");
  if (selection < 0 || selection >= recipes.length) throw new PersonalRecipeError("Choose a recipe from this page.");
  const existing = await prismaRecipeByUrl(householdId, comparableUrl(result.url));
  if (existing) throw new PersonalRecipeError(`You already imported this link: ${existing.title}. Open it from your recipe library to edit it.`);
  const recipe = recipes[selection];
  return createDraft(householdId, { ...recipe, sourceUrl: comparableUrl(result.url) }, {
    submittedUrl: url, finalUrl: result.url, importedAt: new Date().toISOString(),
    title: recipe.title, yieldText: recipe.originalYield, ingredientLines: recipe.ingredientLines,
    steps: recipe.steps, extractionMethod: "schema-org-json-ld-v1",
  });
}

async function prismaRecipeByUrl(householdId: string, sourceUrl: string) {
  const { prisma } = await import("./prisma");
  return prisma.recipe.findFirst({ where: { sourceUrl, entry: { householdId, archivedAt: null } }, select: { title: true } });
}
