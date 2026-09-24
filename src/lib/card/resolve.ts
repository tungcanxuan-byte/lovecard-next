import { tiktokHandle, tiktokUrl, zaloUrl, DEFAULT_BANK, type Contacts } from "@/lib/brand";
import type {
  CardContent,
  CardDoc,
  ElementOverride,
  FieldBinding,
  GalleryItem,
  ResolvedElements,
} from "./types";

/** Labels for quick-edit field keys, in the order the editor lists them. */
export const FIELD_LABELS: Record<string, string> = {
  groomName: "Tên chú rể",
  brideName: "Tên cô dâu",
  groomFullName: "Họ tên chú rể",
  brideFullName: "Họ tên cô dâu",
  groomInitial: "Chữ cái chú rể",
  brideInitial: "Chữ cái cô dâu",
  groomFather: "Bố chú rể",
  groomMother: "Mẹ chú rể",
  brideFather: "Bố cô dâu",
  brideMother: "Mẹ cô dâu",
  groomVenue: "Địa chỉ nhà trai",
  brideVenue: "Địa chỉ nhà gái",
  groomBankOwner: "Chủ tài khoản (nhà trai)",
  groomBankNumber: "Số tài khoản (nhà trai)",
  groomBankName: "Ngân hàng (nhà trai)",
  brideBankOwner: "Chủ tài khoản (nhà gái)",
  brideBankNumber: "Số tài khoản (nhà gái)",
  brideBankName: "Ngân hàng (nhà gái)",
};

/** Couple shown on template demos and prefilled into new cards. */
export const DEFAULT_FIELDS: Record<string, string> = {
  groomName: "Xuân Tùng",
  brideName: "Phương Anh",
  groomFullName: "Cấn Xuân Tùng",
  brideFullName: "Trần Thị Phương Anh",
  groomInitial: "T",
  brideInitial: "A",
  // Gifts go to the site owner's account until the couple enters their own.
  groomBankOwner: DEFAULT_BANK.owner,
  groomBankNumber: DEFAULT_BANK.number,
  groomBankName: DEFAULT_BANK.name,
  brideBankOwner: DEFAULT_BANK.owner,
  brideBankNumber: DEFAULT_BANK.number,
  brideBankName: DEFAULT_BANK.name,
};

export const DEFAULT_PHOTOS = Array.from(
  { length: 16 },
  (_, i) => `/defaults/photos/couple-${String(i + 1).padStart(2, "0")}.jpg`,
);

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isUpper = (s: string) => s === s.toUpperCase() && s !== s.toLowerCase();

type Sub = { find: string; value: string };

/** Replaces every `find` with its value in one pass (longest first, so names never re-match). */
function substitute(text: string, subs: Sub[], html: boolean): string {
  if (!subs.length) return text;
  // Some templates store Vietnamese text decomposed (NFD); compare in composed form.
  text = text.normalize("NFC");
  const sorted = [...subs].sort((a, b) => b.find.length - a.find.length);
  // Templates space names with runs of spaces or &nbsp;, so any whitespace run in a find matches any run.
  const space = html ? "(?:\\s|&nbsp;)+" : "\\s+";
  const re = new RegExp(sorted.map((s) => `(${s.find.normalize("NFC").trim().split(/\s+/).map(escapeRe).join(space)})`).join("|"), "g");
  const replace = (part: string) =>
    part.replace(re, (m, ...groups: unknown[]) => {
      const i = groups.findIndex((g, n) => n < sorted.length && g !== undefined);
      const { find, value } = sorted[i] ?? { find: m, value: m };
      const cased = isUpper(find) ? value.toUpperCase() : value;
      return html ? escapeHtml(cased) : cased;
    });
  // Only touch text between tags so attributes and markup stay intact.
  return html ? text.split(/(<[^>]*>)/).map((p, i) => (i % 2 ? p : replace(p))).join("") : replace(text);
}

export function vietQrUrl(bankName: string, bankNumber: string, bankOwner?: string): string {
  const b = bankName.trim().replace(/\s+/g, "");
  const n = bankNumber.trim();
  const o = encodeURIComponent((bankOwner ?? "").trim());
  return `https://img.vietqr.io/image/${b}-${n}-compact2.png?amount=0&addInfo=Mung%20cuoi${o ? `&accountName=${o}` : ""}`;
}

/** Applies quick-edit fields, per-element overrides and the event date to the template defaults. */
export function resolveElements(doc: Pick<CardDoc, "elements">, bindings: FieldBinding[], content: CardContent): ResolvedElements {
  const out: ResolvedElements = {};
  for (const [id, m] of Object.entries(doc.elements)) out[id] = { ...m };

  const subsById = new Map<string, { text: Sub[]; action: Sub[] }>();
  for (const b of bindings) {
    const value = content.fields?.[b.key]?.trim();
    if (!value) continue;
    for (const t of b.targets) {
      const entry = subsById.get(t.id) ?? { text: [], action: [] };
      (t.action ? entry.action : entry.text).push({ find: t.find, value });
      subsById.set(t.id, entry);
    }
  }
  for (const [id, subs] of subsById) {
    const el = out[id];
    if (!el) continue;
    if (el.text != null) el.text = substitute(el.text, subs.text, true);
    if (subs.action.length && el.actions) {
      // Some templates copy an unrelated number (LoveCard's hotline); a bound copy always copies the field.
      el.actions = el.actions.map((a) => {
        if (a.type !== "copy") return a;
        const text = substitute(a.text, subs.action, false);
        return { ...a, text: text === a.text.normalize("NFC") ? subs.action[0].value : text };
      });
    }
  }

  // Auto-generate VietQR for bank QR elements
  const groomBankNumber = content.fields?.groomBankNumber?.trim() || DEFAULT_FIELDS.groomBankNumber;
  const groomBankName = content.fields?.groomBankName?.trim() || DEFAULT_FIELDS.groomBankName;
  const groomBankOwner = content.fields?.groomBankOwner?.trim() || DEFAULT_FIELDS.groomBankOwner;
  const groomQr = groomBankNumber && groomBankName ? vietQrUrl(groomBankName, groomBankNumber, groomBankOwner) : null;

  for (const [id, el] of Object.entries(out)) {
    if (el.image === "/defaults/bank-qr.jpg" || el.image?.includes("bank-qr")) {
      if (groomQr) el.image = groomQr;
    }
  }

  for (const [id, o] of Object.entries(content.overrides ?? {})) {
    const el = out[id];
    if (!el) continue;
    if (o.text != null) el.text = o.text;
    if (o.image) el.image = o.image;
    if (o.gallery) el.gallery = o.gallery;
    if (o.hidden) el.hidden = true;
    if (o.copy != null && el.actions) el.actions = el.actions.map((a) => (a.type === "copy" ? { ...a, text: o.copy! } : a));
    if (o.href != null && el.actions) el.actions = el.actions.map((a) => (a.type === "link" ? { ...a, href: o.href! } : a));
  }

  if (content.eventAt) {
    for (const el of Object.values(out)) if (el.countdown) el.countdown = { end: content.eventAt };
  }
  return out;
}

/** Points the template's contact links and texts at the site's current contacts; empty ones are hidden. */
export function applyContacts(elements: CardDoc["elements"], contacts: Contacts): CardDoc["elements"] {
  const out: CardDoc["elements"] = {};
  for (const [id, m] of Object.entries(elements)) {
    if (!m.contact) {
      out[id] = m;
      continue;
    }
    const value = contacts[m.contact].trim();
    const el = { ...m };
    if (!value) el.hidden = true;
    const href = m.contact === "zalo" ? zaloUrl(value) : m.contact === "tiktok" ? tiktokUrl(value) : value;
    el.actions = el.actions?.map((a) =>
      a.type === "link" ? { ...a, href } : a.type === "phone" ? { ...a, phone: value } : a,
    );
    if (el.text && m.contact === "hotline") el.text = el.text.replace(/\b0\d{9,10}\b/g, escapeHtml(value));
    if (el.text && m.contact === "tiktok") el.text = el.text.replace(/@[\w.]*/g, tiktokHandle(value));
    out[id] = el;
  }
  return out;
}

/** CSS for per-element colour overrides (values are validated #hex on save). */
export function overrideCss(content: CardContent): string {
  const rules: string[] = [];
  for (const [id, o] of Object.entries(content.overrides ?? {})) {
    if (!/^[\w-]+$/.test(id)) continue;
    const hex = (v?: string) => (v && /^#[0-9a-f]{3,8}$/i.test(v) ? v : null);
    const color = hex(o.color);
    const background = hex(o.background);
    if (color) {
      rules.push(`#${id} .ladi-headline, #${id} .ladi-paragraph, #${id} .ladi-list-paragraph, #${id} .ladi-countdown-text { color: ${color} !important; }`);
      rules.push(`#${id} .ladi-shape svg, #${id} .ladi-shape svg * { fill: ${color} !important; }`);
    }
    if (background) {
      rules.push(`#${id} > .ladi-section-background, #${id} > .ladi-box, #${id} .ladi-button-background, #${id} > .ladi-frame-background { background: ${background} !important; }`);
    }
  }
  return rules.join("\n");
}

/** Top-level sections in display order (hidden ones included; the renderer hides them). */
export function orderedSections(doc: Pick<CardDoc, "sections">, content: CardContent): string[] {
  const order = (content.sections ?? []).filter((id) => doc.sections.includes(id));
  return [...order, ...doc.sections.filter((id) => !order.includes(id))];
}

/** Template defaults with the sample photos swapped for the default couple photos. */
export function defaultContent(doc: CardDoc): CardContent {
  const overrides: Record<string, ElementOverride> = {};
  const assigned = new Map<string, string>(); // original url → default photo, so repeated photos stay identical
  let next = 0;
  const photoFor = (original: string | undefined) => {
    const key = original ?? `#${next}`;
    if (!assigned.has(key)) assigned.set(key, DEFAULT_PHOTOS[next++ % DEFAULT_PHOTOS.length]);
    return assigned.get(key)!;
  };
  for (const slot of doc.photos) {
    const [id, index] = slot.split("#");
    const el = doc.elements[id];
    if (!el) continue;
    if (index === undefined) {
      overrides[id] = { ...overrides[id], image: photoFor(el.image) };
    } else if (el.gallery) {
      const gallery: GalleryItem[] = overrides[id]?.gallery ?? el.gallery.map((g) => ({ ...g }));
      const photo = photoFor(el.gallery[Number(index)]?.src);
      gallery[Number(index)] = { src: photo, thumb: photo };
      overrides[id] = { ...overrides[id], gallery };
    }
  }
  return { fields: { ...DEFAULT_FIELDS }, overrides };
}

/** The template's own music URL (first <source> of the music <audio>), if any. */
export function defaultMusic(doc: CardDoc): string | null {
  let found: string | null = null;
  const walk = (n: CardDoc["tree"][number]): void => {
    if (found || typeof n === "string") return;
    const [tag, props, ...children] = n;
    if (tag === "audio" && props?.$b === "music-audio") {
      const src = (props.src as string | undefined) ?? children.find((c): c is Exclude<typeof c, string> => typeof c !== "string" && c[0] === "source")?.[1]?.src;
      if (typeof src === "string") found = src;
      return;
    }
    children.forEach(walk);
  };
  doc.tree.forEach(walk);
  return found;
}
