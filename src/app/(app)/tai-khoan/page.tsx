import Link from "next/link";
import { requireUser } from "@/lib/auth/server";
import { BRAND_NAME } from "@/lib/brand";
import { listTemplates } from "@/lib/card/docs";
import { listOwnCards } from "@/lib/cards";
import { deleteCardAction } from "./actions";

export const metadata = { title: `Thiệp của tôi · ${BRAND_NAME}` };

export default async function AccountPage() {
  const user = await requireUser("/tai-khoan");
  const [cards, templates] = await Promise.all([listOwnCards(user.id), listTemplates()]);
  const templateImage = new Map(templates.map((t) => [t.slug, t.image]));

  return (
    <main className="lc-page">
      <div className="lc-page-head">
        <div>
          <h1>Thiệp của tôi</h1>
          <p className="lc-muted">Thiệp mới ở trạng thái bản nháp; quản trị viên sẽ kích hoạt để khách mời xem được.</p>
        </div>
        <Link href="/tai-khoan/mau" className="lc-btn lc-btn-primary">
          + Tạo thiệp mới
        </Link>
      </div>

      {cards.length === 0 ? (
        <div className="lc-card lc-empty">
          <p>Bạn chưa có thiệp nào.</p>
          <Link href="/tai-khoan/mau" className="lc-btn lc-btn-primary">
            Chọn mẫu thiệp
          </Link>
        </div>
      ) : (
        <div className="lc-grid">
          {cards.map((card) => {
            const cover = Object.values(card.content.overrides ?? {}).find((o) => o.image)?.image ?? templateImage.get(card.template);
            return (
              <article key={card.id} className="lc-card lc-tile">
                <div className="lc-tile-img" style={cover ? { backgroundImage: `url("${cover}")` } : undefined} />
                <div className="lc-tile-body">
                  <div className="lc-row" style={{ justifyContent: "space-between" }}>
                    <span className="lc-tile-title">{card.title}</span>
                    <span className={`lc-badge${card.status === "active" ? " lc-badge-active" : ""}`}>
                      {card.status === "active" ? "Đã kích hoạt" : "Bản nháp"}
                    </span>
                  </div>
                  <a className="lc-link" href={`/thiep/${card.slug}`} target="_blank" rel="noopener">
                    /thiep/{card.slug}
                  </a>
                  <div className="lc-row" style={{ marginTop: "auto" }}>
                    <Link href={`/tai-khoan/thiep/${card.id}`} className="lc-btn lc-btn-primary lc-btn-sm">
                      Sửa thiệp
                    </Link>
                    <form action={deleteCardAction}>
                      <input type="hidden" name="id" value={card.id} />
                      <button className="lc-btn lc-btn-sm lc-btn-danger">Xoá</button>
                    </form>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
