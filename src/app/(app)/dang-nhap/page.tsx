import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/app/auth-form";
import { getUser } from "@/lib/auth/server";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: `Đăng nhập · ${BRAND_NAME}` };

export default async function Page() {
  const user = await getUser();
  if (user && !user.isGuest) redirect("/tai-khoan"); // guests may sign in; their cards move to the account
  return (
    <Suspense>
      <AuthForm mode="sign-in" />
    </Suspense>
  );
}
