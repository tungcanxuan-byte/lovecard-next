"use client";

import { useActionState } from "react";
import { saveContactsAction, type SaveContactsState } from "@/app/(app)/admin/actions";
import type { Contacts } from "@/lib/brand";

const FIELDS: Array<{ key: keyof Contacts; label: string; placeholder: string }> = [
  { key: "hotline", label: "Hotline", placeholder: "0348889995" },
  { key: "zalo", label: "Zalo (số điện thoại)", placeholder: "0348889995" },
  { key: "facebook", label: "Facebook", placeholder: "https://www.facebook.com/..." },
  { key: "tiktok", label: "TikTok", placeholder: "https://www.tiktok.com/@ten hoặc @ten" },
];

/** Site contacts used by the contact icons and footer texts on every template. */
export function ContactsForm({ contacts }: { contacts: Contacts }) {
  const [state, action, pending] = useActionState<SaveContactsState, FormData>(saveContactsAction, {});
  return (
    <form action={action} className="lc-stack" style={{ padding: 20, maxWidth: 520 }}>
      <div>
        <h2>Thông tin liên hệ</h2>
        <p className="lc-hint">Hiển thị ở biểu tượng liên hệ và chân trang của các mẫu thiệp. Để trống để ẩn.</p>
      </div>
      {FIELDS.map((f) => (
        <label key={f.key} className="lc-field">
          <span>{f.label}</span>
          <input className="lc-input" name={f.key} defaultValue={contacts[f.key]} placeholder={f.placeholder} />
        </label>
      ))}
      {state.error && <p className="lc-error">{state.error}</p>}
      <div className="lc-row">
        <button className="lc-btn lc-btn-primary" disabled={pending}>
          {pending ? "Đang lưu…" : "Lưu"}
        </button>
        {state.saved && !pending && <span className="lc-hint">Đã lưu.</span>}
      </div>
    </form>
  );
}
