import "server-only";
import { eq } from "drizzle-orm";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { cache } from "react";
import { z } from "zod";
import { DEFAULT_CONTACTS, type Contacts } from "@/lib/brand";
import { getDb, schema } from "@/lib/db";

const { settings } = schema;

const contactsSchema = z.object({
  hotline: z.string().trim().regex(/^(\+?\d[\d .]{7,15})?$/, "Số hotline không hợp lệ"),
  zalo: z.string().trim().regex(/^(\+?\d[\d .]{7,15})?$/, "Số Zalo không hợp lệ"),
  facebook: z.union([z.literal(""), z.string().trim().url("Link Facebook không hợp lệ").regex(/^https:\/\//, "Link phải bắt đầu bằng https://")]),
  tiktok: z.string().trim().regex(/^(https:\/\/(www\.)?tiktok\.com\/@[\w.]+\/?|@?[\w.]+)?$/, "TikTok: nhập link tiktok.com/@tên hoặc @tên"),
});

/** Site contacts (hotline, Zalo, Facebook, TikTok) shown on templates. Build-time renders use the defaults. */
export const getContacts = cache(async (): Promise<Contacts> => {
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) return DEFAULT_CONTACTS;
  try {
    const db = await getDb();
    const [row] = await db.select().from(settings).where(eq(settings.key, "contacts"));
    const saved = contactsSchema.partial().safeParse(row?.value ?? {});
    return { ...DEFAULT_CONTACTS, ...(saved.success ? saved.data : {}) };
  } catch (err) {
    console.error("Could not load contacts, using defaults", err);
    return DEFAULT_CONTACTS;
  }
});

export async function saveContacts(input: Record<keyof Contacts, unknown>): Promise<{ error?: string }> {
  const parsed = contactsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  const db = await getDb();
  await db
    .insert(settings)
    .values({ key: "contacts", value: parsed.data })
    .onConflictDoUpdate({ target: settings.key, set: { value: parsed.data, updatedAt: new Date() } });
  return {};
}
