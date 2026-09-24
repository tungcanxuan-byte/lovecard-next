"use client";

import { useEffect, useMemo, useState } from "react";
import { CardRenderer } from "@/components/card/card-renderer";
import type { EditHandlers } from "@/components/card/card-context";
import { orderedSections, overrideCss, resolveElements } from "@/lib/card/resolve";
import type { AstNode, CardContent, CardDoc, DocFeatures, FieldBinding } from "@/lib/card/types";
import { fromSameOrigin, type FromCanvas, type ToCanvas } from "./protocol";

type Props = {
  tree: AstNode[];
  elements: CardDoc["elements"];
  sections: string[];
  features: DocFeatures;
  bodyClass: string;
  bindings: FieldBinding[];
  initialContent: CardContent;
};

const post = (msg: FromCanvas) => window.parent.postMessage(msg, window.location.origin);

/** The card inside the editor's phone frame: renders edits live and reports clicks to the editor. */
export function EditorCanvas({ tree, elements, sections, features, bodyClass, bindings, initialContent }: Props) {
  const [content, setContent] = useState(initialContent);
  const [selected, setSelected] = useState<string | null>(null);
  const [popup, setPopup] = useState<string | null>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent<ToCanvas>) => {
      if (!fromSameOrigin(e) || e.source !== window.parent) return;
      const msg = e.data;
      if (msg.type === "state") {
        setContent(msg.content);
        setSelected(msg.selected);
        setPopup(msg.popup);
      } else if (msg.type === "scroll") {
        document.getElementById(msg.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    window.addEventListener("message", onMessage);
    post({ type: "ready" });
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const resolved = useMemo(() => resolveElements({ elements }, bindings, content), [elements, bindings, content]);
  const order = useMemo(() => orderedSections({ sections }, content), [sections, content]);

  // Keep the editor's inspector in sync with what the selected element currently looks like.
  const selectedEl = selected ? (resolved[selected] ?? null) : null;
  useEffect(() => {
    if (selected) post({ type: "selected", id: selected, el: selectedEl });
  }, [selected, selectedEl]);

  const edit = useMemo<EditHandlers>(
    () => ({
      selected,
      onSelect: (id) => post({ type: "select", id }),
      onText: (id, html) => post({ type: "text", id, html }),
      onImage: (id) => post({ type: "pick-image", id }),
      onGalleryImage: (id, index) => post({ type: "pick-gallery", id, index, gallery: resolved[id]?.gallery ?? [] }),
      onClosePopup: () => post({ type: "close-popup" }),
    }),
    [selected, resolved],
  );

  return (
    <CardRenderer
      tree={tree}
      elements={resolved}
      features={features}
      bodyClass={bodyClass}
      sections={order}
      music={null}
      cardId={null}
      edit={edit}
      openPopup={popup}
      extraCss={overrideCss(content)}
    />
  );
}
