import Link from "next/link";
import { SettingsForm } from "@/components/app/settings-form";
import { requireAdmin } from "@/lib/auth/server";
import { BRAND_NAME } from "@/lib/brand";
import { listAllCards, listUsers, orderCode } from "@/lib/cards";
import { getContacts, getOrderSettings } from "@/lib/settings";
import { adminDeleteCardAction, setCardStatusAction, setUserRoleAction } from "./actions";

export const metadata = { title: `Quản trị · ${BRAND_NAME}` };

const date = (d: Date) => d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const me = await requireAdmin();
  const { tab } = await searchParams;
  const showUsers = tab === "users";
  const showSettings = tab === "settings";
  const [allCards, users, contacts, order] = await Promise.all([listAllCards(), listUsers(), getContacts(), getOrderSettings()]);
  const isPending = (c: (typeof allCards)[number]) => c.card.status === "draft" && !!c.card.paidAt;
  // Paid cards waiting for approval first.
  const cards = [...allCards.filter(isPending), ...allCards.filter((c) => !isPending(c))];
  const pending = cards.filter(isPending).length;
  const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase());

  return (
    <main className="lc-page">
      <div className="lc-page-head">
        <div>
          <h1>Quản trị</h1>
          <p className="lc-muted">
            {cards.length} thiệp · {pending} chờ duyệt thanh toán · {users.length} người dùng
          </p>
        </div>
        <div className="lc-row">
          <Link href="/admin" className={`lc-btn lc-btn-sm${showUsers || showSettings ? "" : " lc-btn-primary"}`}>
            Thiệp
          </Link>
          <Link href="/admin?tab=users" className={`lc-btn lc-btn-sm${showUsers ? " lc-btn-primary" : ""}`}>
            Người dùng
          </Link>
          <Link href="/admin?tab=settings" className={`lc-btn lc-btn-sm${showSettings ? " lc-btn-primary" : ""}`}>
            Cài đặt
          </Link>
        </div>
      </div>

      <div className="lc-card" style={{ overflowX: "auto" }}>
        {showSettings ? (
          <SettingsForm contacts={contacts} order={order} />
        ) : showUsers ? (
          <table className="lc-table">
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Ngày tạo</th>
                <th>Vai trò</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isAdmin = u.role === "admin" || adminEmails.includes(u.email.toLowerCase());
                const fixed = adminEmails.includes(u.email.toLowerCase()) || u.id === me.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <div>{u.name}</div>
                      <div className="lc-hint">{u.email}</div>
                    </td>
                    <td>{date(u.createdAt)}</td>
                    <td>
                      <span className={`lc-badge${isAdmin ? "" : " lc-badge-active"}`}>{isAdmin ? "Quản trị" : "Khách hàng"}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {!fixed && (
                        <form action={setUserRoleAction}>
                          <input type="hidden" name="id" value={u.id} />
                          <input type="hidden" name="role" value={isAdmin ? "user" : "admin"} />
                          <button className="lc-btn lc-btn-sm">{isAdmin ? "Bỏ quyền quản trị" : "Cấp quyền quản trị"}</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : cards.length === 0 ? (
          <p className="lc-empty">Chưa có thiệp nào.</p>
        ) : (
          <table className="lc-table">
            <thead>
              <tr>
                <th>Thiệp</th>
                <th>Chủ thiệp</th>
                <th>Mẫu</th>
                <th>Cập nhật</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cards.map(({ card, ownerEmail, ownerName, ownerIsGuest }) => (
                <tr key={card.id}>
                  <td>
                    <div>{card.title}</div>
                    <div className="lc-hint">Mã: {orderCode(card)}</div>
                    <a className="lc-link lc-hint" href={`/thiep/${card.slug}`} target="_blank" rel="noopener">
                      /thiep/{card.slug}
                    </a>
                  </td>
                  <td>
                    {ownerIsGuest ? (
                      <div className="lc-muted">Khách (không tài khoản)</div>
                    ) : (
                      <>
                        <div>{ownerName}</div>
                        <div className="lc-hint">{ownerEmail}</div>
                      </>
                    )}
                  </td>
                  <td>{card.template}</td>
                  <td>{date(card.updatedAt)}</td>
                  <td>
                    <span className={`lc-badge${card.status === "active" ? " lc-badge-active" : ""}`}>
                      {card.status === "active" ? "Đã kích hoạt" : card.paidAt ? "Chờ duyệt" : "Bản nháp"}
                    </span>
                    {card.paidAt && card.status === "draft" && <div className="lc-hint">Báo chuyển khoản {date(card.paidAt)}</div>}
                  </td>
                  <td>
                    <div className="lc-row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                      <form action={setCardStatusAction}>
                        <input type="hidden" name="id" value={card.id} />
                        <input type="hidden" name="status" value={card.status === "active" ? "draft" : "active"} />
                        <button className={`lc-btn lc-btn-sm${card.status === "active" ? "" : " lc-btn-primary"}`}>
                          {card.status === "active" ? "Huỷ kích hoạt" : "Kích hoạt"}
                        </button>
                      </form>
                      <Link href={`/tai-khoan/thiep/${card.id}`} className="lc-btn lc-btn-sm">
                        Sửa
                      </Link>
                      <form action={adminDeleteCardAction}>
                        <input type="hidden" name="id" value={card.id} />
                        <button className="lc-btn lc-btn-sm lc-btn-danger">Xoá</button>
                      </form>
                    </div>
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
