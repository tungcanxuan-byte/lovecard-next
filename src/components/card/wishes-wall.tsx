"use client";

import { useEffect, useRef, useState } from "react";
import { useCard } from "./card-context";

/**
 * Public wedding guestbook & wishes feed rendered on all active cards.
 * Displays all wishes submitted by guests, with smooth scrolling, real-time reload, and RSVP attendance badges.
 */
export function WishesWall() {
  const { wishes, cardId } = useCard();
  const listRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-scroll effect when there are enough wishes
  useEffect(() => {
    const el = listRef.current;
    if (!el || wishes.items.length <= 2 || isPaused) return;

    const interval = setInterval(() => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
        el.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ top: 1, behavior: "auto" });
      }
    }, 40);

    return () => clearInterval(interval);
  }, [wishes.items.length, isPaused]);

  if (!cardId) return null;

  const count = wishes.items.length;

  const scrollToForm = () => {
    const form = document.querySelector("form");
    if (form) {
      form.scrollIntoView({ behavior: "smooth", block: "center" });
      const firstInput = form.querySelector("input, textarea") as HTMLElement | null;
      firstInput?.focus();
    }
  };

  return (
    <section className="lc-wishes-wall-section" aria-label="Sổ lưu bút & Lời chúc mừng">
      <div className="lc-wishes-wall-container">
        <div className="lc-wishes-wall-header">
          <div className="lc-wishes-icon">💌</div>
          <h2 className="lc-wishes-title">SỔ LƯU BÚT CƯỚI</h2>
          <p className="lc-wishes-subtitle">Những lời chúc mừng ý nghĩa từ người thân & bạn bè</p>
          <div className="lc-wishes-badge">
            {count > 0 ? `${count} lời chúc phúc đã gửi` : "Chưa có lời chúc nào"}
          </div>
        </div>

        {wishes.status === "loading" && count === 0 && (
          <div className="lc-wishes-empty">Đang tải những lời chúc yêu thương…</div>
        )}

        {count === 0 && wishes.status !== "loading" && (
          <div className="lc-wishes-empty">
            <p>Chưa có lời chúc nào được gửi.</p>
            <p className="lc-wishes-hint">Hãy là người đầu tiên gửi những lời chúc tốt đẹp nhất đến cặp đôi nhé! 💐</p>
            <button type="button" onClick={scrollToForm} className="lc-wishes-cta-btn">
              ✍️ Gửi lời chúc mừng ngay
            </button>
          </div>
        )}

        {count > 0 && (
          <>
            <div
              ref={listRef}
              className="lc-wishes-list"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              onTouchStart={() => setIsPaused(true)}
              onTouchEnd={() => setIsPaused(false)}
            >
              {wishes.items.map((w, i) => (
                <div key={w.id ?? i} className="lc-wish-card">
                  <div className="lc-wish-card-head">
                    <div className="lc-wish-avatar">{w.name.trim().slice(0, 1).toUpperCase()}</div>
                    <div className="lc-wish-meta">
                      <span className="lc-wish-name">{w.name}</span>
                      {w.createdAt && (
                        <span className="lc-wish-date">
                          {new Date(w.createdAt).toLocaleDateString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                    {w.attendance && (
                      <span className="lc-wish-badge-att" title="Xác nhận tham dự">
                        {w.attendance.includes("Có") ? "✨ " : ""}{w.attendance}
                      </span>
                    )}
                  </div>
                  <div className="lc-wish-content">{w.message}</div>
                </div>
              ))}
            </div>

            <div className="lc-wishes-footer">
              <button type="button" onClick={scrollToForm} className="lc-wishes-cta-btn">
                ✍️ Gửi thêm lời chúc mừng
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
