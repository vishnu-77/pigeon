import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/"
    },
    sitemap: "https://pigeonmq.cc/sitemap.xml",
    host: "https://pigeonmq.cc"
  };
}
