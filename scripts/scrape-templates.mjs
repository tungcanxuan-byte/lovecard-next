// Scrapes LoveCard's LadiPage-published templates into JSON + local assets so the
// Next.js app can re-render them pixel-identical without depending on LadiPage hosting.
//
// Usage: node scripts/scrape-templates.mjs [slug ...]   (no args = every slug in the index page)
import * as cheerio from "cheerio";
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";

const ORIGIN = "https://www.lovecard.click";
const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.join(ROOT, "src/data/templates");
const ASSET_DIR = path.join(ROOT, "public/assets");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36";

// Hosts whose files get mirrored locally. Music (jsdelivr) and Google Fonts stay remote on purpose.
const MIRROR_HOSTS = ["w.ladicdn.com", "s.ladicdn.com", "static.ladipage.net", "img.icons8.com"];
const RUNTIME_PATH_RE = /^\/v5\/source\//;
// Matches plain (https://host/a/b) and JSON-escaped (https:\/\/host\/a\/b) URLs.
const HOSTS_RE = MIRROR_HOSTS.map((h) => h.replace(/\./g, "\\.")).join("|");
const ASSET_RE = new RegExp(String.raw`https?:(?:\\?/){2}(${HOSTS_RE})((?:\\?/[^"'\s()<>\\]*)+)`, "g");

const fetchText = async (url) => {
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
};

const exists = (p) => access(p).then(() => true, () => false);

/** Downloads one asset (once) and returns its local public path. */
const downloaded = new Map();
async function mirror(host, rawPath) {
  const cleanPath = decodeURI(rawPath.replace(/\\\//g, "/").split(/[?#]/)[0]);
  // LadiPage's own runtime is their proprietary code: keep loading it from their CDN, unmodified.
  if (host === "w.ladicdn.com" && RUNTIME_PATH_RE.test(cleanPath)) return null;
  const local = `/assets/${host}${cleanPath}`;
  if (downloaded.has(local)) return downloaded.get(local);
  const job = (async () => {
    const file = path.join(ASSET_DIR, host, cleanPath);
    if (cleanPath.endsWith("/")) return null; // directory-like URL, leave remote
    if (!(await exists(file))) {
      const res = await fetch(`https://${host}${encodeURI(cleanPath)}`, { headers: { "user-agent": UA } });
      if (!res.ok) {
        console.warn(`  ! asset ${res.status} https://${host}${cleanPath}`);
        return null;
      }
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, Buffer.from(await res.arrayBuffer()));
    }
    return local;
  })();
  downloaded.set(local, job);
  return job;
}

/** Replaces every mirrorable URL in a string with its local path (keeps JSON-escaped slashes intact). */
async function rewriteAssets(text) {
  const matches = [...text.matchAll(ASSET_RE)];
  const replacements = await Promise.all(
    matches.map(async (m) => {
      const escaped = m[0].includes("\\/");
      const local = await mirror(m[1], m[2]);
      if (!local) return m[0];
      const withQuery = m[2].includes("?") ? local + m[2].slice(m[2].indexOf("?")).replace(/\\\//g, "/") : local;
      return escaped ? withQuery.replace(/\//g, "\\/") : withQuery;
    }),
  );
  let i = 0;
  return text.replace(ASSET_RE, () => replacements[i++]);
}

async function scrape(slug) {
  const url = slug === "home" ? `${ORIGIN}/` : `${ORIGIN}/${slug}`;
  // Internal links become root-relative so the gallery routes into this app instead of the old host.
  const html = (await rewriteAssets(await fetchText(url))).replace(
    /href=(["'])https?:\/\/(?:www\.)?lovecard\.click\/?/g,
    "href=$1/",
  );
  const $ = cheerio.load(html, { decodeEntities: false });

  const meta = [];
  $("head meta").each((_, el) => {
    const a = el.attribs;
    const key = a.name ? "name" : a.property ? "property" : null;
    if (key && a.content && a[key] !== "viewport") meta.push({ [key]: a[key], content: a.content });
  });

  const stylesheets = [];
  $('head link[rel="stylesheet"]').each((_, el) => stylesheets.push(el.attribs.href));
  const icon = $('head link[rel="icon"]').attr("href") ?? null;

  const styles = [];
  $("head style").each((_, el) => styles.push({ id: el.attribs.id ?? null, css: $(el).html() }));

  // Executable scripts are pulled out in document order; JSON data scripts stay in the markup
  // because the LadiPage runtime reads them by id.
  const scripts = [];
  $("script").each((_, el) => {
    const type = el.attribs.type;
    if (type && !/javascript/i.test(type)) return;
    scripts.push({ id: el.attribs.id ?? null, src: el.attribs.src ?? null, code: el.attribs.src ? null : $(el).html() });
    $(el).remove();
  });

  const bodyAttrs = { ...$("body").get(0).attribs };
  // Body styles/links that LadiPage places inside <body> stay part of bodyHtml.
  const bodyHtml = $("body").html().trim();

  const template = {
    slug,
    sourceUrl: url,
    title: $("head title").text(),
    lang: $("html").attr("lang") ?? "vi",
    icon,
    meta,
    stylesheets,
    styles,
    bodyAttrs,
    bodyHtml,
    scripts,
  };
  await writeFile(path.join(DATA_DIR, `${slug}.json`), JSON.stringify(template));
  return template;
}

/** Lists template slugs linked from the gallery page that live on lovecard.click. */
async function listSlugs() {
  const $ = cheerio.load(await fetchText(`${ORIGIN}/`));
  const slugs = new Set();
  $("a[href]").each((_, el) => {
    const m = el.attribs.href.match(/^https?:\/\/(?:www\.)?lovecard\.click\/([\w-]+)\/?$/);
    if (m) slugs.add(m[1]);
  });
  return ["home", ...slugs];
}

await mkdir(DATA_DIR, { recursive: true });
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : await listSlugs();
console.log(`Scraping ${slugs.length} pages`);
const failed = [];
for (const slug of slugs) {
  try {
    const t = await scrape(slug);
    console.log(`✓ ${slug} — ${t.title}`);
  } catch (err) {
    failed.push(slug);
    console.error(`✗ ${slug}: ${err.message}`);
  }
}
if (failed.length) console.error(`Failed: ${failed.join(", ")}`);
