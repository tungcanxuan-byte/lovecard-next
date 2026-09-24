import brand from "@/data/brand.json";

/** Site brand (also applied to templates by scripts/convert-templates.mjs). */
export const BRAND_NAME = brand.name;
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? brand.siteUrl;
export const BANK_QR = brand.bankQr;
export const DEFAULT_BANK = brand.bank;

export type ContactKey = "hotline" | "zalo" | "facebook" | "tiktok";
export type Contacts = Record<ContactKey, string>;

/** Contacts shown on templates until an admin changes them; empty ones are hidden. */
export const DEFAULT_CONTACTS: Contacts = brand.contacts;

export const zaloUrl = (phone: string) => `https://zalo.me/${phone.replace(/\D/g, "").replace(/^0/, "84")}`;

/** "@name" for a TikTok profile URL or handle. */
export const tiktokHandle = (value: string) => {
  const m = value.match(/@([\w.]+)/) ?? value.match(/^([\w.]+)$/);
  return m ? `@${m[1]}` : "";
};
export const tiktokUrl = (value: string) => {
  const handle = tiktokHandle(value);
  return /^https?:\/\//.test(value) ? value : handle ? `https://www.tiktok.com/${handle}` : "";
};
