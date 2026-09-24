import Link from "next/link";
import { SignOutButton } from "@/components/app/sign-out-button";
import { getUser } from "@/lib/auth/server";
import { BRAND_NAME } from "@/lib/brand";
import "./app.css";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getUser();
  return (
    <div className="lc-app">
      <header className="lc-header">
        <Link href="/" className="lc-logo">
          {BRAND_NAME}
        </Link>
        <nav className="lc-nav">
          <Link href="/dang-ky">Mẫu thiệp</Link>
          {user && <Link href="/tai-khoan">Thiệp của tôi</Link>}
          {user?.isAdmin && <Link href="/admin">Quản trị</Link>}
        </nav>
        <div className="lc-user">
          {user?.isGuest ? (
            <Link href="/dang-ky?tai-khoan=1&next=/tai-khoan" className="lc-link">
              Lưu vào tài khoản
            </Link>
          ) : user ? (
            <>
              <span className="lc-user-name">{user.name || user.email}</span>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/dang-nhap" className="lc-link">
                Đăng nhập
              </Link>
              <Link href="/dang-ky" className="lc-btn lc-btn-primary lc-btn-sm">
                Đặt thiệp
              </Link>
            </>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
