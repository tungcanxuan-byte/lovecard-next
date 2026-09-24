"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="lc-btn lc-btn-sm"
      onClick={async () => {
        await authClient.signOut();
        router.push("/dang-nhap");
        router.refresh();
      }}
    >
      Đăng xuất
    </button>
  );
}
