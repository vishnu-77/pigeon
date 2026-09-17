import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://www.pigeonmq.cc", changeFrequency: "weekly", priority: 1 },
    { url: "https://www.pigeonmq.cc/quickstart", changeFrequency: "weekly", priority: 0.95 },
    { url: "https://www.pigeonmq.cc/docs", changeFrequency: "weekly", priority: 0.9 },
    { url: "https://www.pigeonmq.cc/concepts", changeFrequency: "weekly", priority: 0.9 },
    { url: "https://www.pigeonmq.cc/protocol", changeFrequency: "weekly", priority: 0.9 },
    { url: "https://www.pigeonmq.cc/use-cases", changeFrequency: "weekly", priority: 0.85 },
    { url: "https://demo.pigeonmq.cc", changeFrequency: "weekly", priority: 0.9 },
  ];
}
