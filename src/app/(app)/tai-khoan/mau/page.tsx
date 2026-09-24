import Link from "next/link";
import { getUser } from "@/lib/auth/server";
import { listTemplates } from "@/lib/card/docs";
import { createCardAction } from "../actions";

export const metadata = { title: "Chọn mẫu thiệp · LoveCard" };

export default async function TemplatesPage() {
  const [user, templates] = await Promise.all([getUser(), listTemplates()]);
  return (
    <main className="lc-page">
      <div className="lc-page-head">
        <div>
          <h1>Chọn mẫu thiệp</h1>
          <p className="lc-muted">Xem thử từng mẫu, rồi bấm “Dùng mẫu này” để bắt đầu chỉnh sửa.</p>
        </div>
      </div>
      <div className="lc-grid">
        {templates.map((t) => (
          <article key={t.slug} className="lc-card lc-tile">
            <div className="lc-tile-img" style={t.image ? { backgroundImage: `url("${t.image}")` } : undefined} />
            <div className="lc-tile-body">
              <span className="lc-tile-title">{t.title}</span>
              <span className="lc-hint">{t.slug}</span>
              <div className="lc-row" style={{ marginTop: "auto" }}>
                <a href={`/${t.slug}`} target="_blank" rel="noopener" className="lc-btn lc-btn-sm">
                  Xem mẫu
                </a>
                {user ? (
                  <form action={createCardAction}>
                    <input type="hidden" name="template" value={t.slug} />
                    <button className="lc-btn lc-btn-primary lc-btn-sm">Dùng mẫu này</button>
                  </form>
                ) : (
                  <Link href="/dang-nhap?next=/tai-khoan/mau" className="lc-btn lc-btn-primary lc-btn-sm">
                    Dùng mẫu này
                  </Link>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
