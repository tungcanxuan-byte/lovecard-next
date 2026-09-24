import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/app/auth-form";
import { TemplateGrid } from "@/components/app/template-grid";
import { getUser } from "@/lib/auth/server";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: `Đặt thiệp · ${BRAND_NAME}` };

const STEPS = [
  ["Chọn mẫu", "Bấm “Dùng mẫu này” ở mẫu bạn thích."],
  ["Chỉnh sửa", "Đổi tên, ảnh, ngày cưới, lời mời… ngay trên thiệp."],
  ["Thanh toán", "Chuyển khoản theo mã QR, rồi nhắn Zalo cho admin."],
  ["Nhận thiệp", "Admin kiểm tra và kích hoạt, bạn gửi link cho khách mời."],
];

/** Order page ("Đặt ngay"): no account needed. `?tai-khoan=1` shows the optional sign-up form. */
export default async function OrderPage({ searchParams }: PageProps<"/dang-ky">) {
  const [user, { "tai-khoan": account }] = await Promise.all([getUser(), searchParams]);
  if (account) {
    if (user && !user.isGuest) redirect("/tai-khoan");
    return (
      <Suspense>
        <AuthForm mode="sign-up" />
      </Suspense>
    );
  }
  return (
    <main className="lc-page">
      <div className="lc-page-head">
        <div>
          <h1>Đặt thiệp cưới online</h1>
          <p className="lc-muted">Không cần tạo tài khoản — chọn mẫu, chỉnh sửa và thanh toán ngay.</p>
        </div>
      </div>
      <ol className="lc-steps">
        {STEPS.map(([title, text]) => (
          <li key={title} className="lc-card">
            <strong>{title}</strong>
            <span className="lc-hint">{text}</span>
          </li>
        ))}
      </ol>
      <TemplateGrid />
      {!user && (
        <p className="lc-muted" style={{ textAlign: "center", marginTop: 28 }}>
          Đã có tài khoản?{" "}
          <Link className="lc-link" href="/dang-nhap">
            Đăng nhập
          </Link>
        </p>
      )}
    </main>
  );
}
