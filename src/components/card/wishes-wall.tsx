"use client";

import { useEffect, useState } from "react";
import { useCard } from "./card-context";

const SHOWN = 2;
const EVERY_MS = 3500;

/**
 * Guests' wishes floating up in the corner of the card, one at a time, cycling through all of them.
 * Stays out of the template's layout; the toggle lets guests hide it.
 */
export function WishesWall() {
  const { wishes, edit } = useCard();
  const items = wishes.items;
  const [tick, setTick] = useState(-1); // first wish shows one interval in, after the card's intro
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!open || items.length === 0) return;
    const timer = setInterval(() => setTick((t) => t + 1), EVERY_MS);
    return () => clearInterval(timer);
  }, [open, items.length]);

  if (edit || items.length === 0) return null;

  // Absolute positions in the endless cycle, oldest first, so each new wish mounts (and animates) once.
  const shown = Math.max(0, Math.min(SHOWN, items.length, tick + 1));
  const slots = Array.from({ length: shown }, (_, i) => tick - shown + 1 + i);

  return (
    <aside className="lc-fw" aria-label="Lời chúc của khách mời">
      {open && (
        <div className="lc-fw-list" aria-live="polite">
          {slots.map((slot) => {
            const w = items[slot % items.length];
            return (
              <div key={slot} className="lc-fw-item">
                <span className="lc-fw-avatar">{w.name.trim().slice(0, 1).toUpperCase() || "♥"}</span>
                <span className="lc-fw-text">
                  <span className="lc-fw-name">{w.name}</span>
                  <span className="lc-fw-msg">{w.message}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
      <button type="button" className="lc-fw-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? "Ẩn lời chúc" : `💌 ${items.length} lời chúc`}
      </button>
    </aside>
  );
}
