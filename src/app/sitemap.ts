import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://kebiki.studio", changeFrequency: "monthly", priority: 1 },
    { url: "https://kebiki.studio/terms", changeFrequency: "monthly", priority: 0.5 },
  ];
}
