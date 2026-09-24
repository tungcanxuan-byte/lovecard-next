"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser, requireUser } from "@/lib/auth/server";
import { createCard, deleteCard, getEditableCard, parseContent, slugSchema, slugTaken, updateCard } from "@/lib/cards";

export async function createCardAction(formData: FormData) {
  const user = await requireUser("/tai-khoan/mau");
  const card = await createCard(user, String(formData.get("template") ?? ""));
  redirect(`/tai-khoan/thiep/${card.id}`);
}

export async function deleteCardAction(formData: FormData) {
  const user = await requireUser("/tai-khoan");
  const card = await getEditableCard(String(formData.get("id") ?? ""), user);
  if (card) await deleteCard(card.id);
  revalidatePath("/tai-khoan");
}

export type SaveResult = { ok: true } | { ok: false; error: string };

/** Editor autosave: title and content (validated and sanitized). */
export async function saveCardAction(id: string, input: { title: string; content: unknown }): Promise<SaveResult> {
  const user = await getUser();
  const card = user && (await getEditableCard(id, user));
  if (!card) return { ok: false, error: "Bạn không có quyền sửa thiệp này." };
  const title = String(input.title ?? "").trim().slice(0, 120);
  let content;
  try {
    content = parseContent(input.content);
  } catch {
    return { ok: false, error: "Nội dung không hợp lệ." };
  }
  await updateCard(card.id, { title: title || card.title, content });
  return { ok: true };
}

export async function changeSlugAction(id: string, slug: string): Promise<SaveResult> {
  const user = await getUser();
  const card = user && (await getEditableCard(id, user));
  if (!card) return { ok: false, error: "Bạn không có quyền sửa thiệp này." };
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Đường dẫn không hợp lệ" };
  if (await slugTaken(parsed.data, card.id)) return { ok: false, error: "Đường dẫn này đã có người dùng." };
  await updateCard(card.id, { slug: parsed.data });
  return { ok: true };
}
