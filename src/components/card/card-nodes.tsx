"use client";

import {
  createElement,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { AstNode, AstProps } from "@/lib/card/types";
import { SlideContext, useCard, type SlideScope } from "./card-context";

const VOID_TAGS = new Set(["area", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

/** Renders one converted node. `$`-props become behaviour components; everything else is plain DOM. */
export function renderNode(node: AstNode, key: number | string): ReactNode {
  if (typeof node === "string") return node;
  const [tag, rawProps, ...children] = node;
  const props = rawProps ?? {};
  const { $e, $t, $h, $i, $cd, $f, $gv, $gc, $ga, $cc, $v, $tab, $p, $b, ...dom } = props;
  void $tab;
  void $p;

  if ($e) return <LadiElement key={key} id={$e} tag={tag} props={props} nodes={children} />;
  if ($t) return <RichText key={key} id={$t} tag={tag} dom={dom} />;
  if ($h) return createElement(tag, { key, ...dom, dangerouslySetInnerHTML: { __html: $h } });
  if ($i) return <ImageBackground key={key} id={$i} tag={tag} dom={dom} />;
  if ($cd) return <CountdownValue key={key} item={$cd[0]} countdown={$cd[1]} dom={dom} />;
  if ($f) return <LadiForm key={key} dom={dom} nodes={children} />;
  if ($gv) return <GalleryView key={key} id={$gv} dom={dom} nodes={children} />;
  if ($gc) return <GalleryControl key={key} id={$gc} dom={dom} />;
  if ($ga) return <SlideArrow key={key} delta={$ga} dom={dom} />;
  if ($cc) return <CarouselContent key={key} dom={dom} nodes={children} />;
  if ($v) return <VideoBox key={key} id={$v} dom={dom} nodes={children} />;
  if ($b) return <Behaviour key={key} kind={$b} tag={tag} dom={dom} nodes={children} />;
  return plain(tag, dom, children, key);
}

export function renderChildren(nodes: AstNode[]): ReactNode[] {
  return nodes.map((n, i) => renderNode(n, i));
}

function plain(tag: string, dom: AstProps, nodes: AstNode[], key?: number | string) {
  const props = fixFormProps(tag, dom);
  if (VOID_TAGS.has(tag) || !nodes.length) return createElement(tag, { key, ...props });
  return createElement(tag, { key, ...props }, ...renderChildren(nodes));
}

/** Radio/checkbox values must be real `value` attributes; React treats defaultValue as text. */
function fixFormProps(tag: string, dom: AstProps): AstProps {
  if (tag !== "input" || (dom.type !== "radio" && dom.type !== "checkbox") || dom.defaultValue === undefined) return dom;
  const { defaultValue, ...rest } = dom;
  return { ...rest, value: defaultValue };
}

const withClass = (className: string | undefined, add: string[], remove: string[] = []) =>
  [...(className ?? "").split(/\s+/).filter((c) => c && !remove.includes(c)), ...add].join(" ");

// ---------------------------------------------------------------------------------------------
// Elements

function LadiElement({ id, tag, props, nodes }: { id: string; tag: string; props: AstProps; nodes: AstNode[] }) {
  const card = useCard();
  const el = card.elements[id];
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const { $e, $tab, $p, ...dom } = props;
  void $e;

  const anim = el?.anim && !card.edit;
  useEffect(() => {
    if (!anim || !ref.current) return;
    const node = ref.current;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [anim]);

  if (el?.hidden && !card.edit) return null;

  const add: string[] = [];
  const remove: string[] = [];
  if (card.edit) remove.push("ladi-animation-hidden");
  else if (inView) {
    remove.push("ladi-animation-hidden");
    add.push("ladi-animation");
  }
  if ($tab) {
    const [tabsId, index] = $tab;
    const current = card.tabs[tabsId] ?? card.elements[tabsId]?.tab ?? 1;
    if (current === index) add.push("selected");
  }
  if (card.edit) {
    if (el?.hidden) add.push("lc-hidden");
    if (card.edit.selected === id) add.push("lc-selected");
  }

  const style: CSSProperties = { ...(dom.style as CSSProperties) };
  if ($p) style.display = card.popup === id ? "block" : undefined;
  if (card.display[id]) style.display = card.display[id];

  const actions = el?.actions ?? [];
  const onClick = (e: MouseEvent<HTMLElement>) => {
    if (card.edit) {
      e.stopPropagation();
      card.edit.onSelect(id);
      const tabActions = actions.filter((a) => a.type === "tab");
      if (tabActions.length) card.runActions(tabActions);
      return;
    }
    if (actions.length) {
      e.stopPropagation();
      e.preventDefault(); // anchors: runActions navigates, honouring overridden links
      card.runActions(actions);
      return;
    }
    if (el?.t === "button") {
      const form = e.currentTarget.closest("form");
      if (form) {
        e.stopPropagation();
        card.submitForm(form);
      }
    }
  };
  const clickable = actions.length > 0 || el?.t === "button" || !!card.edit;

  let children: ReactNode[] = renderChildren(nodes);
  if ($p) {
    children = [
      ...children,
      <div key="close" className="popup-close" onClick={(e) => (e.stopPropagation(), card.closePopup())} />,
    ];
  }
  // Anchors show the current link (overrides, site contacts) rather than the template's.
  const link = actions.find((a) => a.type === "link" || a.type === "phone");
  const href = !link ? dom.href : link.type === "link" ? link.href || undefined : `tel:${link.phone}`;
  const Tag = tag as ElementType;
  const element = (
    <Tag
      {...dom}
      href={tag === "a" ? href : dom.href}
      ref={ref}
      className={withClass(dom.className, add, remove)}
      style={style}
      onClick={clickable ? onClick : undefined}
      data-lc-id={card.edit ? id : undefined}
    >
      {children}
    </Tag>
  );

  if (el?.t === "gallery" || el?.t === "carousel") {
    const autoplay = el.t === "gallery" ? el.autoplay : el.carousel?.autoplay ? el.carousel.interval : undefined;
    return (
      <SlideProvider id={id} autoplay={card.edit ? undefined : autoplay} initialCount={el.gallery?.length ?? 0}>
        {element}
      </SlideProvider>
    );
  }
  return element;
}

function RichText({ id, tag, dom }: { id: string; tag: string; dom: AstProps }) {
  const card = useCard();
  const el = card.elements[id];
  const guest = card.features.guestName;
  const html = guest?.id === id && card.guestName != null ? escapeHtml(card.guestName) : (el?.text ?? "");
  if (card.edit) {
    const edit = card.edit;
    return createElement(tag, {
      ...dom,
      contentEditable: true,
      suppressContentEditableWarning: true,
      spellCheck: false,
      "data-lc-text": id,
      onBlur: (e: React.FocusEvent<HTMLElement>) => {
        if (e.currentTarget.innerHTML !== html) edit.onText(id, e.currentTarget.innerHTML);
      },
      dangerouslySetInnerHTML: { __html: html },
    });
  }
  return createElement(tag, { ...dom, dangerouslySetInnerHTML: { __html: html } });
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function ImageBackground({ id, tag, dom }: { id: string; tag: string; dom: AstProps }) {
  const card = useCard();
  const image = card.elements[id]?.image;
  const style: CSSProperties = { ...(dom.style as CSSProperties) };
  if (image) style.backgroundImage = `url("${image}")`;
  if (!card.edit) return createElement(tag, { ...dom, style });
  const edit = card.edit;
  return createElement(tag, {
    ...dom,
    style,
    "data-lc-image": id,
    onDoubleClick: (e: MouseEvent) => {
      e.stopPropagation();
      edit.onImage(id);
    },
  });
}

function CountdownValue({ item, countdown, dom }: { item: string; countdown: string | null; dom: AstProps }) {
  const card = useCard();
  const unit = card.elements[item]?.unit;
  const cd = countdown ? card.elements[countdown]?.countdown : undefined;
  let text = "00";
  if (card.now != null && cd && unit) {
    const end = cd.end ?? card.mountedAt + (cd.minutes ?? 0) * 60_000;
    const s = Math.max(0, Math.floor((end - card.now) / 1000));
    const value =
      unit === "day" ? Math.floor(s / 86400) : unit === "hour" ? Math.floor(s / 3600) % 24 : unit === "minute" ? Math.floor(s / 60) % 60 : s % 60;
    text = String(value).padStart(2, "0");
  }
  return <span {...(dom as object)}>{text}</span>;
}

function LadiForm({ dom, nodes }: { dom: AstProps; nodes: AstNode[] }) {
  const card = useCard();
  return createElement(
    "form",
    {
      ...dom,
      onSubmit: (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!card.edit) card.submitForm(e.currentTarget);
      },
      onChange: (e: React.ChangeEvent<HTMLFormElement>) => syncFormState(e.currentTarget),
    },
    ...renderChildren(nodes),
  );
}

/** LadiPage styles checked radios and the chosen select option through data attributes. */
export function syncFormState(form: HTMLFormElement) {
  form.querySelectorAll<HTMLInputElement>("input[type=radio], input[type=checkbox]").forEach((input) => {
    input.nextElementSibling?.setAttribute("data-checked", String(input.checked));
  });
  form.querySelectorAll<HTMLSelectElement>("select").forEach((s) => s.setAttribute("data-selected", s.value));
}

// ---------------------------------------------------------------------------------------------
// Gallery and carousel

function SlideProvider({
  id,
  autoplay,
  initialCount,
  children,
}: {
  id: string;
  autoplay?: number;
  initialCount: number;
  children: ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(initialCount);
  const [paused, setPaused] = useState(0);

  useEffect(() => {
    if (!autoplay || count < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), autoplay * 1000);
    return () => clearInterval(t);
  }, [autoplay, count, paused]);

  const scope: SlideScope = {
    id,
    index: count ? Math.min(index, count - 1) : 0,
    count,
    step: (delta) => {
      setPaused((p) => p + 1); // restarts the autoplay timer after manual navigation
      setIndex((i) => (count ? (i + delta + count) % count : 0));
    },
    go: (i) => {
      setPaused((p) => p + 1);
      setIndex(i);
    },
    setCount,
  };
  return <SlideContext.Provider value={scope}>{children}</SlideContext.Provider>;
}

function GalleryView({ id, dom, nodes }: { id: string; dom: AstProps; nodes: AstNode[] }) {
  const card = useCard();
  const slide = useContext(SlideContext);
  const items = card.elements[id]?.gallery ?? [];
  const current = slide?.index ?? 0;
  return createElement(
    "div",
    dom,
    ...renderChildren(nodes),
    ...items.map((g, i) => (
      <div
        key={`v${i}`}
        className={i === current ? "ladi-gallery-view-item selected" : "ladi-gallery-view-item"}
        data-index={i}
        style={{ backgroundImage: `url("${g.src}")` }}
        data-lc-image={card.edit ? `${id}#${i}` : undefined}
        onDoubleClick={card.edit ? () => card.edit!.onGalleryImage(id, i) : undefined}
      />
    )),
  );
}

function GalleryControl({ id, dom }: { id: string; dom: AstProps }) {
  const card = useCard();
  const slide = useContext(SlideContext);
  const ref = useRef<HTMLDivElement>(null);
  const items = card.elements[id]?.gallery ?? [];
  const current = slide?.index ?? 0;

  // Keep the selected thumbnail in view, like LadiPage's control strip.
  useLayoutEffect(() => {
    const box = ref.current;
    const frame = box?.parentElement;
    const item = box?.children[current] as HTMLElement | undefined;
    if (!box || !frame || !item) return;
    const max = Math.max(0, box.scrollWidth - frame.clientWidth);
    const left = Math.min(max, Math.max(0, item.offsetLeft - (frame.clientWidth - item.offsetWidth) / 2));
    box.style.left = `${-left}px`;
  }, [current]);

  return (
    <div {...(dom as object)} ref={ref}>
      {items.map((g, i) => (
        <div
          key={i}
          className={i === current ? "ladi-gallery-control-item selected" : "ladi-gallery-control-item"}
          data-index={i}
          style={{ backgroundImage: `url("${g.thumb}")` }}
          onClick={() => slide?.go(i)}
        />
      ))}
    </div>
  );
}

function SlideArrow({ delta, dom }: { delta: -1 | 1; dom: AstProps }) {
  const slide = useContext(SlideContext);
  return (
    <div
      {...(dom as object)}
      onClick={(e) => {
        e.stopPropagation();
        slide?.step(delta);
      }}
    />
  );
}

function CarouselContent({ dom, nodes }: { dom: AstProps; nodes: AstNode[] }) {
  const slide = useContext(SlideContext);
  const ref = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<{ step: number; max: number } | null>(null);
  const setCount = slide?.setCount;

  useLayoutEffect(() => {
    const content = ref.current;
    const frame = content?.parentElement;
    if (!content || !frame) return;
    const measure = () => {
      const lefts = [...content.children].map((c) => (c as HTMLElement).offsetLeft).sort((a, b) => a - b);
      const diffs = lefts.slice(1).map((l, i) => l - lefts[i]).filter((d) => d > 0);
      const step = diffs.length ? Math.min(...diffs) : frame.clientWidth;
      const max = Math.max(0, content.offsetWidth - frame.clientWidth);
      setGeometry({ step, max });
      setCount?.(max > 0 ? Math.ceil(max / step) + 1 : 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(content);
    return () => ro.disconnect();
  }, [setCount]);

  const style: CSSProperties = { ...(dom.style as CSSProperties) };
  if (geometry && slide) style.left = `${-Math.min(slide.index * geometry.step, geometry.max)}px`;
  return (
    <div {...(dom as object)} ref={ref} style={style}>
      {renderChildren(nodes)}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Video

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function VideoBox({ id, dom, nodes }: { id: string; dom: AstProps; nodes: AstNode[] }) {
  const card = useCard();
  const [playing, setPlaying] = useState(false);
  const video = card.elements[id]?.video;
  const yt = video ? youtubeId(video.url) : null;
  if (playing && video) {
    return (
      <div {...(dom as object)}>
        {yt ? (
          <iframe
            src={`https://www.youtube.com/embed/${yt}?autoplay=1&rel=0`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
          />
        ) : (
          <video src={video.url} autoPlay controls playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
        )}
      </div>
    );
  }
  return createElement(
    "div",
    {
      ...dom,
      style: { ...(dom.style as CSSProperties), cursor: video ? "pointer" : undefined },
      onClick: video && !card.edit ? () => setPlaying(true) : undefined,
    },
    ...renderChildren(nodes),
  );
}

// ---------------------------------------------------------------------------------------------
// Template add-ons (music button, falling snow/hearts, wishes widget, popup backdrop)

function Behaviour({ kind, tag, dom, nodes }: { kind: string; tag: string; dom: AstProps; nodes: AstNode[] }) {
  const card = useCard();
  const music = card.features.music;
  switch (kind) {
    case "music-audio":
      // Children carry the template's own <source>; a custom song replaces them.
      return card.music.src ? <audio {...(dom as object)} key={card.music.src} src={card.music.src} /> : plain(tag, dom, nodes);
    case "music-toggle": {
      const add = [card.music.playing && music ? music.buttonPlaying : "", card.music.pressed && music ? music.press : ""].filter(Boolean);
      return createElement(
        tag,
        {
          ...dom,
          className: withClass(dom.className, add),
          onClick: (e: MouseEvent) => {
            e.stopPropagation();
            card.music.toggle();
          },
        },
        ...renderChildren(nodes),
      );
    }
    case "music-icon":
      return createElement(tag, {
        ...dom,
        src: card.music.playing
          ? "/assets/img.icons8.com/ios-filled/50/ffffff/musical-notes.png"
          : "/assets/img.icons8.com/ios-filled/50/ffffff/mute--v1.png",
        className: withClass(dom.className, card.music.playing && music ? [music.iconPlaying] : []),
      });
    case "snow":
    case "hearts":
      return <Falling kind={kind} dom={dom} />;
    case "backdrop": {
      const popup = card.popup ? card.elements[card.popup] : null;
      const style: CSSProperties = { ...(dom.style as CSSProperties), ...parseCss(popup?.backdrop ?? "") };
      if (popup) style.display = "block";
      return <div {...(dom as object)} style={style} onClick={card.closePopup} />;
    }
    case "wsc-list":
      return <WishList dom={dom} />;
    case "wsc-sendBtn":
      return (
        <button {...(dom as object)} disabled={card.wishes.sending} onClick={card.edit ? undefined : card.wishes.send}>
          {card.wishes.sending ? "Đang gửi..." : (card.features.wishes?.sendLabel ?? renderChildren(nodes))}
        </button>
      );
    case "wsc-success-msg":
      return createElement(
        tag,
        { ...dom, style: { ...(dom.style as CSSProperties), display: card.wishes.success ? "flex" : undefined } },
        ...renderChildren(nodes),
      );
    case "wsc-ok-btn":
      return <button {...(dom as object)} onClick={card.wishes.dismiss}>{renderChildren(nodes)}</button>;
    case "wsc-fireworks":
      return <FireworksCanvas dom={dom} />;
    default:
      return plain(tag, dom, nodes);
  }
}

/** Separate component so the callback ref stays out of Behaviour's render analysis. */
function FireworksCanvas({ dom }: { dom: AstProps }) {
  const { attachCanvas } = useCard().wishes;
  return <canvas {...(dom as object)} ref={attachCanvas} />;
}

function parseCss(css: string): CSSProperties {
  const out: Record<string, string> = {};
  for (const decl of css.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    if (prop) out[prop] = decl.slice(i + 1).trim();
  }
  return out as CSSProperties;
}

type Flake = { id: number; char: string; left: number; size: number; duration: number; randX: number };

function Falling({ kind, dom }: { kind: "snow" | "hearts"; dom: AstProps }) {
  const card = useCard();
  const [flakes, setFlakes] = useState<Flake[]>([]);
  const enabled = !card.edit && (kind === "snow" ? card.features.falling?.snow : card.features.falling?.hearts);

  useEffect(() => {
    if (!enabled) return;
    let seq = 0;
    const spawn = () => {
      const flake: Flake =
        kind === "snow"
          ? { id: seq++, char: Math.random() > 0.5 ? "❅" : "❆", left: Math.random() * 100, size: 0.8 + Math.random() * 0.6, duration: 14 + Math.random() * 6, randX: Math.random() }
          : { id: seq++, char: "❤", left: Math.random() * 100, size: 1.2 + Math.random(), duration: 10 + Math.random() * 5, randX: Math.random() };
      setFlakes((f) => [...f, flake]);
      setTimeout(() => setFlakes((f) => f.filter((x) => x.id !== flake.id)), kind === "snow" ? 20_000 : 18_000);
    };
    const t = setInterval(spawn, kind === "snow" ? 2500 : 4000);
    return () => clearInterval(t);
  }, [enabled, kind]);

  return (
    <div {...(dom as object)}>
      {flakes.map((f) => (
        <div
          key={f.id}
          className={kind === "snow" ? "snowflake" : "heart"}
          style={{ left: `${f.left}%`, fontSize: `${f.size}em`, animationDuration: `${f.duration}s`, ["--randX" as string]: f.randX }}
        >
          {f.char}
        </div>
      ))}
    </div>
  );
}

function WishList({ dom }: { dom: AstProps }) {
  const { wishes } = useCard();
  const ref = useRef<HTMLDivElement>(null);
  const count = wishes.items.length;

  // Slow auto-scroll once the list is in view; any manual scroll pauses it for 6s.
  useEffect(() => {
    const list = ref.current;
    if (!list || count < 6) return;
    let pos = 0;
    let idle = true;
    let atEnd = false;
    let frame = 0;
    let start: ReturnType<typeof setTimeout> | undefined;
    let resume: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      if (idle || atEnd) return;
      pos += 0.5;
      if (pos >= list.scrollHeight - list.clientHeight) {
        atEnd = true;
        list.scrollTop = list.scrollHeight;
        resume = setTimeout(() => {
          pos = 0;
          list.scrollTop = 0;
          atEnd = false;
          frame = requestAnimationFrame(tick);
        }, 6000);
      } else {
        list.scrollTop = pos;
        frame = requestAnimationFrame(tick);
      }
    };
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          clearTimeout(start);
          if (e.isIntersecting) {
            start = setTimeout(() => {
              idle = false;
              run();
            }, 2000);
          } else {
            idle = true;
            cancelAnimationFrame(frame);
          }
        }),
      { threshold: 0.3 },
    );
    const pause = () => {
      idle = true;
      atEnd = false;
      cancelAnimationFrame(frame);
      clearTimeout(resume);
      clearTimeout(start);
      resume = setTimeout(() => {
        idle = false;
        pos = list.scrollTop;
        run();
      }, 6000);
    };
    io.observe(list);
    list.addEventListener("touchstart", pause, { passive: true });
    list.addEventListener("mousedown", pause);
    list.addEventListener("wheel", pause, { passive: true });
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(start);
      clearTimeout(resume);
      list.removeEventListener("touchstart", pause);
      list.removeEventListener("mousedown", pause);
      list.removeEventListener("wheel", pause);
    };
  }, [count]);

  return (
    <div {...(dom as object)} ref={ref}>
      {wishes.status === "loading" && <div className="wsc-loading">Đang tải lời chúc...</div>}
      {wishes.status === "error" && <div className="wsc-loading">Không thể tải lời chúc lúc này.</div>}
      {wishes.status === "ready" && !count && <div className="wsc-loading">Chưa có lời chúc nào.</div>}
      {wishes.items.map((w, i) => (
        <div key={i} className="wsc-item">
          <strong>{w.name}</strong>
          <span>{w.message}</span>
        </div>
      ))}
    </div>
  );
}
