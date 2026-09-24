"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Action, AstNode, DocFeatures, ResolvedElements } from "@/lib/card/types";
import { CardContext, type CardState, type EditHandlers, type Wish, type WishesState } from "./card-context";
import { renderNode, syncFormState } from "./card-nodes";

export type CardRendererProps = {
  tree: AstNode[];
  elements: ResolvedElements;
  features: DocFeatures;
  bodyClass: string;
  sections: string[]; // display order of top-level sections
  music: string | null; // custom song; null keeps the template's own
  cardId: string | null; // null for template demos (wishes/RSVP are not stored)
  edit?: EditHandlers | null;
  openPopup?: string | null; // editor-controlled popup
  extraCss?: string; // colour overrides (overrideCss)
};

/** Draws a converted LoveCard template with all of its interactive behaviour, as React. */
export function CardRenderer(props: CardRendererProps) {
  const { tree, elements, features, bodyClass, sections, music, cardId, edit = null, openPopup = null, extraCss = "" } = props;
  const [now, setNow] = useState<number | null>(null);
  const [mountedAt] = useState(() => Date.now());
  const [guestName, setGuestName] = useState<string | null>(null);
  const [popup, setPopup] = useState<string | null>(null);
  const [tabs, setTabs] = useState<Record<string, number>>({});
  const [display, setDisplay] = useState<Record<string, string>>({});
  const [styleRules, setStyleRules] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = useCallback((text: string) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  // Countdown clock; starts after mount so server and client markup match.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // Personalised invitations: ?Ten=<guest> replaces the "Quý khách" headline.
  useEffect(() => {
    const g = features.guestName;
    if (!g) return;
    const value = new URLSearchParams(window.location.search).get(g.param)?.trim();
    // Read after hydration: the query string is not part of the statically rendered page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGuestName(value || g.fallback);
  }, [features.guestName]);

  useBodyClass(bodyClass, !!edit);
  useIntroGate(edit ? undefined : features.introGate?.id);
  useAntiCopy(!edit && !!features.antiCopy);
  const musicState = useMusic(!edit && !!features.music, music, features.music?.audio);
  const wishes = useWishes(cardId, features, showToast);

  const runActions = useCallback(
    (actions: Action[]) => {
      for (const a of actions) {
        switch (a.type) {
          case "link":
            if (!a.href) break;
            if (a.target === "_blank") window.open(a.href, "_blank", "noopener");
            else window.location.href = a.href;
            break;
          case "phone":
            window.location.href = `tel:${a.phone}`;
            break;
          case "popup":
            setPopup(a.target);
            break;
          case "copy":
            void navigator.clipboard?.writeText(a.text).then(
              () => showToast("Đã sao chép!"),
              () => showToast(a.text),
            );
            break;
          case "tab":
            setTabs((t) => ({ ...t, [a.target]: a.index }));
            break;
          case "section":
            document.getElementById(a.target)?.scrollIntoView({ behavior: "smooth" });
            break;
          case "style": {
            const rules = [
              a.background && `#${a.target} .ladi-button-background, #${a.target} > .ladi-box { background-color: ${a.background} !important; }`,
              a.color && `#${a.target} .ladi-headline { color: ${a.color} !important; }`,
            ].filter(Boolean);
            setStyleRules((s) => ({ ...s, [a.target]: rules.join("\n") }));
            break;
          }
          case "toggle": {
            const target = document.getElementById(a.target);
            if (!target) break;
            const hidden = getComputedStyle(target).display === "none";
            setDisplay((d) => ({ ...d, [a.target]: hidden ? "block" : "none" }));
            break;
          }
        }
      }
    },
    [showToast],
  );

  const submitForm = useCallback(
    (form: HTMLFormElement) => {
      if (edit) return;
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      const name = String(data.get("name") ?? "").trim();
      const message = String(data.get("message") ?? "").trim();
      const extras: string[] = [];
      for (const [k, v] of data.entries()) if (k !== "name" && k !== "message" && String(v).trim()) extras.push(String(v).trim());
      const done = () => {
        form.reset();
        syncFormState(form);
        showToast("Cảm ơn bạn đã gửi lời chúc!");
        wishes.reload();
      };
      if (!cardId) return done();
      void fetch(`/api/cards/${cardId}/wishes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name || "Khách mời", message, attendance: extras.join(" · ") }),
      }).then((r) => (r.ok ? done() : showToast("Gửi không thành công, vui lòng thử lại.")), () => showToast("Gửi không thành công, vui lòng thử lại."));
    },
    [cardId, edit, showToast, wishes],
  );

  const activePopup = edit ? openPopup : popup;
  const state: CardState = {
    elements,
    features,
    cardId,
    edit,
    now,
    mountedAt,
    guestName,
    popup: activePopup,
    tabs,
    display,
    music: musicState,
    runActions,
    closePopup: () => (edit ? edit.onClosePopup() : setPopup(null)),
    submitForm,
    wishes: wishes.state,
  };

  const content = useMemo(() => reorderSections(tree, sections), [tree, sections]);
  const css = [extraCss, ...Object.values(styleRules)].filter(Boolean).join("\n");

  return (
    <CardContext.Provider value={state}>
      {css && <style>{css}</style>}
      {content.map((n, i) => renderNode(n, i))}
      {toast && <div className="lc-toast">{toast}</div>}
    </CardContext.Provider>
  );
}

/** Puts `.ladi-wraper`'s top-level sections in the card's chosen order; other children stay put. */
function reorderSections(tree: AstNode[], order: string[]): AstNode[] {
  return tree.map((node) => {
    if (typeof node === "string" || !node[1]?.className?.split(" ").includes("ladi-wraper")) return node;
    const [tag, props, ...children] = node;
    const byId = new Map<string, AstNode>();
    for (const c of children) if (typeof c !== "string" && c[1]?.$e && order.includes(c[1].$e)) byId.set(c[1].$e, c);
    const queue = order.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
    const next = children.map((c) => (typeof c !== "string" && c[1]?.$e && byId.has(c[1].$e) ? queue.shift()! : c));
    return [tag, props, ...next] as AstNode;
  });
}

// ---------------------------------------------------------------------------------------------
// Page-level behaviours

function useBodyClass(bodyClass: string, edit: boolean) {
  useEffect(() => {
    const classes = [...bodyClass.split(/\s+/).filter(Boolean), ...(edit ? ["lc-edit"] : [])];
    document.body.classList.add(...classes);
    return () => document.body.classList.remove(...classes);
  }, [bodyClass, edit]);
}

/** Cover screen: scrolling stays locked until the guest taps the "open" element. */
function useIntroGate(id: string | undefined) {
  useEffect(() => {
    if (!id) return;
    const html = document.documentElement;
    const body = document.body;
    const y = window.scrollY;
    body.style.top = `${-y}px`;
    html.classList.add("wt-scroll-locked");
    body.classList.add("wt-scroll-locked");
    let unlocked = false;
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      html.classList.remove("wt-scroll-locked");
      body.classList.remove("wt-scroll-locked");
      body.style.top = "";
      window.scrollTo(0, y);
      window.dispatchEvent(new CustomEvent("pageActivated"));
      cleanup();
    };
    const onClick = (e: Event) => {
      if ((e.target as Element | null)?.closest(`#${CSS.escape(id)}`)) unlock();
    };
    let touch: { x: number; y: number; t: number } | null = null;
    const onTouchStart = (e: TouchEvent) => {
      const p = e.touches[0];
      touch = p ? { x: p.clientX, y: p.clientY, t: Date.now() } : null;
    };
    const onTouchEnd = (e: TouchEvent) => {
      const p = e.changedTouches[0];
      if (!touch || !p) return;
      const moved = Math.hypot(p.clientX - touch.x, p.clientY - touch.y);
      if (moved < 10 && Date.now() - touch.t < 600) onClick(e);
    };
    const onWheel = (e: WheelEvent) => e.preventDefault();
    document.addEventListener("click", onClick, true);
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: false });
    const cleanup = () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("wheel", onWheel);
    };
    return () => {
      cleanup();
      html.classList.remove("wt-scroll-locked");
      body.classList.remove("wt-scroll-locked");
      body.style.top = "";
    };
  }, [id]);
}

function useAntiCopy(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onMenu = (e: Event) => e.preventDefault();
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      if (e.key === "F12" || (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(k)) || (e.ctrlKey && k === "U")) e.preventDefault();
    };
    const onDrag = (e: DragEvent) => {
      if ((e.target as Element | null)?.tagName === "IMG") e.preventDefault();
    };
    document.addEventListener("contextmenu", onMenu);
    document.addEventListener("keydown", onKey);
    document.addEventListener("dragstart", onDrag);
    return () => {
      document.removeEventListener("contextmenu", onMenu);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("dragstart", onDrag);
    };
  }, [enabled]);
}

/** Background music: starts on the guest's first interaction; the floating button toggles it. */
function useMusic(enabled: boolean, src: string | null, audioId: string | undefined): CardState["music"] {
  const [playing, setPlaying] = useState(false);
  const [pressed, setPressed] = useState(false);
  const audio = useCallback(() => (audioId ? (document.getElementById(audioId) as HTMLAudioElement | null) : null), [audioId]);

  useEffect(() => {
    if (!enabled) return;
    const events = ["click", "touchstart", "mousemove", "keydown"] as const;
    const start = () => {
      events.forEach((e) => document.removeEventListener(e, start));
      const a = audio();
      if (a?.paused) a.play().then(() => setPlaying(true), () => undefined);
    };
    events.forEach((e) => document.addEventListener(e, start, { passive: true }));
    return () => events.forEach((e) => document.removeEventListener(e, start));
  }, [enabled, audio, src]);

  const toggle = useCallback(() => {
    setPressed(true);
    setTimeout(() => setPressed(false), 300);
    const a = audio();
    if (!a) return;
    if (a.paused) a.play().then(() => setPlaying(true), () => undefined);
    else {
      a.pause();
      setPlaying(false);
    }
  }, [audio]);

  return { playing, pressed, toggle, src };
}

/** Guest-book widget (wsc-* ids): list, send, fireworks and the success dialog. */
function useWishes(cardId: string | null, features: DocFeatures, showToast: (t: string) => void) {
  const enabled = !!features.wishes;
  const [status, setStatus] = useState<WishesState["status"]>("loading");
  const [items, setItems] = useState<Wish[]>([]);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const attachCanvas = useCallback((c: HTMLCanvasElement | null) => {
    canvas.current = c;
  }, []);
  const color = features.wishes?.color ?? "#e91e63";

  const reload = useCallback(async () => {
    if (!cardId) {
      setStatus("ready");
      return;
    }
    try {
      const res = await fetch(`/api/cards/${cardId}/wishes`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { wishes: Wish[] };
      setItems(data.wishes);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [cardId]);

  useEffect(() => {
    // Loading wishes is a subscription to server data, so it runs after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (enabled) void reload();
  }, [enabled, reload]);

  const send = useCallback(async () => {
    const get = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
    const name = get("wsc-name");
    const message = get("wsc-message");
    const attendance = get("wsc-attendance");
    if (!name?.value.trim() || !message?.value.trim()) {
      alert("Vui lòng nhập tên và lời chúc nhé!");
      return;
    }
    setSending(true);
    try {
      if (cardId) {
        const res = await fetch(`/api/cards/${cardId}/wishes`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: name.value.trim(), message: message.value.trim(), attendance: attendance?.value.trim() ?? "" }),
        });
        if (!res.ok) throw new Error(String(res.status));
      }
      fireworks(canvas.current, color);
      setSuccess(true);
      name.value = "";
      message.value = "";
      if (attendance instanceof HTMLSelectElement) attendance.selectedIndex = 0;
      setTimeout(() => void reload(), 1000);
    } catch {
      showToast("Gửi không thành công, vui lòng thử lại.");
    } finally {
      setSending(false);
    }
  }, [cardId, color, reload, showToast]);

  const state: WishesState = {
    status,
    items,
    sending,
    success,
    send: () => void send(),
    dismiss: () => setSuccess(false),
    attachCanvas,
  };
  return { state, reload: () => void reload() };
}

function fireworks(canvas: HTMLCanvasElement | null, color: string) {
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = "block";
  let parts = Array.from({ length: 60 }, () => ({
    x: canvas.width / 2,
    y: canvas.height / 2,
    r: Math.random() * 3 + 1,
    vx: (Math.random() - 0.5) * 12,
    vy: (Math.random() - 0.5) * 12,
    a: 1,
  }));
  const frame = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of parts) {
      p.x += p.vx;
      p.y += p.vy;
      p.a -= 0.015;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = Math.max(0, p.a);
      ctx.fill();
    }
    parts = parts.filter((p) => p.a > 0);
    if (parts.length) requestAnimationFrame(frame);
    else canvas.style.display = "none";
  };
  frame();
}
