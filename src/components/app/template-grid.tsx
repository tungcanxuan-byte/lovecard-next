import { createCardAction } from "@/app/(app)/tai-khoan/actions";
import { listTemplates } from "@/lib/card/docs";

/** Template tiles: preview the demo, or start a card from it (guests get a session on the fly). */
export async function TemplateGrid() {
  const templates = await listTemplates();
  return (
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
              <form action={createCardAction}>
                <input type="hidden" name="template" value={t.slug} />
                <button className="lc-btn lc-btn-primary lc-btn-sm">Dùng mẫu này</button>
              </form>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
