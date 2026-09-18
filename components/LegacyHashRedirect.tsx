"use client";

import { useEffect } from "react";

export function LegacyHashRedirect() {
  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "");
    if (!id) return;

    const scrollToTarget = () => {
      const target = document.getElementById(id);
      if (target) target.scrollIntoView({ block: "start" });
    };

    requestAnimationFrame(scrollToTarget);
  }, []);

  return null;
}
