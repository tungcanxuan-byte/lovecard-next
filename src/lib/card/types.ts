/**
 * Renderer document produced by scripts/convert-templates.mjs (src/data/docs/<slug>.json).
 * The tree keeps LadiPage's exact DOM so the template CSS applies unchanged; "$"-prefixed props are
 * renderer hooks resolved by src/components/card/card-renderer.tsx.
 */
export type AstProps = Record<string, unknown> & {
  className?: string;
  style?: Record<string, string>;
  $e?: string; // LadiPage element id (section, image, button, ...)
  $t?: string; // editable rich-text holder of element id
  $h?: string; // verbatim inner HTML (inline SVG)
  $i?: string; // background-image holder of element id
  $cd?: [string, string | null]; // countdown item span: [item id, countdown id]
  $f?: string; // <form> of form element id
  $gv?: string; // gallery view (items generated from data)
  $gc?: string; // gallery control box (thumbnails generated from data)
  $ga?: -1 | 1; // gallery/carousel arrow
  $cc?: string; // carousel content (slides)
  $v?: string; // video container
  $tab?: [string, number]; // tab item: [tabs id, index]
  $p?: string; // popup element
  $b?: string; // behaviour hook: music-*, snow, hearts, wsc-*
};
export type AstNode = string | [string, AstProps | null, ...AstNode[]];

export type GalleryItem = { src: string; thumb: string };

export type Action =
  | { type: "link"; href: string; target: string }
  | { type: "phone"; phone: string }
  | { type: "popup"; target: string }
  | { type: "copy"; text: string }
  | { type: "tab"; target: string; index: number }
  | { type: "section"; target: string }
  | { type: "style"; target: string; background?: string; color?: string }
  | { type: "toggle"; target: string };

export type ElementMeta = {
  t: string;
  text?: string;
  image?: string;
  gallery?: GalleryItem[];
  anim?: { name: string; delay: string };
  actions?: Action[];
  countdown?: { end?: number; minutes?: number };
  unit?: "day" | "hour" | "minute" | "seconds";
  autoplay?: number;
  backdrop?: string;
  video?: { url: string; kind: string };
  carousel?: { interval: number; autoplay: boolean };
  tab?: number;
};

export type MusicFeature = {
  audio: string;
  toggle: string;
  icon: string;
  iconPlaying: string;
  buttonPlaying: string;
  press: string;
};

export type DocFeatures = {
  music?: MusicFeature;
  guestName?: { param: string; fallback: string; id: string };
  falling?: { snow: boolean; hearts: boolean };
  introGate?: { id: string };
  antiCopy?: boolean;
  wishes?: { color: string; sendLabel: string };
};

export type CardDoc = {
  slug: string;
  title: string;
  description: string;
  icon: string | null;
  meta: Array<{ name?: string; property?: string; content: string }>;
  fonts: string[];
  css: string;
  bodyClass: string;
  sections: string[];
  photos: string[]; // "IMAGE12" or "GALLERY1#3"
  features: DocFeatures;
  elements: Record<string, ElementMeta>;
  tree: AstNode[];
};

/** Quick-edit field bindings curated per template (src/data/template-fields/<slug>.json). */
export type FieldTarget = { id: string; find: string; action?: boolean };
export type FieldBinding = { key: string; targets: FieldTarget[] };

/** Per-element customisation stored with a card. */
export type ElementOverride = {
  text?: string; // sanitized rich-text HTML
  image?: string;
  gallery?: GalleryItem[];
  hidden?: boolean;
  copy?: string; // text copied by copy-to-clipboard actions
  href?: string; // link actions (maps, social)
  color?: string; // text colour, #hex
  background?: string; // background colour, #hex
};

export type CardContent = {
  fields?: Record<string, string>;
  overrides?: Record<string, ElementOverride>;
  sections?: string[]; // display order of top-level sections
  music?: string | null;
  eventAt?: number | null; // countdown target, epoch ms
};

/** Element as the renderer draws it, after fields and overrides are applied. */
export type ResolvedElement = ElementMeta & { hidden?: boolean };
export type ResolvedElements = Record<string, ResolvedElement>;
