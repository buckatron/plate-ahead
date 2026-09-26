import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lookup: vi.fn(), request: vi.fn(), createDraft: vi.fn(), findFirst: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:https", () => ({ request: mocks.request }));
vi.mock("../../src/services/personal-recipes", () => ({
  createDraft: mocks.createDraft, PersonalRecipeError: class PersonalRecipeError extends Error {},
}));
vi.mock("../../src/services/prisma", () => ({ prisma: { recipe: { findFirst: mocks.findFirst } } }));

import { importRecipeUrl, previewRecipePage } from "../../src/services/import-recipe";

function reply(statusCode: number, headers: Record<string, string>, body = "") {
  return (_url: unknown, _options: unknown, onResponse: (response: EventEmitter) => void) => {
    const request = new EventEmitter() as EventEmitter & { end: () => void };
    request.end = () => {
      queueMicrotask(() => {
        const response = new EventEmitter() as EventEmitter & {
          statusCode: number; headers: Record<string, string>; resume: () => void; destroy: () => void;
        };
        response.statusCode = statusCode;
        response.headers = headers;
        response.resume = () => {};
        response.destroy = () => {};
        onResponse(response);
        response.emit("data", Buffer.from(body));
        response.emit("end");
      });
    };
    return request;
  };
}

describe("recipe URL import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
    mocks.findFirst.mockResolvedValue(null);
    mocks.createDraft.mockResolvedValue({ id: "new-draft" });
    mocks.request.mockImplementation(reply(200, { "content-type": "text/html" },
      `<script type=application/ld+json>${JSON.stringify({
            "@type": "Recipe", name: "Test supper", recipeIngredient: ["2 eggs"],
            recipeInstructions: "Cook the eggs.", recipeYield: "2 servings", totalTime: "PT10M",
          })}</script>`));
  });

  it("reuses the previewed page when creating a single-recipe draft", async () => {
    const url = "https://recipes.example/test";
    const preview = await previewRecipePage(url);
    expect(preview.recipes).toHaveLength(1);
    expect(await importRecipeUrl("home", url, 0, preview)).toEqual({ id: "new-draft" });
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(mocks.createDraft).toHaveBeenCalledWith("home", expect.objectContaining({ title: "Test supper" }),
      expect.objectContaining({ submittedUrl: url, finalUrl: url }));
  });

  it("rejects a redirect to a private address before requesting it", async () => {
    mocks.lookup.mockImplementation(async (host: string) => [{ address: host === "127.0.0.1" ? "127.0.0.1" : "8.8.8.8", family: 4 }]);
    mocks.request.mockImplementationOnce(reply(302, { location: "http://127.0.0.1/secret" }));
    await expect(previewRecipePage("https://recipes.example/test")).rejects.toThrow("public website");
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });

  it("rejects oversized responses before reading their body", async () => {
    mocks.request.mockImplementation(reply(200, { "content-type": "text/html", "content-length": "2000001" }));
    await expect(previewRecipePage("https://recipes.example/test")).rejects.toThrow("too large");
  });
});
