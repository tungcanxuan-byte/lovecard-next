import type { Metadata } from "next";
import type { CardDoc, ResolvedElements } from "@/lib/card/types";
import { CardRenderer } from "./card-renderer";
import "./card-animations.css";

/**
 * LoveCard templates are 420px wide; scale the viewport so that width fills the phone, exactly like
 * LadiPage's own bootstrap. Runs during HTML parse, before first paint.
 */
const VIEWPORT_SCRIPT = `(function(){var w=420,h=window.innerWidth/w,m=document.querySelector('meta[name="viewport"]');if(!m){m=document.createElement("meta");m.name="viewport";document.head.appendChild(m);}m.setAttribute("content","width="+w+",user-scalable=no,initial-scale="+h+",minimum-scale="+h+",maximum-scale="+h);})();`;

type CardViewProps = {
  doc: CardDoc;
  elements: ResolvedElements;
  sections: string[];
  music: string | null;
  cardId: string | null;
  extraCss?: string;
};

/** Viewport scaling, fonts and the template's own CSS. */
export function CardHead({ doc }: { doc: CardDoc }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: VIEWPORT_SCRIPT }} />
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
