import { notFound } from "next/navigation";
import { CardView, cardMetadata } from "@/components/card/card-view";
import { getDoc, HOME_SLUG } from "@/lib/card/docs";
import { orderedSections } from "@/lib/card/resolve";

export async function generateMetadata() {
  const doc = await getDoc(HOME_SLUG);
  return doc ? cardMetadata(doc) : {};
}

/** LoveCard's template gallery page. */
export default async function HomePage() {
  const doc = await getDoc(HOME_SLUG);
  if (!doc) notFound();
  return <CardView doc={doc} elements={doc.elements} sections={orderedSections(doc, {})} music={null} cardId={null} />;
}
