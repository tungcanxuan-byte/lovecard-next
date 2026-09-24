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
          <Link href="/tai-khoan/mau">Mẫu thiệp</Link>
          {user && <Link href="/tai-khoan">Thiệp của tôi</Link>}
          {user?.isAdmin && <Link href="/admin">Quản trị</Link>}
        </nav>
        <div className="lc-user">
          {user ? (
            <>
              <span>{user.name || user.email}</span>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/dang-nhap" className="lc-link">
                Đăng nhập
              </Link>
              <Link href="/dang-ky" className="lc-btn lc-btn-primary lc-btn-sm">
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
