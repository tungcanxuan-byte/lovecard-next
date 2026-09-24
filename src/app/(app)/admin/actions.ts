"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/server";
import { deleteCard, setCardStatus, setUserRole } from "@/lib/cards";
import { saveContacts } from "@/lib/settings";

export async function setCardStatusAction(formData: FormData) {
  await requireAdmin();
  const status = formData.get("status") === "active" ? "active" : "draft";
  await setCardStatus(String(formData.get("id") ?? ""), status);
  revalidatePath("/admin");
}

export async function adminDeleteCardAction(formData: FormData) {
  await requireAdmin();
  await deleteCard(String(formData.get("id") ?? ""));
  revalidatePath("/admin");
}

export async function setUserRoleAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (id === admin.id) return; // admins cannot demote themselves
  await setUserRole(id, formData.get("role") === "admin" ? "admin" : "user");
  revalidatePath("/admin");
}

export type SaveContactsState = { error?: string; saved?: boolean };

export async function saveContactsAction(_prev: SaveContactsState, formData: FormData): Promise<SaveContactsState> {
  await requireAdmin();
  const result = await saveContacts({
    hotline: formData.get("hotline") ?? "",
    zalo: formData.get("zalo") ?? "",
    facebook: formData.get("facebook") ?? "",
    tiktok: formData.get("tiktok") ?? "",
  });
  if (result.error) return { error: result.error, saved: false };
  revalidatePath("/", "layout"); // template demos and cards show the contacts
  return { saved: true };
}
