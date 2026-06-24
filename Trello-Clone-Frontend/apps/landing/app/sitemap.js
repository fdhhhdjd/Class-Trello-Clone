const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://103.179.189.81:3000';

export default function sitemap() {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
