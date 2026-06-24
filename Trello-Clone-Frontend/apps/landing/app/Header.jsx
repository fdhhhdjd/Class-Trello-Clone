'use client';

import { useState } from 'react';
import { USER_APP_URL } from './tokens';
import { IconBrand, IconMenu, IconClose } from './icons';

const NAV = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

export default function Header({ brand }) {
  const [open, setOpen] = useState(false);
  const brandName = brand?.name || 'Trello Clone';

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <a href="#top" className="brand" aria-label={`${brandName} home`}>
          <span className="brand__mark"><IconBrand /></span>
          {brandName}
        </a>

        <nav className="nav-desktop" aria-label="Primary">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="nav-link">{n.label}</a>
          ))}
        </nav>

        <div className="header-actions">
          <a href={USER_APP_URL} className="btn btn-ghost">Log in</a>
          <a href={USER_APP_URL} className="btn btn-primary">Get started</a>
        </div>

        <button
          className="nav-toggle"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <IconClose /> : <IconMenu />}
        </button>
      </div>

      {open && (
        <div className="mobile-menu">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="nav-link" onClick={() => setOpen(false)}>
              {n.label}
            </a>
          ))}
          <a href={USER_APP_URL} className="btn btn-secondary">Log in</a>
          <a href={USER_APP_URL} className="btn btn-primary">Get started</a>
        </div>
      )}
    </header>
  );
}
