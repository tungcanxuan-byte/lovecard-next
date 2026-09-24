import type { Metadata, Viewport } from "next";
import type { CardDoc, ResolvedElements } from "@/lib/card/types";
import { CardRenderer } from "./card-renderer";
import "./card-animations.css";

/**
 * Page `viewport` for template pages: LoveCard templates are 420px wide, and a fixed layout width
 * makes phones scale that width to fit the screen (desktop browsers ignore it and get the desktop
 * layout). No initial-scale, or phones narrower than 420px would open zoomed in.
 */
export const CARD_VIEWPORT: Viewport = { width: 420, initialScale: undefined, userScalable: false };

type CardViewProps = {
  doc: CardDoc;
  elements: ResolvedElements;
  sections: string[];
  music: string | null;
  cardId: string | null;
  extraCss?: string;
};

/** Fonts and the template's own CSS. */
export function CardHead({ doc }: { doc: CardDoc }) {
  return (
    <>
      {doc.fonts.map((href) => (
        <link key={href} rel="stylesheet" href={href} precedence="default" />
      ))}
      <style dangerouslySetInnerHTML={{ __html: doc.css }} />
    </>
  );
}

/** Server wrapper: template styles and fonts, then the interactive client renderer. */
export function CardView({ doc, elements, sections, music, cardId, extraCss }: CardViewProps) {
  return (
    <>
      <CardHead doc={doc} />
      <CardRenderer
        tree={doc.tree}
        elements={elements}
        features={doc.features}
        bodyClass={doc.bodyClass}
        sections={sections}
        music={music}
        cardId={cardId}
        extraCss={extraCss}
      />
    </>
  );
}

/** Maps the template's original <head> tags onto Next metadata; `title` overrides for real cards. */
export function cardMetadata(doc: CardDoc, override?: { title?: string; image?: string | null }): Metadata {
  const pick = (key: string) => doc.meta.find((m) => m.name === key || m.property === key)?.content;
  const title = override?.title ?? doc.title;
  const image = override?.image ?? pick("og:image");
  return {
    title,
    description: pick("description") ?? pick("og:description"),
    icons: doc.icon ? { icon: doc.icon, apple: doc.icon } : undefined,
    openGraph: {
      title: override?.title ?? pick("og:title") ?? doc.title,
      description: pick("og:description"),
      images: image ? [image] : undefined,
      type: "website",
    },
  };
}
