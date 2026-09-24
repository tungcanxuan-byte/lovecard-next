import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb, schema } from "@/lib/db";

/** Emails that are admins regardless of their stored role (comma-separated ADMIN_EMAILS). */
const adminEmails = () =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

async function createAuth() {
  const db = await getDb();
  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
    }),
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    user: { additionalFields: { role: { type: "string", defaultValue: "user", input: false } } },
    databaseHooks: {
      user: {
        create: {
          before: async (u) => ({ data: { ...u, role: adminEmails().includes(u.email.toLowerCase()) ? "admin" : "user" } }),
        },
      },
    },
    plugins: [nextCookies()],
  });
}

type Auth = Awaited<ReturnType<typeof createAuth>>;
const g = globalThis as unknown as { __lcAuth?: Promise<Auth> };

export function getAuth(): Promise<Auth> {
  g.__lcAuth ??= createAuth();
  return g.__lcAuth;
}

export type SessionUser = { id: string; name: string; email: string; isAdmin: boolean };

/** Signed-in user for this request, or null. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const requestHeaders = await headers(); // first, so pages using this render per request
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const u = session.user as typeof session.user & { role?: string };
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    isAdmin: u.role === "admin" || adminEmails().includes(u.email.toLowerCase()),
  };
});

/** Signed-in user, or a redirect to the sign-in page that returns to `next`. */
export async function requireUser(next: string): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect(`/dang-nhap?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser("/admin");
  if (!user.isAdmin) redirect("/tai-khoan");
  return user;
}
