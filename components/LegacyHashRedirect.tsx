"use client";

import { useEffect } from "react";

export function LegacyHashRedirect() {
  useEffect(() => {
    if (window.location.hash === "#quickstart") {
      window.location.replace("/quickstart");
    }
  }, []);

  return null;
}
