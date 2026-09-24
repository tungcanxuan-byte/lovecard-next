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

const orderSchema = z.object({ price: z.string().trim().max(60, "Giá thiệp tối đa 60 ký tự") });

export type OrderSettings = z.infer<typeof orderSchema>;

/** Stored value merged over the defaults. Build-time renders use the defaults. */
async function readSetting<T extends object>(key: string, schema: z.ZodObject, defaults: T): Promise<T> {
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) return defaults;
  try {
    const db = await getDb();
    const [row] = await db.select().from(settings).where(eq(settings.key, key));
    const saved = schema.partial().safeParse(row?.value ?? {});
    return { ...defaults, ...(saved.success ? saved.data : {}) };
  } catch (err) {
    console.error(`Could not load setting "${key}", using defaults`, err);
    return defaults;
  }
}

async function saveSetting(key: string, schema: z.ZodObject, input: unknown): Promise<{ error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  const db = await getDb();
  await db
    .insert(settings)
    .values({ key, value: parsed.data })
    .onConflictDoUpdate({ target: settings.key, set: { value: parsed.data, updatedAt: new Date() } });
  return {};
}

/** Site contacts (hotline, Zalo, Facebook, TikTok) shown on templates and the order page. */
export const getContacts = cache(() => readSetting<Contacts>("contacts", contactsSchema, DEFAULT_CONTACTS));

/** Order page settings; an empty price means "ask the admin". */
export const getOrderSettings = cache(() => readSetting<OrderSettings>("order", orderSchema, { price: "" }));

export const saveContacts = (input: Record<keyof Contacts, unknown>) => saveSetting("contacts", contactsSchema, input);
export const saveOrderSettings = (input: Record<keyof OrderSettings, unknown>) => saveSetting("order", orderSchema, input);
