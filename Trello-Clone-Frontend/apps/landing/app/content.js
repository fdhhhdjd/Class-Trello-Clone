import { color } from './tokens';

// Hardcoded fallback content. Used when the CMS API is unavailable or a field is missing.
export const DEFAULTS = {
  brand: { name: 'Trello Clone' },
  chatbot: {
    enabled: true,
    title: 'Hỏi đáp nhanh với Trợ lý AI trên Zalo',
    subtitle: 'Quét mã QR để chat với bot — trả lời tức thì 24/7.',
    botName: 'Bot Code Web Không Khó',
    qrImage: '',
  },
  hero: {
    eyebrow: 'Free to start · No credit card',
    title: 'Organize anything, together.',
    subtitle:
      'Boards, lists, and cards to manage your projects and keep your team in sync. Simple, fast, and built for the way you work.',
    primaryCtaLabel: 'Get started free',
    secondaryCtaLabel: 'See features',
    image: '',
    note: 'Join 12,000+ teams shipping work faster.',
  },
  trust: {
    label: 'Trusted by fast-moving teams worldwide',
    logos: ['Northwind', 'Acme Co', 'Globex', 'Initech', 'Umbrella', 'Hooli'],
  },
  features: [
    { icon: 'layout-dashboard', bg: color.blue, title: 'Boards & lists', desc: 'Give every project a home. See work flow from to-do to done at a single glance.' },
    { icon: 'grip-vertical', bg: color.purple, title: 'Drag & drop', desc: 'Move cards across lists with a smooth, natural drag. Reorder work in seconds.' },
    { icon: 'users', bg: color.cyan, title: 'Real-time collaboration', desc: 'Invite your team and watch moves, comments, and edits update live for everyone.' },
    { icon: 'check-square', bg: color.green, title: 'Checklists', desc: 'Break cards into steps and track completion with progress you can actually see.' },
    { icon: 'tag', bg: color.blueDark, title: 'Labels & filters', desc: 'Color-code cards and filter instantly to find exactly what you need, fast.' },
    { icon: 'shield', bg: color.navyMedium, title: 'Admin console', desc: 'Manage members, permissions, and workspace settings from one secure place.' },
  ],
  steps: [
    { title: 'Create a board', desc: 'Spin up a board for any project, sprint, or goal in a couple of clicks.' },
    { title: 'Add lists & cards', desc: 'Map your workflow into lists, then capture every task as a card you can move.' },
    { title: 'Collaborate & ship', desc: 'Invite your team, assign work, track progress in real time, and get it done.' },
  ],
  pricing: [
    { name: 'Free', price: '$0', period: 'forever', tag: 'For individuals getting started', features: ['Up to 10 boards', 'Unlimited cards', 'Drag & drop', 'Mobile + web'], ctaLabel: 'Start free' },
    { name: 'Pro', price: '$5', period: '/ user / mo', tag: 'For growing teams', features: ['Unlimited boards', 'Real-time collaboration', 'Checklists & due dates', 'Labels & filters', 'Priority support'], ctaLabel: 'Start Pro trial', recommended: true },
    { name: 'Business', price: '$10', period: '/ user / mo', tag: 'For organizations', features: ['Everything in Pro', 'Admin console', 'Advanced permissions', 'Usage insights', 'SSO ready'], ctaLabel: 'Contact sales' },
  ],
  faq: [
    { q: 'Is Trello Clone really free to start?', a: 'Yes. The Free plan includes unlimited cards and up to 10 boards per workspace, with no credit card required. Upgrade only when your team needs more.' },
    { q: 'Can I collaborate with my team in real time?', a: 'Absolutely. Invite teammates to any board and see card moves, comments, and edits update live for everyone, no refresh needed.' },
    { q: 'Does it work on mobile?', a: 'Yes. The web app is fully responsive and works in any modern mobile browser, so you can manage your boards on the go.' },
    { q: 'Can I drag and drop cards between lists?', a: 'Drag-and-drop is at the heart of the product. Move cards within a list or across lists with a smooth, natural drag.' },
    { q: 'What does the admin console do?', a: 'On the Business plan, admins manage members, permissions, and workspace settings from a single console with usage visibility.' },
    { q: 'Can I cancel or change plans anytime?', a: 'Yes. Upgrade, downgrade, or cancel at any time. Changes take effect at the start of your next billing cycle.' },
  ],
  footer: {
    tagline: 'The simple, fast way to organize projects and collaborate with your team.',
    copyright: `© ${new Date().getFullYear()} Trello Clone. Built as a demo.`,
  },
};

const API_URL =
  process.env.LANDING_API_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:4000';

// Deep-merge fetched over defaults. Arrays/objects from `over` replace base when present & non-empty.
function merge(base, over) {
  if (over == null) return base;
  if (Array.isArray(base) || Array.isArray(over)) {
    return Array.isArray(over) && over.length ? over : base;
  }
  if (typeof base === 'object' && typeof over === 'object') {
    const out = { ...base };
    for (const k of Object.keys(over)) out[k] = merge(base[k], over[k]);
    return out;
  }
  return over === undefined || over === null || over === '' ? base : over;
}

export async function getLandingContent() {
  try {
    const res = await fetch(`${API_URL}/api/landing`, { cache: 'no-store' });
    if (!res.ok) return DEFAULTS;
    const data = await res.json();
    return merge(DEFAULTS, data);
  } catch {
    return DEFAULTS;
  }
}
