import { getUser } from "@/lib/auth/server";
import { addWish, canEdit, getCard, listWishes, wishSchema } from "@/lib/cards";

/** Wishes are public on active cards; on drafts only the owner (or an admin) can read and test them. */
async function allowedCard(id: string) {
  const card = await getCard(id);
  if (!card) return null;
  if (card.status === "active") return card;
  return canEdit(card, await getUser()) ? card : null;
}

export async function GET(_req: Request, ctx: RouteContext<"/api/cards/[id]/wishes">) {
  const { id } = await ctx.params;
  const card = await allowedCard(id);
  if (!card) return Response.json({ error: "Không tìm thấy thiệp." }, { status: 404 });
  const rows = await listWishes(card.id);
  return Response.json({
    wishes: rows.map(({ id, name, message, attendance, createdAt }) => ({
      id,
      name,
      message,
      attendance,
      createdAt,
    })),
  });
}

export async function POST(req: Request, ctx: RouteContext<"/api/cards/[id]/wishes">) {
  const { id } = await ctx.params;
  const card = await allowedCard(id);
  if (!card) return Response.json({ error: "Không tìm thấy thiệp." }, { status: 404 });
  const parsed = wishSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Lời chúc không hợp lệ." }, { status: 400 });
  await addWish(card.id, parsed.data);
  return Response.json({ ok: true }, { status: 201 });
}
