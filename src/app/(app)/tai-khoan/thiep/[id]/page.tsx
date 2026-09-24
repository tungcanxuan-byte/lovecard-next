import { notFound } from "next/navigation";
import { CardEditor } from "@/components/editor/card-editor";
import { requireUser } from "@/lib/auth/server";
import { getDoc, getFieldBindings, listMusic } from "@/lib/card/docs";
import { popupOutline, sectionOutline } from "@/lib/card/outline";
import { defaultMusic, FIELD_LABELS, resolveElements } from "@/lib/card/resolve";
import { getEditableCard } from "@/lib/cards";

export const metadata = { title: "Sửa thiệp · LoveCard" };

export default async function EditCardPage({ params }: PageProps<"/tai-khoan/thiep/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/tai-khoan/thiep/${id}`);
  const card = await getEditableCard(id, user);
  if (!card) notFound();
  const [doc, bindings, music] = await Promise.all([getDoc(card.template), getFieldBindings(card.template), listMusic()]);
  if (!doc) notFound();

  const bound = new Set(bindings.map((b) => b.key));
  const fields = Object.keys(FIELD_LABELS).filter((k) => bound.has(k));
  const labelled = { ...doc, elements: resolveElements(doc, bindings, card.content) };
  const countdownEnd = Object.values(doc.elements).find((el) => el.countdown?.end)?.countdown?.end ?? null;

  return (
    <CardEditor
      card={{ id: card.id, slug: card.slug, title: card.title, status: card.status, content: card.content }}
      fields={fields}
      sections={sectionOutline(labelled)}
      popups={popupOutline(labelled)}
      hasCountdown={Object.values(doc.elements).some((el) => el.countdown)}
      countdownEnd={countdownEnd}
      hasMusic={!!doc.features.music}
      templateMusic={defaultMusic(doc)}
      music={music}
    />
  );
}
