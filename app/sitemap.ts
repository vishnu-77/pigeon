import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://pigeonmq.cc",
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: "https://pigeonmq.cc/?view=research",
      changeFrequency: "monthly",
      priority: 0.8
    }
  ];
}
