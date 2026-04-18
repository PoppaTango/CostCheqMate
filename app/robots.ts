import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXTAUTH_URL || "https://costcheqmate.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/about", "/login", "/signup"],
        disallow: ["/dashboard", "/api/", "/payment/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
