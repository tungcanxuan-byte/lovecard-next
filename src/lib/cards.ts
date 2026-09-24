import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, ne, or } from "drizzle-orm";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth/server";
import { getDoc } from "@/lib/card/docs";
import { DEFAULT_FIELDS, defaultContent } from "@/lib/card/resolve";
import type { CardContent } from "@/lib/card/types";
import { getDb, schema } from "@/lib/db";
import type { Card, CardStatus } from "@/lib/db/schema";

const { cards, wishes, user } = schema;

// ---------------------------------------------------------------------------------------------
// Validation

/** Same-site path or https URL, with nothing that could break out of a CSS url(). */
const assetUrl = z
  .string()
  .max(2000)
  .regex(/^(\/|https:\/\/)[^\s"'()\\<>]*$/, "URL không hợp lệ");
const href = z
  .string()
  .max(2000)
  .regex(/^(https?:\/\/|tel:|mailto:|\/|#)[^\s"'<>]*$/i, "Liên kết không hợp lệ");
const hex = z.string().regex(/^#[0-9a-f]{3,8}$/i);

const overrideSchema = z
  .object({
    text: z.string().max(20000).optional(),
    image: assetUrl.optional(),
    gallery: z.array(z.object({ src: assetUrl, thumb: assetUrl })).max(80).optional(),
    hidden: z.boolean().optional(),
    copy: z.string().max(500).optional(),
    href: href.optional(),
    color: hex.optional(),
    background: hex.optional(),
  })
  .strict();

export const contentSchema = z
  .object({
    fields: z.record(z.string().max(40), z.string().max(300)).optional(),
    overrides: z.record(z.string().regex(/^[\w-]{1,64}$/), overrideSchema).optional(),
    sections: z.array(z.string().max(64)).max(200).optional(),
    music: assetUrl.nullable().optional(),
    eventAt: z.number().int().nullable().optional(),
  })
  .strict();

export const slugSchema = z
  .string()
  .trim()
  .min(3, "Đường dẫn cần ít nhất 3 ký tự")
  .max(60, "Đường dẫn tối đa 60 ký tự")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Chỉ dùng chữ thường không dấu, số và dấu gạch ngang");

/** Inline formatting LadiPage headlines use; anything else is stripped from edited text. */
const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: ["br", "b", "strong", "i", "em", "u", "s", "span", "font", "div", "p", "ul", "ol", "li", "a", "sup", "sub"],
  allowedAttributes: { span: ["style"], div: ["style"], p: ["style"], font: ["color", "face", "size"], a: ["href", "target"] },
  allowedStyles: {
    "*": {
      color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i],
      "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i],
      "font-weight": [/^(bold|normal|\d{3})$/],
      "font-style": [/^(italic|normal)$/],
      "text-decoration": [/^[a-z\s-]+$/],
      "text-decoration-line": [/^[a-z\s-]+$/],
      "font-size": [/^\d+(\.\d+)?(px|em|rem|%)$/],
      "font-family": [/^[\w\s,'"-]+$/],
      "text-align": [/^(left|right|center|justify)$/],
      "line-height": [/^[\d.]+(px|em|%)?$/],
      "letter-spacing": [/^-?[\d.]+(px|em)$/],
    },
  },
  allowedSchemes: ["http", "https", "tel", "mailto"],
};

/** Parses untrusted editor content: schema check, then rich text is sanitized. */
export function parseContent(input: unknown): CardContent {
  const content = contentSchema.parse(input);
  for (const o of Object.values(content.overrides ?? {})) {
    if (o.text != null) o.text = sanitizeHtml(o.text, SANITIZE);
  }
  return content;
}

// ---------------------------------------------------------------------------------------------
// Queries

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function slugTaken(slug: string, exceptId?: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ id: cards.id })
    .from(cards)
    .where(exceptId ? and(eq(cards.slug, slug), ne(cards.id, exceptId)) : eq(cards.slug, slug))
    .limit(1);
  return rows.length > 0;
}

export async function createCard(owner: SessionUser, template: string): Promise<Card> {
  const doc = await getDoc(template);
  if (!doc) throw new Error("Mẫu thiệp không tồn tại");
  const db = await getDb();
  const base = slugify(`${DEFAULT_FIELDS.groomName} ${DEFAULT_FIELDS.brideName}`);
  let slug = "";
  do slug = `${base}-${randomUUID().slice(0, 6)}`;
  while (await slugTaken(slug));
  const [card] = await db
    .insert(cards)
    .values({
      id: randomUUID(),
      ownerId: owner.id,
      slug,
      template,
      title: `${DEFAULT_FIELDS.groomName} & ${DEFAULT_FIELDS.brideName}`,
      content: defaultContent(doc),
    })
    .returning();
  return card;
}

export async function getCard(id: string): Promise<Card | null> {
  const db = await getDb();
  const [card] = await db.select().from(cards).where(eq(cards.id, id)).limit(1);
  return card ?? null;
}

export async function getCardBySlug(slug: string): Promise<Card | null> {
  const db = await getDb();
  const [card] = await db.select().from(cards).where(eq(cards.slug, slug)).limit(1);
  return card ?? null;
}

/** Short code the owner puts in the bank transfer note, so admins can match payments to cards. */
export const orderCode = (card: Pick<Card, "id">) => `WC${card.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

export const canEdit = (card: Card, viewer: SessionUser | null) => !!viewer && (viewer.isAdmin || card.ownerId === viewer.id);

/** Card the viewer may edit, or null (missing or not theirs). */
export async function getEditableCard(id: string, viewer: SessionUser): Promise<Card | null> {
  const card = await getCard(id);
  return card && canEdit(card, viewer) ? card : null;
}

export async function listOwnCards(ownerId: string): Promise<Card[]> {
  const db = await getDb();
  return db.select().from(cards).where(eq(cards.ownerId, ownerId)).orderBy(desc(cards.updatedAt));
}

export async function listAllCards() {
  const db = await getDb();
  return db
    .select({ card: cards, ownerEmail: user.email, ownerName: user.name, ownerIsGuest: user.isAnonymous })
    .from(cards)
    .innerJoin(user, eq(user.id, cards.ownerId))
    .orderBy(desc(cards.updatedAt));
}

export async function updateCard(id: string, patch: { title?: string; slug?: string; content?: CardContent }) {
  const db = await getDb();
  await db
    .update(cards)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(cards.id, id));
}

export async function setCardStatus(id: string, status: CardStatus) {
  const db = await getDb();
  await db.update(cards).set({ status, updatedAt: new Date() }).where(eq(cards.id, id));
}

/** Owner says they transferred the payment (kept once set). */
export async function markCardPaid(id: string) {
  const db = await getDb();
  await db.update(cards).set({ paidAt: new Date() }).where(and(eq(cards.id, id), isNull(cards.paidAt)));
}

export async function deleteCard(id: string) {
  const db = await getDb();
  await db.delete(cards).where(eq(cards.id, id));
}

// ---------------------------------------------------------------------------------------------
// Wishes

export const wishSchema = z.object({
  name: z.string().trim().min(1).max(80),
  message: z.string().trim().max(1000).default(""),
  attendance: z.string().trim().max(300).optional(),
});

export async function listWishes(cardId: string, limit = 200) {
  const db = await getDb();
  return db
    .select({ name: wishes.name, message: wishes.message, attendance: wishes.attendance, createdAt: wishes.createdAt })
    .from(wishes)
    .where(eq(wishes.cardId, cardId))
    .orderBy(desc(wishes.createdAt))
    .limit(limit);
}

export async function addWish(cardId: string, wish: z.infer<typeof wishSchema>) {
  const db = await getDb();
  await db.insert(wishes).values({ id: randomUUID(), cardId, ...wish, attendance: wish.attendance || null });
}

// ---------------------------------------------------------------------------------------------
// Users (admin)

export async function listUsers() {
  const db = await getDb();
  return db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt })
    .from(user)
    .where(or(isNull(user.isAnonymous), eq(user.isAnonymous, false))) // guests show up on their cards instead
    .orderBy(desc(user.createdAt));
}

export async function setUserRole(id: string, role: "user" | "admin") {
  const db = await getDb();
  await db.update(user).set({ role, updatedAt: new Date() }).where(eq(user.id, id));
}
