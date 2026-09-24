import { notFound } from "next/navigation";
import { CardView, cardMetadata } from "@/components/card/card-view";
import { getDoc, getFieldBindings, listTemplateSlugs } from "@/lib/card/docs";
import { defaultContent, orderedSections, resolveElements } from "@/lib/card/resolve";

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await listTemplateSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/[slug]">) {
  const doc = await getDoc((await params).slug);
  return doc ? cardMetadata(doc) : {};
}

/** Template demo, filled with the default couple and photos. */
export default async function TemplatePage({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const [doc, bindings] = await Promise.all([getDoc(slug), getFieldBindings(slug)]);
  if (!doc) notFound();
  const content = defaultContent(doc);
  return (
    <CardView
      doc={doc}
      elements={resolveElements(doc, bindings, content)}
      sections={orderedSections(doc, content)}
      music={null}
      cardId={null}
    />
  );
}
