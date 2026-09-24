import { notFound } from "next/navigation";
import { CardHead } from "@/components/card/card-view";
import { EditorCanvas } from "@/components/editor/editor-canvas";
import { requireUser } from "@/lib/auth/server";
import { getDoc, getFieldBindings } from "@/lib/card/docs";
import { applyContacts } from "@/lib/card/resolve";
import { getEditableCard } from "@/lib/cards";
import { getContacts } from "@/lib/settings";

export const metadata = { title: "Khung sửa thiệp", robots: { index: false } };

/** Editable card, embedded in the editor's phone frame. */
export default async function CanvasPage({ params }: PageProps<"/khung/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/tai-khoan/thiep/${id}`);
  const card = await getEditableCard(id, user);
  if (!card) notFound();
  const [doc, bindings, contacts] = await Promise.all([getDoc(card.template), getFieldBindings(card.template), getContacts()]);
  if (!doc) notFound();
  return (
    <>
      <CardHead doc={doc} />
      <EditorCanvas
        tree={doc.tree}
        elements={applyContacts(doc.elements, contacts)}
        sections={doc.sections}
        features={doc.features}
        bodyClass={doc.bodyClass}
        bindings={bindings}
        initialContent={card.content}
      />
    </>
  );
}
