"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth/client";
import { BRAND_NAME } from "@/lib/brand";

/** Only same-site paths are followed after sign-in. */
const safeNext = (next: string | null) => (next && next.startsWith("/") && !next.startsWith("//") ? next : "/tai-khoan");

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email")).trim();
    const password = String(data.get("password"));
    setPending(true);
    setError(null);
    const { error } =
      mode === "sign-up"
        ? await authClient.signUp.email({ email, password, name: String(data.get("name")).trim() })
        : await authClient.signIn.email({ email, password });
    setPending(false);
    if (error) {
      setError(
        error.status === 401 || error.code === "INVALID_EMAIL_OR_PASSWORD"
          ? "Email hoặc mật khẩu không đúng."
          : error.code === "USER_ALREADY_EXISTS" || error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
            ? "Email này đã được đăng ký."
            : (error.message ?? "Có lỗi xảy ra, vui lòng thử lại."),
      );
      return;
    }
    router.push(next);
    router.refresh();
  };

  const query = next !== "/tai-khoan" ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <div className="lc-card lc-auth">
      <h1>{mode === "sign-up" ? "Tạo tài khoản" : "Đăng nhập"}</h1>
      <p className="lc-muted">{mode === "sign-up" ? "Tự thiết kế thiệp cưới online của bạn." : `Chào mừng bạn quay lại ${BRAND_NAME}.`}</p>
      <form className="lc-stack" onSubmit={onSubmit}>
        {mode === "sign-up" && (
          <label className="lc-field">
            <span>Họ tên</span>
            <input className="lc-input" name="name" required maxLength={80} autoComplete="name" />
          </label>
        )}
        <label className="lc-field">
          <span>Email</span>
          <input className="lc-input" name="email" type="email" required autoComplete="email" />
        </label>
        <label className="lc-field">
          <span>Mật khẩu</span>
          <input
            className="lc-input"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          />
          {mode === "sign-up" && <small className="lc-hint">Ít nhất 8 ký tự.</small>}
        </label>
        {error && <p className="lc-error">{error}</p>}
        <button className="lc-btn lc-btn-primary lc-btn-block" disabled={pending}>
          {pending ? "Đang xử lý..." : mode === "sign-up" ? "Đăng ký" : "Đăng nhập"}
        </button>
        <p className="lc-muted" style={{ textAlign: "center", margin: 0 }}>
          {mode === "sign-up" ? (
            <>
              Đã có tài khoản? <Link className="lc-link" href={`/dang-nhap${query}`}>Đăng nhập</Link>
            </>
          ) : (
            <>
              Chưa có tài khoản? <Link className="lc-link" href={`/dang-ky${query}`}>Đăng ký</Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
