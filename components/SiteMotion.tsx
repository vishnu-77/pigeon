"use client";

import { useEffect } from "react";

export function SiteMotion() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    const sections = Array.from(document.querySelectorAll<HTMLElement>("main > section:not(:first-child)"));
    sections.forEach((section) => section.setAttribute("data-reveal", "pending"));
    document.documentElement.classList.add("motion-ready");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target as HTMLElement;
          element.setAttribute("data-reveal", "visible");
          observer.unobserve(element);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -8% 0px" }
    );

    sections.forEach((section) => observer.observe(section));

    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("motion-ready");
    };
  }, []);

  return null;
}
