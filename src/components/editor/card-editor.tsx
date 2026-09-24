"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveCardAction } from "@/app/(app)/tai-khoan/actions";
import type { OutlineItem } from "@/lib/card/outline";
import type { CardContent, ElementOverride, GalleryItem, ResolvedElement } from "@/lib/card/types";
import { ElementPanel, InfoPanel, LayoutPanel } from "./editor-panels";
import { fromSameOrigin, type FromCanvas, type ToCanvas } from "./protocol";

export type EditorCard = { id: string; slug: string; title: string; status: "draft" | "active"; content: CardContent };

type Props = {
  card: EditorCard;
  fields: string[];
  sections: OutlineItem[];
  popups: OutlineItem[];
  hasCountdown: boolean;
  countdownEnd: number | null;
  hasMusic: boolean;
  templateMusic: string | null;
  music: Array<{ url: string; label: string }>;
};

type Tab = "info" | "layout" | "element";
type SaveState = "saved" | "dirty" | "saving" | "error";
type ImageTarget = { id: string; gallery?: { items: GalleryItem[]; index: number } };

export type EditorApi = {
  content: CardContent;
  setContent: (update: (c: CardContent) => CardContent) => void;
  patchOverride: (id: string, patch: Partial<ElementOverride>) => void;
  clearOverride: (id: string, keys: Array<keyof ElementOverride>) => void;
  pickImage: (target: ImageTarget) => void;
  uploading: boolean;
  scrollTo: (id: string) => void;
  popup: string | null;
  setPopup: (id: string | null) => void;
};

export async function uploadImage(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? "Tải ảnh lên không thành công.");
  return data.url;
}

/** Card editor: settings panel on the left, the live card in a phone-sized iframe on the right. */
export function CardEditor({ card, fields, sections, popups, hasCountdown, countdownEnd, hasMusic, templateMusic, music }: Props) {
  const [title, setTitleState] = useState(card.title);
  const [content, setContentState] = useState(card.content);
  const [tab, setTab] = useState<Tab>("info");
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedEl, setSelectedEl] = useState<ResolvedElement | null>(null);
  const [popup, setPopup] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const imageTarget = useRef<ImageTarget | null>(null);
  const canvasReady = useRef(false);

  const send = useCallback((msg: ToCanvas) => {
    frame.current?.contentWindow?.postMessage(msg, window.location.origin);
  }, []);

  // Bumped on every edit so a slow save never marks newer edits as saved.
  const revision = useRef(0);
  const setContent = useCallback((update: (c: CardContent) => CardContent) => {
    revision.current++;
    setContentState(update);
    setSaveState("dirty");
  }, []);
  const setTitle = (value: string) => {
    revision.current++;
    setTitleState(value);
    setSaveState("dirty");
  };

  // Latest editor state, for replying to a (re)loaded canvas.
  const latest = useRef<ToCanvas>({ type: "state", content, selected, popup });
  useEffect(() => {
    latest.current = { type: "state", content, selected, popup };
  });

  const patchOverride = useCallback(
    (id: string, patch: Partial<ElementOverride>) =>
      setContent((c) => ({ ...c, overrides: { ...c.overrides, [id]: { ...c.overrides?.[id], ...patch } } })),
    [setContent],
  );

  const clearOverride = useCallback(
    (id: string, keys: Array<keyof ElementOverride>) =>
      setContent((c) => {
        const current = { ...c.overrides?.[id] };
        for (const k of keys) delete current[k];
        const overrides = { ...c.overrides };
        if (Object.keys(current).length) overrides[id] = current;
        else delete overrides[id];
        return { ...c, overrides };
      }),
    [setContent],
  );

  const pickImage = useCallback((target: ImageTarget) => {
    imageTarget.current = target;
    fileInput.current?.click();
  }, []);

  const onFile = async (file: File | undefined) => {
    const target = imageTarget.current;
    if (!file || !target) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      if (target.gallery) {
        const items = [...target.gallery.items];
        items[target.gallery.index] = { src: url, thumb: url };
        patchOverride(target.id, { gallery: items });
      } else {
        patchOverride(target.id, { image: url });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Tải ảnh lên không thành công.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  // Canvas → editor.
  useEffect(() => {
    const onMessage = (e: MessageEvent<FromCanvas>) => {
      if (!fromSameOrigin(e) || e.source !== frame.current?.contentWindow) return;
      const msg = e.data;
      switch (msg.type) {
        case "ready":
          canvasReady.current = true;
          send(latest.current);
          break;
        case "select":
          setSelected(msg.id);
          setTab("element");
          break;
        case "selected":
          setSelectedEl(msg.el);
          break;
        case "text":
          patchOverride(msg.id, { text: msg.html });
          break;
        case "pick-image":
          pickImage({ id: msg.id });
          break;
        case "pick-gallery":
          pickImage({ id: msg.id, gallery: { items: msg.gallery, index: msg.index } });
          break;
        case "close-popup":
          setPopup(null);
          break;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [patchOverride, pickImage, send]);

  // Editor → canvas.
  useEffect(() => {
    if (canvasReady.current) send({ type: "state", content, selected, popup });
  }, [content, selected, popup, send]);

  // Autosave shortly after the last change.
  useEffect(() => {
    if (saveState !== "dirty") return;
    const t = setTimeout(async () => {
      const saving = revision.current;
      setSaveState("saving");
      const res = await saveCardAction(card.id, { title, content }).catch(() => ({ ok: false as const, error: "Mất kết nối, chưa lưu được." }));
      if (revision.current !== saving) return; // newer edits are queued; their save reports status
      setSaveState(res.ok ? "saved" : "error");
      setSaveError(res.ok ? null : res.error);
    }, 800);
    return () => clearTimeout(t);
  }, [card.id, title, content, saveState]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (saveState === "saved") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveState]);

  const api: EditorApi = {
    content,
    setContent,
    patchOverride,
    clearOverride,
    pickImage,
    uploading,
    scrollTo: (id) => send({ type: "scroll", id }),
    popup,
    setPopup,
  };

  const [slug, setSlug] = useState(card.slug);
  const saveLabel = { saved: "Đã lưu", dirty: "Chưa lưu...", saving: "Đang lưu...", error: saveError ?? "Lỗi khi lưu" }[saveState];

  return (
    <div className="lc-editor">
      <aside className="lc-panel">
        <div className="lc-panel-head">
          <div className="lc-row" style={{ justifyContent: "space-between" }}>
            <Link href="/tai-khoan" className="lc-link">
              ← Thiệp của tôi
            </Link>
            <span className={`lc-badge${card.status === "active" ? " lc-badge-active" : ""}`}>
              {card.status === "active" ? "Đã kích hoạt" : "Bản nháp"}
            </span>
          </div>
          <div className="lc-row" style={{ justifyContent: "space-between" }}>
            <span className="lc-save-state" style={saveState === "error" ? { color: "var(--lc-danger)" } : undefined}>
              {uploading ? "Đang tải ảnh lên..." : saveLabel}
            </span>
            <a href={`/thiep/${slug}`} target="_blank" rel="noopener" className="lc-btn lc-btn-sm">
              Xem thiệp ↗
            </a>
          </div>
        </div>
        <div className="lc-tabs" role="tablist">
          {(
            [
              ["info", "Thông tin"],
              ["layout", "Bố cục"],
              ["element", "Phần tử"],
            ] as const
          ).map(([key, label]) => (
            <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>
        <div className="lc-panel-body">
          {tab === "info" && (
            <InfoPanel
              api={api}
              cardId={card.id}
              title={title}
              setTitle={setTitle}
              slug={slug}
              onSlugSaved={setSlug}
              fields={fields}
              hasCountdown={hasCountdown}
              countdownEnd={countdownEnd}
              hasMusic={hasMusic}
              templateMusic={templateMusic}
              music={music}
            />
          )}
          {tab === "layout" && <LayoutPanel api={api} sections={sections} popups={popups} />}
          {tab === "element" && <ElementPanel api={api} id={selected} el={selected ? selectedEl : null} />}
        </div>
      </aside>
      <div className="lc-stage">
        <iframe ref={frame} src={`/khung/${card.id}`} className="lc-phone" title="Xem trước thiệp" />
      </div>
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
    </div>
  );
}
