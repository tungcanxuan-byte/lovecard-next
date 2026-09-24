"use client";

import { createContext, useContext } from "react";
import type { Action, DocFeatures, ResolvedElements } from "@/lib/card/types";

/** Callbacks the editor supplies; their presence switches the renderer into edit mode. */
export type EditHandlers = {
  onText: (id: string, html: string) => void;
  onImage: (id: string) => void;
  onGalleryImage: (id: string, index: number) => void;
  onSelect: (id: string) => void;
  onClosePopup: () => void;
  selected: string | null;
};

export type CardState = {
  elements: ResolvedElements;
  features: DocFeatures;
  cardId: string | null;
  edit: EditHandlers | null;
  now: number | null; // null until mounted, so countdowns render "00" on the server
  mountedAt: number;
  guestName: string | null;
  popup: string | null;
  tabs: Record<string, number>;
  display: Record<string, string>;
  music: { playing: boolean; pressed: boolean; toggle: () => void; src: string | null };
  runActions: (actions: Action[]) => void;
  closePopup: () => void;
  submitForm: (form: HTMLFormElement) => void;
  wishes: WishesState;
};

export type Wish = {
  id?: string;
  name: string;
  message: string;
  attendance?: string | null;
  createdAt?: string | Date;
};
export type WishesState = {
  status: "loading" | "ready" | "error";
  items: Wish[];
  sending: boolean;
  success: boolean;
  send: () => void;
  dismiss: () => void;
  attachCanvas: (canvas: HTMLCanvasElement | null) => void;
};

export const CardContext = createContext<CardState | null>(null);

export function useCard(): CardState {
  const ctx = useContext(CardContext);
  if (!ctx) throw new Error("useCard must be used inside <CardRenderer>");
  return ctx;
}

/** Nearest gallery/carousel, so arrows and slides know which slider they drive. */
export type SlideScope = {
  id: string;
  index: number;
  count: number;
  step: (delta: number) => void;
  go: (index: number) => void;
  setCount: (n: number) => void;
};
export const SlideContext = createContext<SlideScope | null>(null);
