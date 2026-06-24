const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://103.179.189.81:3000';

export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
