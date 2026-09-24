"use client";

import { useState } from "react";
import { changeSlugAction } from "@/app/(app)/tai-khoan/actions";
import type { OutlineItem } from "@/lib/card/outline";
import { FIELD_LABELS } from "@/lib/card/resolve";
import type { ResolvedElement } from "@/lib/card/types";
import type { EditorApi } from "./card-editor";

// ---------------------------------------------------------------------------------------------
// Thông tin: title, public link, quick fields, event date, music

type InfoProps = {
  api: EditorApi;
  cardId: string;
  title: string;
  setTitle: (v: string) => void;
  slug: string;
  onSlugSaved: (slug: string) => void;
  fields: string[];
  hasCountdown: boolean;
  countdownEnd: number | null;
  hasMusic: boolean;
  templateMusic: string | null;
  music: Array<{ url: string; label: string }>;
};

const toLocalInput = (ms: number | null | undefined) => {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function InfoPanel(props: InfoProps) {
  const { api, fields } = props;
  const { content, setContent } = api;
  const setField = (key: string, value: string) => setContent((c) => ({ ...c, fields: { ...c.fields, [key]: value } }));

  return (
    <>
      <label className="lc-field">
        <span>Tên thiệp (hiện khi chia sẻ link)</span>
        <input className="lc-input" value={props.title} maxLength={120} onChange={(e) => props.setTitle(e.target.value)} />
      </label>
      <SlugField cardId={props.cardId} slug={props.slug} onSaved={props.onSlugSaved} />

      <div className="lc-divider" />
      <h3>Thông tin nhanh</h3>
      {fields.length === 0 && <p className="lc-hint">Mẫu này chưa có ô nhập nhanh — bấm trực tiếp vào chữ trên thiệp để sửa.</p>}
      {fields.map((key) => (
        <label key={key} className="lc-field">
          <span>{FIELD_LABELS[key] ?? key}</span>
          <input className="lc-input" value={content.fields?.[key] ?? ""} maxLength={300} onChange={(e) => setField(key, e.target.value)} />
        </label>
      ))}
      {fields.length > 0 && <p className="lc-hint">Chữ bạn đã sửa trực tiếp trên thiệp sẽ giữ nguyên, không bị ô này ghi đè.</p>}

      {props.hasCountdown && (
        <>
          <div className="lc-divider" />
          <label className="lc-field">
            <span>Ngày giờ cưới (đồng hồ đếm ngược)</span>
            <input
              className="lc-input"
              type="datetime-local"
              value={toLocalInput(content.eventAt ?? props.countdownEnd)}
              onChange={(e) => {
                const ms = e.target.value ? new Date(e.target.value).getTime() : null;
                setContent((c) => ({ ...c, eventAt: ms && !Number.isNaN(ms) ? ms : null }));
              }}
            />
          </label>
        </>
      )}

      {props.hasMusic && <MusicField api={api} templateMusic={props.templateMusic} music={props.music} />}
    </>
  );
}

function SlugField({ cardId, slug, onSaved }: { cardId: string; slug: string; onSaved: (s: string) => void }) {
  const [value, setValue] = useState(slug);
  const [state, setState] = useState<{ error?: string; ok?: boolean; pending?: boolean }>({});
  const save = async () => {
    setState({ pending: true });
    const res = await changeSlugAction(cardId, value.trim());
    if (res.ok) {
      onSaved(value.trim());
      setState({ ok: true });
    } else setState({ error: res.error });
  };
  return (
    <div className="lc-field">
      <span>Đường dẫn thiệp</span>
      <div className="lc-row" style={{ flexWrap: "nowrap" }}>
        <span className="lc-hint">/thiep/</span>
        <input
          className="lc-input"
          value={value}
          maxLength={60}
          onChange={(e) => {
            setValue(e.target.value.toLowerCase());
            setState({});
          }}
        />
        <button type="button" className="lc-btn lc-btn-sm" disabled={state.pending || value.trim() === slug} onClick={save}>
          Lưu
        </button>
      </div>
      {state.error && <small className="lc-error">{state.error}</small>}
      {state.ok && <small className="lc-hint">Đã đổi đường dẫn.</small>}
    </div>
  );
}

function MusicField({ api, templateMusic, music }: { api: EditorApi; templateMusic: string | null; music: InfoProps["music"] }) {
  const { content, setContent } = api;
  const current = content.music ?? null;
  const [customMode, setCustomMode] = useState(current !== null && !music.some((m) => m.url === current));
  const [custom, setCustom] = useState(customMode ? (current ?? "") : "");
  const setMusic = (url: string | null) => setContent((c) => ({ ...c, music: url }));
  return (
    <>
      <div className="lc-divider" />
      <label className="lc-field">
        <span>Nhạc nền</span>
        <select
          className="lc-input"
          value={customMode ? "custom" : (current ?? "")}
          onChange={(e) => {
            const v = e.target.value;
            setCustomMode(v === "custom");
            if (v !== "custom") setMusic(v || null);
            else if (/^https:\/\/\S+$/.test(custom)) setMusic(custom);
          }}
        >
          <option value="">Nhạc mặc định của mẫu</option>
          {music
            .filter((m) => m.url !== templateMusic)
            .map((m) => (
              <option key={m.url} value={m.url}>
                {m.label}
              </option>
            ))}
          <option value="custom">Link nhạc khác (https)...</option>
        </select>
      </label>
      {customMode && (
        <label className="lc-field">
          <span>Link file nhạc (mp3)</span>
          <input
            className="lc-input"
            placeholder="https://..."
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              if (/^https:\/\/\S+$/.test(e.target.value)) setMusic(e.target.value);
            }}
          />
        </label>
      )}
      {(current ?? templateMusic) && <audio controls src={current ?? templateMusic ?? undefined} style={{ width: "100%" }} preload="none" />}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Bố cục: section order and visibility, popups

export function LayoutPanel({ api, sections, popups }: { api: EditorApi; sections: OutlineItem[]; popups: OutlineItem[] }) {
  const { content, setContent, patchOverride, clearOverride } = api;
  const byId = new Map(sections.map((s) => [s.id, s]));
  const order = [...(content.sections ?? []).filter((id) => byId.has(id)), ...sections.map((s) => s.id).filter((id) => !content.sections?.includes(id))];

  const move = (index: number, delta: number) => {
    const next = [...order];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setContent((c) => ({ ...c, sections: next }));
  };

  return (
    <>
      <div>
        <h3>Các phần của thiệp</h3>
        <p className="lc-hint">Kéo lên/xuống để đổi thứ tự, bấm mắt để ẩn hoặc hiện.</p>
      </div>
      <div className="lc-stack" style={{ gap: 6 }}>
        {order.map((id, i) => {
          const hidden = !!content.overrides?.[id]?.hidden;
          return (
            <div key={id} className={`lc-section-row${hidden ? " is-hidden" : ""}`}>
              <button type="button" className="lc-link" onClick={() => api.scrollTo(id)} title="Cuộn tới phần này">
                {byId.get(id)?.label ?? id}
              </button>
              <button type="button" className="lc-icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Lên">
                ↑
              </button>
              <button type="button" className="lc-icon-btn" disabled={i === order.length - 1} onClick={() => move(i, 1)} aria-label="Xuống">
                ↓
              </button>
              <button
                type="button"
                className="lc-icon-btn"
                onClick={() => (hidden ? clearOverride(id, ["hidden"]) : patchOverride(id, { hidden: true }))}
                aria-label={hidden ? "Hiện" : "Ẩn"}
                title={hidden ? "Hiện phần này" : "Ẩn phần này"}
              >
                {hidden ? "◌" : "●"}
              </button>
            </div>
          );
        })}
      </div>

      {popups.length > 0 && (
        <>
          <div className="lc-divider" />
          <div>
            <h3>Popup</h3>
            <p className="lc-hint">Mở popup (hộp mừng cưới, gửi lời chúc...) để sửa nội dung bên trong.</p>
          </div>
          <div className="lc-stack" style={{ gap: 6 }}>
            {popups.map((p) => (
              <div key={p.id} className="lc-section-row">
                <span className="lc-link" style={{ cursor: "default" }}>
                  {p.label}
                </span>
                <button type="button" className="lc-btn lc-btn-sm" onClick={() => api.setPopup(api.popup === p.id ? null : p.id)}>
                  {api.popup === p.id ? "Đóng" : "Mở"}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Phần tử: whatever was clicked on the card

const TYPE_LABELS: Record<string, string> = {
  headline: "Tiêu đề",
  paragraph: "Đoạn văn",
  image: "Ảnh",
  button: "Nút bấm",
  box: "Khối nền",
  section: "Phần",
  group: "Nhóm",
  gallery: "Bộ sưu tập ảnh",
  carousel: "Băng chuyền",
  countdown: "Đồng hồ đếm ngược",
  countdown_item: "Đồng hồ đếm ngược",
  popup: "Popup",
  shape: "Hình trang trí",
  line: "Đường kẻ",
  form: "Biểu mẫu",
  form_item: "Ô nhập liệu",
  frame: "Khung",
  tabs: "Thẻ",
  video: "Video",
  html_code: "Mã nhúng",
};

const TEXT_COLOR_TYPES = new Set(["headline", "paragraph", "shape", "button", "countdown", "countdown_item"]);
const BACKGROUND_TYPES = new Set(["box", "section", "button", "frame", "popup"]);

export function ElementPanel({ api, id, el }: { api: EditorApi; id: string | null; el: ResolvedElement | null }) {
  if (!id || !el) {
    return (
      <div className="lc-empty">
        <p>Bấm vào chữ, ảnh hoặc khối bất kỳ trên thiệp để chỉnh sửa.</p>
        <p className="lc-hint">Bấm vào chữ để gõ trực tiếp · Bấm đúp vào ảnh để đổi ảnh.</p>
      </div>
    );
  }
  const override = api.content.overrides?.[id] ?? {};
  const copy = el.actions?.find((a) => a.type === "copy");
  const link = el.actions?.find((a) => a.type === "link");

  return (
    <>
      <div className="lc-row" style={{ justifyContent: "space-between" }}>
        <h3>{TYPE_LABELS[el.t] ?? el.t}</h3>
        <span className="lc-hint">{id}</span>
      </div>

      <label className="lc-row">
        <input
          type="checkbox"
          checked={!!override.hidden}
          onChange={(e) => (e.target.checked ? api.patchOverride(id, { hidden: true }) : api.clearOverride(id, ["hidden"]))}
        />
        Ẩn phần tử này
      </label>

      {el.text != null && (
        <div className="lc-stack" style={{ gap: 6 }}>
          <p className="lc-hint" style={{ margin: 0 }}>
            Bấm vào chữ trên thiệp để gõ trực tiếp.
          </p>
          {override.text != null && (
            <button type="button" className="lc-btn lc-btn-sm" onClick={() => api.clearOverride(id, ["text"])}>
              Bỏ chữ đã sửa (dùng thông tin nhanh)
            </button>
          )}
        </div>
      )}

      {el.image && (
        <div className="lc-stack" style={{ gap: 6 }}>
          <div className="lc-tile-img" style={{ backgroundImage: `url("${el.image}")`, borderRadius: 6, border: "1px solid var(--lc-border)" }} />
          <button type="button" className="lc-btn lc-btn-primary lc-btn-sm" disabled={api.uploading} onClick={() => api.pickImage({ id })}>
            {api.uploading ? "Đang tải ảnh..." : "Đổi ảnh"}
          </button>
        </div>
      )}

      {el.gallery && <GalleryEditor api={api} id={id} items={el.gallery} />}

      {copy && (
        <label className="lc-field">
          <span>Nội dung khi bấm “sao chép”</span>
          <input className="lc-input" value={override.copy ?? copy.text} maxLength={500} onChange={(e) => api.patchOverride(id, { copy: e.target.value })} />
        </label>
      )}
      {link && (
        <label className="lc-field">
          <span>Liên kết (bản đồ, mạng xã hội...)</span>
          <input
            className="lc-input"
            value={override.href ?? link.href}
            placeholder="https://"
            onChange={(e) => api.patchOverride(id, { href: e.target.value })}
          />
          <small className="lc-hint">Bắt đầu bằng https://, tel: hoặc mailto:</small>
        </label>
      )}

      {TEXT_COLOR_TYPES.has(el.t) && (
        <ColorField label="Màu chữ / màu hình" value={override.color} onChange={(v) => (v ? api.patchOverride(id, { color: v }) : api.clearOverride(id, ["color"]))} />
      )}
      {BACKGROUND_TYPES.has(el.t) && (
        <ColorField label="Màu nền" value={override.background} onChange={(v) => (v ? api.patchOverride(id, { background: v }) : api.clearOverride(id, ["background"]))} />
      )}

      {(el.t === "countdown" || el.t === "countdown_item") && <p className="lc-hint">Đặt ngày giờ cưới ở tab Thông tin.</p>}
    </>
  );
}

function ColorField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string | null) => void }) {
  return (
    <div className="lc-field">
      <span>{label}</span>
      <div className="lc-color">
        <input type="color" value={value ?? "#000000"} onChange={(e) => onChange(e.target.value)} />
        <span className="lc-hint">{value ?? "Theo mẫu"}</span>
        {value && (
          <button type="button" className="lc-link" onClick={() => onChange(null)}>
            Bỏ màu
          </button>
        )}
      </div>
    </div>
  );
}

function GalleryEditor({ api, id, items }: { api: EditorApi; id: string; items: NonNullable<ResolvedElement["gallery"]> }) {
  const remove = (index: number) => api.patchOverride(id, { gallery: items.filter((_, i) => i !== index) });
  return (
    <div className="lc-field">
      <span>Ảnh trong bộ sưu tập ({items.length})</span>
      <div className="lc-thumbs">
        {items.map((g, i) => (
          <div key={`${g.src}-${i}`} style={{ position: "relative" }}>
            <button
              type="button"
              style={{ backgroundImage: `url("${g.thumb || g.src}")`, width: "100%" }}
              title="Đổi ảnh này"
              onClick={() => api.pickImage({ id, gallery: { items, index: i } })}
            />
            {items.length > 1 && (
              <button
                type="button"
                className="lc-icon-btn"
                style={{ position: "absolute", top: 2, right: 2, width: 20, height: 20, fontSize: 11 }}
                aria-label="Xoá ảnh"
                onClick={() => remove(i)}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="lc-btn lc-btn-sm"
        disabled={api.uploading}
        onClick={() => api.pickImage({ id, gallery: { items: [...items, { src: "", thumb: "" }], index: items.length } })}
      >
        + Thêm ảnh
      </button>
      <small className="lc-hint">Bấm vào ảnh để thay.</small>
    </div>
  );
}
