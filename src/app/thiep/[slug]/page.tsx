import { notFound } from "next/navigation";
import { cache } from "react";
import { CardView, cardMetadata } from "@/components/card/card-view";
import { getUser } from "@/lib/auth/server";
import { getDoc, getFieldBindings } from "@/lib/card/docs";
import { applyContacts, orderedSections, overrideCss, resolveElements } from "@/lib/card/resolve";
import { canEdit, getCardBySlug } from "@/lib/cards";
import { getContacts } from "@/lib/settings";

/** Active cards are public; drafts are only visible to their owner and admins. */
const loadCard = cache(async (slug: string) => {
  const card = await getCardBySlug(slug);
  if (!card) return null;
  if (card.status === "active") return { card, draft: false };
  return canEdit(card, await getUser()) ? { card, draft: true } : null;
});

export async function generateMetadata({ params }: PageProps<"/thiep/[slug]">) {
  const found = await loadCard((await params).slug);
  const doc = found && (await getDoc(found.card.template));
  if (!found || !doc) return {};
  const cover = Object.values(found.card.content.overrides ?? {}).find((o) => o.image)?.image;
  return { ...cardMetadata(doc, { title: found.card.title, image: cover }), robots: { index: false } };
}

export default async function CardPage({ params }: PageProps<"/thiep/[slug]">) {
  const found = await loadCard((await params).slug);
  if (!found) notFound();
  const { card, draft } = found;
  const [doc, bindings, contacts] = await Promise.all([getDoc(card.template), getFieldBindings(card.template), getContacts()]);
  if (!doc) notFound();
  return (
    <>
      <CardView
        doc={doc}
        elements={resolveElements({ elements: applyContacts(doc.elements, contacts) }, bindings, card.content)}
        sections={orderedSections(doc, card.content)}
        music={card.content.music ?? null}
        cardId={card.id}
        extraCss={overrideCss(card.content)}
      />
      {draft && (
        <a href={`/tai-khoan/thiep/${card.id}`} style={DRAFT_BANNER}>
          Bản nháp — thiệp chưa được kích hoạt, chỉ bạn xem được. Sửa thiệp
        </a>
      )}
    </>
  );
}

const DRAFT_BANNER: React.CSSProperties = {
  position: "fixed",
  left: 8,
  right: 8,
  top: 8,
  zIndex: 2147483000,
  padding: "10px 14px",
  borderRadius: 10,
  background: "rgba(24, 24, 27, 0.88)",
  color: "#fff",
  font: "500 13px/1.4 system-ui, sans-serif",
  textAlign: "center",
  textDecoration: "none",
};
