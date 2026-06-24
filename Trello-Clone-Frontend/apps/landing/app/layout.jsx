import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://103.179.189.81:3000';
const TITLE = 'Trello Clone — Organize anything, together';
const DESCRIPTION =
  'Boards, lists, and cards to organize your projects and collaborate with your team in real time. A fast, simple Trello clone, free to start.';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s | Trello Clone',
  },
  description: DESCRIPTION,
  applicationName: 'Trello Clone',
  keywords: [
    'trello clone',
    'kanban board',
    'project management',
    'task management',
    'team collaboration',
    'boards lists cards',
    'agile',
    'productivity',
  ],
  authors: [{ name: 'Trello Clone' }],
  alternates: { canonical: '/' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: 'Trello Clone',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  category: 'productivity',
};

export const viewport = {
  themeColor: '#1868DB',
  width: 'device-width',
  initialScale: 1,
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'Trello Clone',
      url: SITE_URL,
      description: DESCRIPTION,
      logo: `${SITE_URL}/icon.png`,
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Trello Clone',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: SITE_URL,
      description: DESCRIPTION,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.8',
        ratingCount: '1240',
      },
    },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
