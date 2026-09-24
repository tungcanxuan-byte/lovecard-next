import type { AstNode, CardDoc } from "./types";

export type OutlineItem = { id: string; label: string };

const plain = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const clip = (s: string, n = 36) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** First readable text inside an element's subtree, for naming sections in the editor. */
function firstText(doc: CardDoc, node: AstNode): string | null {
  if (typeof node === "string") return null;
  const [, props, ...children] = node;
  const id = props?.$t;
  if (id) {
    const text = plain(doc.elements[id]?.text ?? "");
    if (text.length > 1) return text;
  }
  for (const c of children) {
    const t = firstText(doc, c);
    if (t) return t;
  }
  return null;
}

function findById(nodes: AstNode[], id: string): AstNode | null {
  for (const n of nodes) {
    if (typeof n === "string") continue;
    if (n[1]?.$e === id) return n;
    const found = findById(n.slice(2) as AstNode[], id);
    if (found) return found;
  }
  return null;
}

/** Top-level sections with a short human label ("Phần 3 · Save the date"). */
export function sectionOutline(doc: CardDoc): OutlineItem[] {
  return doc.sections.map((id, i) => {
    const node = findById(doc.tree, id);
    const text = node && firstText(doc, node);
    return { id, label: text ? `Phần ${i + 1} · ${clip(text)}` : `Phần ${i + 1}` };
  });
}

/** Popups (gift box, wish form, ...) named after their LadiPage id or first text. */
export function popupOutline(doc: CardDoc): OutlineItem[] {
  return Object.entries(doc.elements)
    .filter(([, el]) => el.t === "popup")
    .map(([id]) => {
      const node = findById(doc.tree, id);
      const text = node && firstText(doc, node);
      return { id, label: text ? `${id} · ${clip(text, 28)}` : id };
    });
}
