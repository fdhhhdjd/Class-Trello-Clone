'use client';

import { useState } from 'react';
import { IconPlus } from './icons';

export default function Faq({ items }) {
  const [open, setOpen] = useState(0);
  const faqs = items && items.length ? items : [];

  return (
    <div className="faq-wrap">
      {faqs.map((item, i) => {
        const isOpen = open === i;
        const panelId = `faq-panel-${i}`;
        return (
          <div className="faq-item" key={item.q}>
            <button
              className="faq-item__btn"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpen(isOpen ? -1 : i)}
            >
              {item.q}
              <IconPlus className={`faq-item__icon${isOpen ? ' faq-item__icon--open' : ''}`} />
            </button>
            <div
              id={panelId}
              role="region"
              className={`faq-item__panel${isOpen ? ' faq-item__panel--open' : ''}`}
            >
              <p>{item.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
