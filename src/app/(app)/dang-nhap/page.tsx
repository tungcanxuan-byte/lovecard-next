import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/app/auth-form";
import { getUser } from "@/lib/auth/server";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: `Đăng nhập · ${BRAND_NAME}` };

export default async function Page() {
  if (await getUser()) redirect("/tai-khoan");
  return (
    <Suspense>
      <AuthForm mode="sign-in" />
    </Suspense>
  );
}
