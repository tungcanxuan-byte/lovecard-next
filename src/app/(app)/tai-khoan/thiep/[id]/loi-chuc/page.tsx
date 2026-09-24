import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { BRAND_NAME } from "@/lib/brand";
import { getEditableCard, listWishes } from "@/lib/cards";

export const metadata = { title: `Sổ lưu bút & Lời chúc · ${BRAND_NAME}` };

export default async function WishesPage({ params }: PageProps<"/tai-khoan/thiep/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/tai-khoan/thiep/${id}`);
  const card = await getEditableCard(id, user);
  if (!card) notFound();

  const wishes = await listWishes(card.id, 500);
  const attending = wishes.filter((w) => w.attendance && w.attendance.includes("Có")).length;

  return (
    <main className="lc-page">
      <div className="lc-page-head">
        <div>
          <Link href="/tai-khoan" className="lc-link lc-hint" style={{ display: "inline-block", marginBottom: 6 }}>
            ← Quay lại danh sách thiệp
          </Link>
          <h1>Sổ lưu bút & Lời chúc</h1>
          <p className="lc-muted">
            Thiệp: <strong>{card.title}</strong> · {wishes.length} lời chúc · {attending} khách xác nhận tham dự
          </p>
        </div>
        <div className="lc-row">
          <Link href={`/thiep/${card.slug}`} target="_blank" className="lc-btn lc-btn-sm lc-btn-primary">
            Xem thiệp ↗
          </Link>
          <Link href={`/tai-khoan/thiep/${card.id}`} className="lc-btn lc-btn-sm">
            Sửa thiệp
          </Link>
        </div>
      </div>

      <div className="lc-card" style={{ overflowX: "auto" }}>
        {wishes.length === 0 ? (
          <div className="lc-empty" style={{ padding: 40, textAlign: "center" }}>
            <p>Chưa có lời chúc nào được gửi cho thiệp này.</p>
            <p className="lc-hint">Chia sẻ link thiệp cho bạn bè để nhận những lời chúc tốt đẹp nhất!</p>
          </div>
        ) : (
          <table className="lc-table">
            <thead>
              <tr>
                <th style={{ width: 180 }}>Khách mời</th>
                <th>Lời chúc</th>
                <th style={{ width: 180 }}>Xác nhận tham dự</th>
                <th style={{ width: 140 }}>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {wishes.map((w) => (
                <tr key={w.id}>
                  <td>
                    <strong>{w.name}</strong>
                  </td>
                  <td style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{w.message}</td>
                  <td>
                    {w.attendance ? (
                      <span className={`lc-badge${w.attendance.includes("Có") ? " lc-badge-active" : ""}`}>
                        {w.attendance}
                      </span>
                    ) : (
                      <span className="lc-hint">—</span>
                    )}
                  </td>
                  <td className="lc-hint">
                    {new Date(w.createdAt).toLocaleDateString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
