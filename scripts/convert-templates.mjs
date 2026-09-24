// Converts scraped LadiPage templates (src/data/templates/*.json) into renderer documents
// (src/data/docs/*.json) that the React card renderer draws without any LadiPage JavaScript.
//
// A document keeps the exact LadiPage DOM (as a compact AST) so the template CSS still applies,
// and lifts everything dynamic or editable out of it:
//   - elements: per-element metadata keyed by LadiPage id (text html, image url, gallery, actions,
//     entrance animation, countdown, popup, tabs)
//   - features: behaviours LoveCard implemented as custom scripts (music, guest name, falling
//     snow/hearts, intro gate, anti-copy, guest wishes)
//
// AST node: string (text) | [tag, props | null, ...children]. Props use React names; keys starting
// with "$" are renderer hooks (see src/components/card/ast.tsx).
//
// Usage: node scripts/convert-templates.mjs [slug ...]
import * as cheerio from "cheerio";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import brand from "../src/data/brand.json" with { type: "json" };

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC_DIR = path.join(ROOT, "src/data/templates");
const OUT_DIR = path.join(ROOT, "src/data/docs");
const SITE_HOST_RE = /^https?:\/\/(?:www\.)?lovecard\.click\/?/;
const PHOTO_MIN_SIZE = 60;

// ---------------------------------------------------------------- CSS helpers

/** Splits a declaration block on ";" while respecting quotes and parentheses (data: URLs). */
function splitDeclarations(block) {
  const out = [];
  let depth = 0, quote = null, cur = "";
  for (const ch of block) {
    if (quote) { if (ch === quote) quote = null; }
    else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === ";" && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/** CSS property → React style key ("-webkit-foo" → "WebkitFoo", "-ms-foo" → "msFoo"). */
const camel = (prop) =>
  prop.startsWith("--") ? prop : prop.replace(/^-ms-/, "ms-").replace(/-([a-z])/g, (_, c) => c.toUpperCase());

function styleToObject(style) {
  const obj = {};
  for (const decl of splitDeclarations(style)) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const key = decl.slice(0, i).trim().toLowerCase();
    const value = decl.slice(i + 1).replace(/!important/i, "").trim();
    if (key && value) obj[camel(key)] = value;
  }
  return obj;
}

const urlOf = (block) => {
  const m = block.match(/background-image:\s*url\(\s*["']?([^"')]+)["']?\s*\)/);
  return m && !m[1].startsWith("data:") ? m[1] : null;
};
const px = (block, prop) => {
  const m = block.match(new RegExp(`(?:^|[;\\s{])${prop}:\\s*([\\d.]+)px`));
  return m ? Number(m[1]) : null;
};

/** Pulls default image URLs and element sizes out of the template CSS. */
function scanCss(css) {
  const images = new Map(); // element id → url (ladi-image / section / box background)
  const gallery = new Map(); // gallery id → [{ src, thumb }]
  const sizes = new Map(); // element id → { w, h }
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = m[1].split(",").map((s) => s.trim());
    const block = m[2];
    const url = urlOf(block);
    const w = px(block, "width"), h = px(block, "height");
    for (const sel of selectors) {
      let s;
      if ((w || h) && (s = sel.match(/^#([\w-]+)$/))) {
        const prev = sizes.get(s[1]) ?? {};
        sizes.set(s[1], { w: w ?? prev.w, h: h ?? prev.h });
      }
      if (!url) continue;
      if ((s = sel.match(/^#([\w-]+)\s*>\s*\.ladi-image\s*>\s*\.ladi-image-background$/))) images.set(s[1], url);
      else if ((s = sel.match(/^#([\w-]+)\s*>\s*\.ladi-(?:section-background|box|popup\s*>\s*\.ladi-popup-background)$/))) images.set(s[1], url);
      else if ((s = sel.match(/^#([\w-]+)\s+\.ladi-gallery\s+\.ladi-gallery-(view|control)-item\[data-index="(\d+)"\]$/))) {
        const list = gallery.get(s[1]) ?? [];
        const i = Number(s[3]);
        list[i] = { ...list[i], [s[2] === "view" ? "src" : "thumb"]: url };
        gallery.set(s[1], list);
      }
    }
  }
  return { images, gallery, sizes };
}

// ---------------------------------------------------------------- scripts → features

/** Recognises LoveCard's custom scripts and turns them into declarative feature config. */
function classifyScripts(scripts, warnings) {
  const features = {};
  for (const s of scripts) {
    if (s.src) continue; // LadiPage runtime and friends: replaced by the React renderer
    let code = s.code ?? "";
    // Some scripts are wrapped as base64 chunks: decode to classify.
    if (/^\s*\(function\(_0x\)\{var _0x1=\[/.test(code)) {
      code = Buffer.from([...code.matchAll(/"([A-Za-z0-9+/=]{8,})"/g)].map((x) => x[1]).join(""), "base64").toString();
    }
    if (/ladi_viewport=function|lazyload_run|LadiPageScript\.runtime/.test(code)) continue;
    let matched = false;
    const guest = code.match(/\.get\("(\w+)"\)[^:]*:\s*"([^"]*)"\s*,\s*\w+\s*=\s*document\.getElementById\("([\w-]+)"\)/);
    if (guest) {
      features.guestName = { param: guest[1], fallback: guest[2], id: guest[3] };
      matched = true;
    }
    if (/getElementById\(['"](myAudio|y)['"]\)/.test(code)) {
      const legacy = /getElementById\("y"\)/.test(code);
      features.music = legacy
        ? { audio: "y", toggle: "x", icon: "z", iconPlaying: "b", buttonPlaying: "c", press: "f" }
        : { audio: "myAudio", toggle: "toggleMusic", icon: "musicIcon", iconPlaying: "rotating", buttonPlaying: "rippling", press: "pressEffect" };
      matched = true;
    }
    if (/snowflake/.test(code) || /class(?:List\.add\(|Name=)['"]heart['"]/.test(code)) {
      features.falling = { snow: /snowflake/.test(code), hearts: /heart/.test(code) };
      matched = true;
    }
    if (/wt-scroll-locked/.test(code)) {
      features.introGate = { id: code.match(/getElementById\("([\w-]+)"\)/)?.[1] ?? "T01" };
      matched = true;
    }
    if (/oncontextmenu|contextmenu|'F12'|"F12"|0x7b/.test(code) && !/wsc-/.test(code)) {
      features.antiCopy = true;
      matched = true;
    }
    if (/wsc-list/.test(code)) {
      const labels = [...code.matchAll(/innerText\s*=\s*"([^"]+)"/g)].map((x) => x[1]);
      features.wishes = { color: code.match(/color:\s*"([^"]+)"/)?.[1] ?? "#e91e63", sendLabel: labels.at(-1) ?? "Gửi" };
      matched = true;
    }
    if (!matched) warnings.push(`unrecognised script: ${code.replace(/\s+/g, " ").slice(0, 100)}`);
  }
  return features;
}

// ---------------------------------------------------------------- DOM → AST

const RENAME = {
  class: "className", for: "htmlFor", tabindex: "tabIndex", readonly: "readOnly", maxlength: "maxLength",
  minlength: "minLength", autocomplete: "autoComplete", autoplay: "autoPlay", playsinline: "playsInline",
  allowfullscreen: "allowFullScreen", frameborder: "frameBorder", crossorigin: "crossOrigin",
  referrerpolicy: "referrerPolicy", srcset: "srcSet", colspan: "colSpan", rowspan: "rowSpan",
  enctype: "encType", novalidate: "noValidate", spellcheck: "spellCheck", datetime: "dateTime",
  contenteditable: "contentEditable", "accept-charset": "acceptCharset", viewbox: "viewBox",
  charset: "charSet", "http-equiv": "httpEquiv",
};
const BOOL = new Set(["required", "loop", "muted", "controls", "disabled", "multiple", "hidden", "autoPlay",
  "playsInline", "allowFullScreen", "readOnly", "noValidate", "defer", "async", "open"]);
const NO_WS = new Set(["select", "table", "thead", "tbody", "tr", "colgroup", "audio", "video", "picture", "ul", "ol", "head"]);
const VOID_TEXT = new Set(["textarea"]);

function convertAttrs(el, warnings) {
  const props = {};
  for (const [name, raw] of Object.entries(el.attribs)) {
    if (name === "is_auto_funnel") continue;
    if (/^on/i.test(name)) { warnings.push(`dropped inline handler ${name} on <${el.name}>`); continue; }
    const key = RENAME[name] ?? (name.startsWith("data-") || name.startsWith("aria-") ? name : name.replace(/[-:]([a-z])/g, (_, c) => c.toUpperCase()));
    if (key === "style") { const o = styleToObject(raw); if (Object.keys(o).length) props.style = o; continue; }
    if (key === "className") { const c = raw.split(/\s+/).filter((x) => x && x !== "ladi-lazyload").join(" "); if (c) props.className = c; continue; }
    if (key === "value" && (el.name === "input" || el.name === "textarea")) { if (raw) props.defaultValue = raw; continue; }
    if (key === "checked") { props.defaultChecked = true; continue; }
    if (key === "selected") continue; // handled on the parent <select>
    // Browsers strip tabs/newlines inside URLs; do it here so the value is stable and editable.
    props[key] = BOOL.has(key) ? true : key === "src" || key === "href" ? raw.replace(/[\n\r\t]/g, "") : raw;
  }
  return props;
}

const hasClass = (el, c) => (el.attribs?.class ?? "").split(/\s+/).includes(c);

function buildAst($, ctx) {
  const { elements, warnings, css, fonts, features } = ctx;
  const behaviourIds = new Map();
  if (features.music) {
    behaviourIds.set(features.music.audio, "music-audio");
    behaviourIds.set(features.music.toggle, "music-toggle");
    behaviourIds.set(features.music.icon, "music-icon");
  }
  for (const id of ["wsc-list", "wsc-success-msg", "wsc-ok-btn", "wsc-sendBtn", "wsc-name", "wsc-message", "wsc-attendance", "wsc-fireworks"]) {
    if (features.wishes) behaviourIds.set(id, id);
  }

  const elementIdOf = (el) => {
    for (let p = el; p && p.type === "tag"; p = p.parent) {
      if (p.attribs?.id && (hasClass(p, "ladi-element") || hasClass(p, "ladi-section"))) return p.attribs.id;
    }
    return null;
  };
  const meta = (id) => (elements[id] ??= { t: typeFromId(id) });

  const walk = (node, parentTag) => {
    if (node.type === "text") {
      if (!node.data.trim()) return NO_WS.has(parentTag) ? null : node.data.includes("\n") || node.data.length > 1 ? " " : node.data;
      return node.data;
    }
    if (node.type !== "tag" && node.type !== "script" && node.type !== "style") return null;
    const el = node;
    const tag = el.name;
    if (tag === "script") return null;
    if (tag === "style") { css.push($(el).html()); return null; }
    if (tag === "link") {
      if (/stylesheet/i.test(el.attribs.rel ?? "") && el.attribs.href) fonts.push(el.attribs.href);
      return null;
    }
    const props = convertAttrs(el, warnings);
    const id = el.attribs.id;
    if (id && (hasClass(el, "ladi-element") || hasClass(el, "ladi-section"))) { props.$e = id; meta(id); }
    if (id && behaviourIds.has(id)) props.$b = behaviourIds.get(id);
    if (hasClass(el, "snowflakes")) props.$b = "snow";
    if (hasClass(el, "hearts")) props.$b = "hearts";
    if (id === "backdrop-popup") props.$b = "backdrop";

    const owner = elementIdOf(el.parent);
    // Editable rich text: headline / paragraph containers keep their inner HTML as a string.
    if ((hasClass(el, "ladi-headline") || hasClass(el, "ladi-paragraph") || hasClass(el, "ladi-list-paragraph")) && owner) {
      meta(owner).text = $(el).html();
      props.$t = owner;
      return [tag, props];
    }
    // Inline SVG (shapes, icons): keep verbatim, it is decoration.
    if (el.children.some((c) => c.name === "svg")) {
      props.$h = $(el).html();
      return [tag, props];
    }
    if (hasClass(el, "ladi-image-background") && owner) props.$i = owner;
    if ((hasClass(el, "ladi-section-background") || hasClass(el, "ladi-popup-background")) && owner && ctx.images.has(owner)) props.$i = owner;
    if (hasClass(el, "ladi-box") && owner && ctx.images.has(owner)) props.$i = owner;
    if (tag === "span" && hasClass(el.parent, "ladi-countdown-text") && owner) {
      let cd = el.parent;
      while (cd && !(cd.attribs?.id && /^COUNTDOWN(?!_ITEM)/.test(cd.attribs.id))) cd = cd.parent;
      props.$cd = [owner, cd?.attribs.id ?? null];
    }
    if (tag === "form" && owner) props.$f = owner;
    if (hasClass(el, "ladi-gallery-view") && owner) props.$gv = owner;
    if (hasClass(el, "ladi-gallery-control-box") && owner) props.$gc = owner;
    if (hasClass(el, "ladi-gallery-view-arrow")) props.$ga = hasClass(el, "ladi-gallery-view-arrow-left") ? -1 : 1;
    if (hasClass(el, "ladi-gallery-control-arrow")) props.$ga = hasClass(el, "ladi-gallery-control-arrow-left") ? -1 : 1;
    if (hasClass(el, "ladi-carousel-content") && owner) props.$cc = owner;
    if (hasClass(el, "ladi-carousel-arrow")) props.$ga = hasClass(el, "ladi-carousel-arrow-left") ? -1 : 1;
    if (hasClass(el, "ladi-video") && owner) props.$v = owner;
    if (hasClass(el.parent, "ladi-tabs") && el.attribs["data-index"]) {
      const tabs = elementIdOf(el.parent);
      const index = Number(el.attribs["data-index"]);
      if (hasClass(el, "selected")) meta(tabs).tab = index;
      props.className = (props.className ?? "").split(" ").filter((c) => c !== "selected").join(" ");
      props.$tab = [tabs, index];
    }
    if (id && hasClass(el, "ladi-element") && el.parent?.parent?.attribs?.id === "SECTION_POPUP") props.$p = id;
    if (tag === "select") {
      const sel = $(el).find("option[selected]").attr("value");
      if (sel !== undefined) props.defaultValue = sel;
    }
    if (VOID_TEXT.has(tag)) {
      const text = $(el).text();
      if (text) props.defaultValue = text;
      return [tag, props];
    }

    let children = el.children;
    // Gallery items are generated from data so their number can change; keep only the arrows.
    if (props.$gv || props.$gc) children = children.filter((c) => /arrow/.test(c.attribs?.class ?? ""));
    const out = [tag, Object.keys(props).length ? props : null];
    for (const c of children) {
      const v = walk(c, tag);
      if (v !== null && v !== undefined) out.push(v);
    }
    return out;
  };

  return $("body").contents().toArray().map((n) => walk(n, "body")).filter((x) => x !== null);
}

const TYPE_PREFIX = [
  ["SECTION", "section"], ["HEADLINE", "headline"], ["PARAGRAPH", "paragraph"], ["IMAGE", "image"],
  ["BUTTON_TEXT", "headline"], ["BUTTON", "button"], ["GROUP", "group"], ["BOX", "box"], ["SHAPE", "shape"],
  ["LINE", "line"], ["COUNTDOWN_ITEM", "countdown_item"], ["COUNTDOWN", "countdown"], ["GALLERY", "gallery"],
  ["FORM_ITEM", "form_item"], ["FORM", "form"], ["POPUP", "popup"], ["HTML_CODE", "html_code"],
  ["TABS", "tabs"], ["TAB_ITEM", "frame"], ["VIDEO", "video"], ["CAROUSEL", "carousel"],
];
function typeFromId(id) {
  for (const [p, t] of TYPE_PREFIX) if (id.startsWith(p)) return t;
  return "element";
}

// ---------------------------------------------------------------- event data → element metadata

function localHref(url) {
  return SITE_HOST_RE.test(url) ? "/" + url.replace(SITE_HOST_RE, "") : url;
}

function applyEventData(ev, elements) {
  for (const [id, v] of Object.entries(ev)) {
    const m = (elements[id] ??= { t: v.a ?? typeFromId(id) });
    if (v.a) m.t = v.a;
    const anim = v.F ?? v.D;
    if (anim) m.anim = { name: anim, delay: v.C ?? v.A ?? "0s" };
    const actions = (v.cs ?? []).filter((c) => c.dr === "action" && c.a).map((c) => {
      switch (c.a) {
        case "link": return { type: "link", href: localHref(c.dw ?? ""), target: SITE_HOST_RE.test(c.dw ?? "") ? "_self" : c.dv ?? "_blank" };
        case "phone": return { type: "phone", phone: c.dw };
        case "popup": return c.dw ? { type: "popup", target: c.dw } : null;
        case "copy_clipboard": return { type: "copy", text: c.dL ?? "" };
        case "change_index": return { type: "tab", target: c.dw, index: c.dH };
        case "section": return { type: "section", target: c.dw };
        case "set_style": return { type: "style", target: c.dw, background: c.dT, color: c.dU };
        case "hidden_show": return c.dw ? { type: "toggle", target: c.dw } : null;
        case "email": return { type: "link", href: `mailto:${c.dw}`, target: "_self" };
        default: return null;
      }
    }).filter(Boolean);
    if (actions.length) m.actions = actions;
    if (v.a === "countdown") m.countdown = v.bX === "endtime" ? { end: v.bT } : { minutes: v.bW };
    if (v.a === "countdown_item") m.unit = v.bY;
    if (v.a === "gallery") m.autoplay = v.ah ? (v.ae ?? 5) : 0;
    if (v.a === "popup") m.backdrop = v.U ?? "background-color: rgba(0, 0, 0, 0.5);";
    if (v.a === "video") m.video = { url: v.ci, kind: v.ch };
    if (v.a === "carousel") m.carousel = { interval: v.O ?? 5, autoplay: !!v.R, width: v.L };
  }
}

// ---------------------------------------------------------------- brand

// LoveCard's own name, domain, contacts and sample bank QR codes are swapped for ours
// (src/data/brand.json). Contact elements are tagged so the site's current contacts, which admins
// can change, apply at render time (src/lib/card/resolve.ts).
const OLD_HOTLINE = "0399974362";
const OLD_ZALO_RE = /https?:\/\/zalo\.me\/84399974362/g;
const OLD_FACEBOOK_RE = /https?:\/\/(?:www\.)?facebook\.com\/profile\.php\?id=61575666385951/g;
const OLD_TIKTOK = "@thiepcuoionlinelovecard";
const QR_RE = /\/assets\/[^"')\s]*\/(?:1-18-20260906033556|z6617775457504|z6641146493122|z6641146499897|z7780455357037|z7780887274636|z7796333064922)[^"')\s]*/g;
const zaloUrl = (phone) => `https://zalo.me/${phone.replace(/\D/g, "").replace(/^0/, "84")}`;

const REBRAND = [
  [OLD_ZALO_RE, zaloUrl(brand.contacts.zalo)],
  [OLD_FACEBOOK_RE, brand.contacts.facebook],
  [/https?:\/\/(?:www\.)?lovecard\.click/g, brand.siteUrl],
  [new RegExp(OLD_HOTLINE, "g"), brand.contacts.hotline],
  [new RegExp(OLD_TIKTOK, "g"), "@"],
  // Not inside URLs such as our own lovecard-next domain.
  [/(?<![\w/.-])love(?:\s|&nbsp;)*card(?![\w-]|\.\w)/gi, (m) => (m === m.toUpperCase() ? brand.name.toUpperCase() : brand.name)],
  [QR_RE, brand.bankQr],
];
const rebrand = (s) => (typeof s === "string" ? REBRAND.reduce((out, [re, to]) => out.replace(re, to), s) : s);

function tagContacts(tree, elements) {
  const has = (s, re) => typeof s === "string" && new RegExp(re.source ?? re).test(s);
  for (const m of Object.values(elements)) {
    for (const a of m.actions ?? []) {
      if (a.type === "link" && has(a.href, OLD_ZALO_RE)) m.contact = "zalo";
      if (a.type === "link" && has(a.href, OLD_FACEBOOK_RE)) m.contact = "facebook";
      if (a.type === "phone" && a.phone === OLD_HOTLINE) m.contact = "hotline";
    }
    if (m.text?.includes(OLD_HOTLINE)) m.contact = "hotline";
    if (m.text?.includes(OLD_TIKTOK)) m.contact = "tiktok";
  }
  const isCopy = (id) => elements[id]?.actions?.some((a) => a.type === "copy");
  const walk = (n, owner, copyAncestor) => {
    if (typeof n === "string") return;
    const [, p, ...children] = n;
    const id = p?.$e ?? owner;
    const m = id ? elements[id] : null;
    // TikTok icons: LoveCard linked them to its hotline.
    if (m && typeof p?.$h === "string" && p.$h.includes("icons/social/tiktok.svg")) m.contact = "tiktok";
    // "Copy STK" labels copied LoveCard's hotline over their group's bank-number copy; let the group handle it.
    if (p?.$e && m && copyAncestor) {
      m.actions = m.actions?.filter((a) => !(a.type === "copy" && a.text === OLD_HOTLINE));
      if (!m.actions?.length) delete m.actions;
    }
    children.forEach((c) => walk(c, id, copyAncestor || (p?.$e ? isCopy(p.$e) : false)));
  };
  tree.forEach((n) => walk(n, null, false));
}

function rebrandDoc(tree, elements) {
  tagContacts(tree, elements);
  for (const m of Object.values(elements)) {
    m.text = rebrand(m.text);
    m.image = rebrand(m.image);
    if (m.contact === "tiktok") m.actions = [{ type: "link", href: "", target: "_blank" }];
    m.actions = m.actions?.map((a) => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, rebrand(v)])));
  }
  const walk = (n) => {
    if (typeof n === "string") return;
    const [, p, ...children] = n;
    if (p?.href) p.href = rebrand(p.href);
    if (p?.src) p.src = rebrand(p.src);
    children.forEach(walk);
  };
  tree.forEach(walk);
}

// ---------------------------------------------------------------- site fixes

// "Đặt ngay" buttons start the order flow (pick a template, edit, pay) instead of opening Zalo.
const ORDER_TEXT_RE = /^đặt\s*ngay$/i;
const ORDER_HREF = "/dang-ky";

function linkOrderButtons(tree, elements) {
  const plain = (html) => (html ?? "").replace(/<[^>]+>|&nbsp;/g, " ").replace(/\s+/g, " ").trim().normalize("NFC");
  /** Text of every element below node `n` (element text lives in `elements`, not the tree). */
  const textBelow = (n) => {
    if (typeof n === "string") return "";
    const [, p, ...children] = n;
    return [p?.$e ? plain(elements[p.$e]?.text) : "", ...children.map(textBelow)].filter(Boolean).join(" ");
  };
  const walk = (n) => {
    if (typeof n === "string") return;
    const [, p, ...children] = n;
    const m = p?.$e && elements[p.$e];
    if (m?.t === "button" && ORDER_TEXT_RE.test(textBelow(n))) {
      m.actions = [{ type: "link", href: ORDER_HREF, target: "_self" }];
      delete m.contact;
    }
    children.forEach(walk);
  };
  tree.forEach(walk);
}

// Per-template CSS appended after the original. The home footer's desktop layout spilled past the
// 960px container (form cut off on common screens); this lays it out as two columns inside it. The
// TikTok line moves last so hiding it (no TikTok set) leaves no gap.
const CSS_FIXES = {
  home: `
@media (min-width: 768px) {
  #PARAGRAPH94{top:40px;left:3137px;width:470px}
  #PARAGRAPH94 > .ladi-paragraph{font-size:34px}
  #PARAGRAPH96{top:160px;left:3137px;width:470px}
  #PARAGRAPH96 > .ladi-paragraph{font-size:18px}
  #PARAGRAPH96 br{display:none}
  #GROUP365,#GROUP366,#GROUP367,#GROUP368{left:3137px;width:470px}
  #PARAGRAPH98,#PARAGRAPH100,#PARAGRAPH102,#PARAGRAPH104{width:420px}
  #PARAGRAPH98 > .ladi-paragraph,#PARAGRAPH100 > .ladi-paragraph,#PARAGRAPH102 > .ladi-paragraph,#PARAGRAPH104 > .ladi-paragraph{font-size:18px}
  #GROUP365{top:262px}
  #GROUP366{top:318px}
  #GROUP368{top:374px}
  #GROUP367{top:430px}
  #GROUP373{top:40px;left:448px;transform:scale(0.9);transform-origin:top right}
  #PARAGRAPH106{top:560px;left:${3137 + (960 - 469) / 2}px;text-align:center}
  #BOX283,#BOX284{display:none}
}
@media (max-width: 767px) {
  #GROUP368{top:287.27px}
  #GROUP367{top:327px}
}`,
};

// ---------------------------------------------------------------- main

async function convert(slug) {
  const t = JSON.parse(await readFile(path.join(SRC_DIR, `${slug}.json`), "utf8"));
  const warnings = [];
  const $ = cheerio.load(`<body>${t.bodyHtml}</body>`);

  const evScript = $("#script_event_data");
  const ev = evScript.length ? JSON.parse(evScript.html()) : {};
  evScript.remove();

  // Head styles minus LadiPage runtime helpers (lazyload gating, animation pre-hide).
  const css = t.styles.filter((s) => s.id !== "style_lazyload" && s.id !== "style_animation").map((s) => s.css);
  const fonts = [...t.stylesheets];
  const features = classifyScripts(t.scripts, warnings);
  const elements = {};

  // Body <style> blocks are appended by buildAst in document order; scan CSS after the walk.
  const ctx = { elements, warnings, css, fonts, features, images: new Map() };
  // First pass for image ownership needs the full CSS, including body styles.
  const bodyCss = $("style").map((_, s) => $(s).html()).get();
  ctx.images = scanCss([...css, ...bodyCss].join("\n")).images;
  const tree = buildAst($, ctx);
  const allCss = css.join("\n").replace(QR_RE, brand.bankQr) + (CSS_FIXES[slug] ?? "");
  const { images, gallery, sizes } = scanCss(allCss);

  applyEventData(ev, elements);
  for (const [id, url] of images) if (elements[id]) elements[id].image = url;
  for (const [id, list] of gallery) {
    if (elements[id]) elements[id].gallery = list.filter(Boolean).map((g) => ({ src: g.src ?? g.thumb, thumb: g.thumb ?? g.src }));
  }
  rebrandDoc(tree, elements);
  linkOrderButtons(tree, elements);
  if (features.guestName && elements[features.guestName.id]) {
    elements[features.guestName.id].text = features.guestName.fallback;
  }

  // Photo slots: real photos (jpg) large enough to matter, plus every gallery item.
  const photos = [];
  for (const [id, m] of Object.entries(elements)) {
    if (m.t === "image" && m.image && m.image !== brand.bankQr && /\.(jpe?g|webp)(\?|$)/i.test(m.image)) {
      const size = sizes.get(id) ?? {};
      if ((size.w ?? 999) >= PHOTO_MIN_SIZE && (size.h ?? 999) >= PHOTO_MIN_SIZE) photos.push(id);
    }
    if (m.gallery) photos.push(...m.gallery.map((_, i) => `${id}#${i}`));
  }

  // Top-level sections in page order (for show/hide/reorder in the editor).
  const sections = $(".ladi-wraper > .ladi-section").map((_, s) => s.attribs.id).get().filter((id) => id !== "SECTION_POPUP");

  const doc = {
    slug,
    title: rebrand(t.title),
    description: rebrand(t.meta.find((m) => m.name === "description")?.content ?? ""),
    icon: t.icon,
    meta: t.meta.filter((m) => /^og:|^twitter:|^description$/.test(m.property ?? m.name ?? "")).map((m) => ({ ...m, content: rebrand(m.content) })),
    fonts: [...new Set(fonts)],
    css: allCss,
    bodyClass: (t.bodyAttrs.class ?? "").split(/\s+/).filter((c) => c && c !== "lazyload").join(" "),
    sections,
    photos,
    features,
    elements,
    tree,
  };
  await writeFile(path.join(OUT_DIR, `${slug}.json`), JSON.stringify(doc));
  return { doc, warnings };
}

await mkdir(OUT_DIR, { recursive: true });
const args = process.argv.slice(2);
const slugs = args.length ? args : (await readdir(SRC_DIR)).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
for (const slug of slugs) {
  const { doc, warnings } = await convert(slug);
  const f = Object.keys(doc.features).join(",") || "-";
  console.log(`✓ ${slug.padEnd(18)} elements=${Object.keys(doc.elements).length} photos=${doc.photos.length} features=${f}`);
  for (const w of [...new Set(warnings)]) console.log(`    ! ${w}`);
}
