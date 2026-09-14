import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://www.pigeonmq.cc",
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: "https://demo.pigeonmq.cc",
      changeFrequency: "weekly",
      priority: 0.9
    }
  ];
}
