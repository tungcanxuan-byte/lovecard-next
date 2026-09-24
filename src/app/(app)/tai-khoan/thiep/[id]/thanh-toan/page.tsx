import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/app/copy-button";
import { requireUser } from "@/lib/auth/server";
import { BANK_QR, BRAND_NAME, DEFAULT_BANK, SITE_URL, zaloUrl } from "@/lib/brand";
import { getEditableCard, orderCode } from "@/lib/cards";
import { getContacts, getOrderSettings } from "@/lib/settings";
import { markPaidAction } from "../../../actions";

export const metadata = { title: `Thanh toán · ${BRAND_NAME}` };

export default async function PaymentPage({ params }: PageProps<"/tai-khoan/thiep/[id]/thanh-toan">) {
  const { id } = await params;
  const user = await requireUser(`/tai-khoan/thiep/${id}/thanh-toan`);
  const card = await getEditableCard(id, user);
  if (!card) notFound();
  const [contacts, { price }] = await Promise.all([getContacts(), getOrderSettings()]);
  const code = orderCode(card);
  const link = `${SITE_URL}/thiep/${card.slug}`;
  const message = `Chào admin ${BRAND_NAME}, mình đã đặt thiệp và chuyển khoản.\nMã đơn: ${code}\nThiệp: ${card.title}\nLink: ${link}`;

  return (
    <main className="lc-page" style={{ maxWidth: 880 }}>
      <div className="lc-page-head">
        <div>
          <h1>Thanh toán thiệp</h1>
          <p className="lc-muted">
            {card.title} · Mã đơn <strong>{code}</strong>
          </p>
        </div>
        <Link href={`/tai-khoan/thiep/${card.id}`} className="lc-btn lc-btn-sm">
          ← Sửa thiệp
        </Link>
      </div>

      {card.status === "active" ? (
        <div className="lc-card lc-empty">
          <p>Thiệp đã được kích hoạt, cảm ơn bạn!</p>
          <a href={link} target="_blank" rel="noopener" className="lc-btn lc-btn-primary">
            Xem thiệp ↗
          </a>
        </div>
      ) : (
        <div className="lc-stack" style={{ gap: 16 }}>
          <section className="lc-card lc-pay">
            {/* eslint-disable-next-line @next/next/no-img-element -- static QR image */}
            <img src={BANK_QR} alt={`QR chuyển khoản ${DEFAULT_BANK.name}`} className="lc-pay-qr" />
            <div className="lc-stack">
              <h2>1. Chuyển khoản</h2>
              <dl className="lc-kv">
                <dt>Số tiền</dt>
                <dd>{price || "Admin báo giá qua Zalo"}</dd>
                <span />
                <dt>Ngân hàng</dt>
                <dd>{DEFAULT_BANK.name}</dd>
                <span />
                <dt>Số tài khoản</dt>
                <dd>{DEFAULT_BANK.number}</dd>
                <CopyButton text={DEFAULT_BANK.number} />
                <dt>Chủ tài khoản</dt>
                <dd>{DEFAULT_BANK.owner}</dd>
                <span />
                <dt>Nội dung</dt>
                <dd>{code}</dd>
                <CopyButton text={code} />
              </dl>
              {card.paidAt ? (
                <p className="lc-badge">Đã báo chuyển khoản — admin đang kiểm tra</p>
              ) : (
                <form action={markPaidAction}>
                  <input type="hidden" name="id" value={card.id} />
                  <button className="lc-btn lc-btn-primary">Tôi đã chuyển khoản</button>
                </form>
              )}
            </div>
          </section>

          <section className="lc-card lc-stack" style={{ padding: 24 }}>
            <h2>2. Nhắn admin để duyệt thiệp</h2>
            <p className="lc-muted" style={{ margin: 0 }}>
              Gửi tin nhắn dưới đây (kèm ảnh chụp chuyển khoản) qua Zalo. Admin kiểm tra và kích hoạt thiệp, sau đó bạn gửi link cho khách mời.
            </p>
            <p className="lc-note" style={{ margin: 0 }}>{message}</p>
            <div className="lc-row">
              <CopyButton text={message} label="Sao chép tin nhắn" />
              {contacts.zalo && (
                <a href={zaloUrl(contacts.zalo)} target="_blank" rel="noopener" className="lc-btn lc-btn-primary lc-btn-sm">
                  Mở Zalo {contacts.zalo}
                </a>
              )}
              {contacts.facebook && (
                <a href={contacts.facebook} target="_blank" rel="noopener" className="lc-btn lc-btn-sm">
                  Facebook
                </a>
              )}
              {contacts.hotline && (
                <a href={`tel:${contacts.hotline}`} className="lc-btn lc-btn-sm">
                  Gọi {contacts.hotline}
                </a>
              )}
            </div>
          </section>

          {user.isGuest && (
            <p className="lc-hint" style={{ textAlign: "center" }}>
              Bạn đang dùng phiên khách trên trình duyệt này.{" "}
              <Link className="lc-link" href={`/dang-ky?tai-khoan=1&next=/tai-khoan/thiep/${card.id}/thanh-toan`}>
                Tạo tài khoản
              </Link>{" "}
              để sửa thiệp trên thiết bị khác.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
