import { notFound } from "next/navigation";
import { CardView, cardMetadata } from "@/components/card/card-view";
import { getDoc, HOME_SLUG } from "@/lib/card/docs";
import { applyContacts, orderedSections } from "@/lib/card/resolve";
import { getContacts } from "@/lib/settings";

export async function generateMetadata() {
  const doc = await getDoc(HOME_SLUG);
  return doc ? cardMetadata(doc) : {};
}

/** Template gallery page. */
export default async function HomePage() {
  const doc = await getDoc(HOME_SLUG);
  if (!doc) notFound();
  const elements = applyContacts(doc.elements, await getContacts());
  return <CardView doc={doc} elements={elements} sections={orderedSections(doc, {})} music={null} cardId={null} />;
}
