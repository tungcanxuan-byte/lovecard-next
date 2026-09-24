import type { CardContent, GalleryItem, ResolvedElement } from "@/lib/card/types";

/** Editor → canvas iframe. */
export type ToCanvas =
  | { type: "state"; content: CardContent; selected: string | null; popup: string | null }
  | { type: "scroll"; id: string };

/** Canvas iframe → editor. */
export type FromCanvas =
  | { type: "ready" }
  | { type: "select"; id: string }
  | { type: "selected"; id: string; el: ResolvedElement | null }
  | { type: "text"; id: string; html: string }
  | { type: "pick-image"; id: string }
  | { type: "pick-gallery"; id: string; index: number; gallery: GalleryItem[] }
  | { type: "close-popup" };

/** Messages are only accepted from our own origin (editor and canvas are same-site). */
export const fromSameOrigin = (e: MessageEvent) => e.origin === window.location.origin;
