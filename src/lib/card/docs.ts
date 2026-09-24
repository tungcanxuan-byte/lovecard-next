import "server-only";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import type { CardDoc, FieldBinding } from "./types";

const DOCS_DIR = path.join(process.cwd(), "src/data/docs");
const FIELDS_DIR = path.join(process.cwd(), "src/data/template-fields");

/** Slug of the gallery page (lovecard.click root), served at "/". */
export const HOME_SLUG = "home";

const validSlug = (slug: string) => /^[\w-]+$/.test(slug);

export const listTemplateSlugs = cache(async (): Promise<string[]> => {
  const files = await readdir(DOCS_DIR);
  return files.filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).filter((s) => s !== HOME_SLUG);
});

export const getDoc = cache(async (slug: string): Promise<CardDoc | null> => {
  if (!validSlug(slug)) return null;
  try {
    return JSON.parse(await readFile(path.join(DOCS_DIR, `${slug}.json`), "utf8")) as CardDoc;
  } catch {
    return null;
  }
});

export const getFieldBindings = cache(async (slug: string): Promise<FieldBinding[]> => {
  if (!validSlug(slug)) return [];
  try {
    const data = JSON.parse(await readFile(path.join(FIELDS_DIR, `${slug}.json`), "utf8")) as { fields: FieldBinding[] };
    return data.fields ?? [];
  } catch {
    return [];
  }
});

/** Template picker data: slug, title and preview image (og:image). */
export const listTemplates = cache(async () => {
  const slugs = await listTemplateSlugs();
  const docs = await Promise.all(slugs.map(getDoc));
  return docs
    .filter((d): d is CardDoc => !!d)
    .map((d) => ({
      slug: d.slug,
      title: d.title,
      image: d.meta.find((m) => m.property === "og:image")?.content ?? null,
    }));
});

/** Every template's background song, offered as music choices in the editor. */
export const listMusic = cache(async (): Promise<Array<{ url: string; label: string }>> => {
  const { defaultMusic } = await import("./resolve");
  const docs = await Promise.all((await listTemplateSlugs()).map(getDoc));
  const urls = [...new Set(docs.map((d) => d && defaultMusic(d)).filter((u): u is string => !!u))];
  return urls.map((url) => {
    const file = decodeURIComponent(url.split("/").pop() ?? url).replace(/\.[a-z0-9]+$/i, "");
    return { url, label: file.replace(/[-_]+/g, " ") };
  });
});
