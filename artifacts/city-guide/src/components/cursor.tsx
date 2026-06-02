import { useEffect, useRef } from "react";

const HOVER_SELECTORS = "a, button, [role='button'], label, input, textarea, select, [data-cursor-hover]";

export function CustomCursor() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let visible = false;

    const onMouseMove = (e: MouseEvent) => {
      root.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      if (!visible) {
        root.style.opacity = "1";
        visible = true;
      }
    };

    const onMouseLeave = () => {
      root.style.opacity = "0";
      visible = false;
    };

    const onMouseEnter = () => {
      if (visible) root.style.opacity = "1";
    };

    const onHoverEnter = (e: MouseEvent) => {
      const target = e.target as Element;
      if (target.closest(HOVER_SELECTORS)) {
        root.classList.add("cursor--hover");
      }
    };

    const onHoverLeave = (e: MouseEvent) => {
      const target = e.target as Element;
      if (target.closest(HOVER_SELECTORS)) {
        root.classList.remove("cursor--hover");
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseenter", onMouseEnter);
    document.addEventListener("mouseover", onHoverEnter);
    document.addEventListener("mouseout", onHoverLeave);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseenter", onMouseEnter);
      document.removeEventListener("mouseover", onHoverEnter);
      document.removeEventListener("mouseout", onHoverLeave);
    };
  }, []);

  return (
    <div ref={rootRef} className="cursor-root">
      <div className="cursor-inner" />
    </div>
  );
}
