import { color, USER_APP_URL } from './tokens';
import { getLandingContent } from './content';
import Header from './Header';
import Faq from './Faq';
import {
  getIcon, IconCheckSmall, IconBrand, IconX, IconGithub, IconLinkedin,
} from './icons';

const FOOTER = {
  Product: ['Features', 'Pricing', 'Integrations', 'Changelog'],
  Company: ['About', 'Blog', 'Careers', 'Contact'],
  Legal: ['Privacy', 'Terms', 'Security', 'Cookies'],
};

export default async function Home() {
  const content = await getLandingContent();
  const { brand, hero, trust, features, steps, pricing, faq, footer } = content;
  const chatbot = content.chatbot ?? {};
  const qrSrc = chatbot.qrImage || '/zalo-bot-qr.jpg';

  return (
    <>
      <Header brand={brand} />
      <main id="top">
        {/* Hero */}
        <section className="hero">
          <div className="container hero__grid">
            <div>
              <span className="eyebrow">{hero.eyebrow}</span>
              <h1>{hero.title}</h1>
              <p className="hero__sub">{hero.subtitle}</p>
              <div className="hero__ctas">
                <a href={USER_APP_URL} className="btn btn-primary btn-lg">{hero.primaryCtaLabel}</a>
                <a href="#features" className="btn btn-secondary btn-lg">{hero.secondaryCtaLabel}</a>
              </div>
              {hero.note && <p className="hero__note">{hero.note}</p>}
            </div>
            {hero.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="hero__image" src={hero.image} alt={hero.title || 'Product preview'} />
            ) : (
              <BoardMock />
            )}
          </div>
        </section>

        {/* Trust strip */}
        <section className="trust" aria-label="Trusted by teams">
          <div className="container trust__inner">
            <p className="trust__label">{trust.label}</p>
            <div className="trust__logos">
              {trust.logos.map((t) => (
                <span className="trust__logo" key={t}>{t}</span>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="section">
          <div className="container">
            <div className="section-head">
              <h2>Everything you need to stay on track</h2>
              <p>A focused set of features that keep work moving, without the clutter.</p>
            </div>
            <div className="feature-grid">
              {features.map((f) => {
                const Icon = getIcon(f.icon);
                return (
                  <article className="feature-card" key={f.title}>
                    <span className="feature-card__icon" style={{ background: f.bg || color.blue }}>
                      <Icon />
                    </span>
                    <h3>{f.title}</h3>
                    <p>{f.desc}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="section" style={{ background: color.offWhite }}>
          <div className="container">
            <div className="section-head">
              <h2>Get organized in three steps</h2>
              <p>From blank board to shipped work, faster than your next coffee break.</p>
            </div>
            <div className="steps">
              {steps.map((s, i) => (
                <article className="step" key={s.title}>
                  <span className="step__num">{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="section pricing">
          <div className="container">
            <div className="section-head">
              <h2>Simple, transparent pricing</h2>
              <p>Start free and upgrade as your team grows. Cancel anytime.</p>
            </div>
            <div className="price-grid">
              {pricing.map((p) => (
                <article
                  className={`price-card${p.recommended ? ' price-card--featured' : ''}`}
                  key={p.name}
                >
                  {p.recommended && <span className="price-card__badge">RECOMMENDED</span>}
                  <h3>{p.name}</h3>
                  {p.tag && <p className="price-card__tag">{p.tag}</p>}
                  <div className="price-card__price">
                    {p.price}<span className="price-card__per"> {p.period}</span>
                  </div>
                  <ul className="price-card__list">
                    {(p.features || []).map((feat) => (
                      <li key={feat}><IconCheckSmall /> {feat}</li>
                    ))}
                  </ul>
                  <a
                    href={USER_APP_URL}
                    className={`btn ${p.recommended ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {p.ctaLabel}
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="section">
          <div className="container">
            <div className="section-head">
              <h2>Frequently asked questions</h2>
              <p>Everything you need to know before you get started.</p>
            </div>
            <Faq items={faq} />
          </div>
        </section>

        {/* Zalo chatbot (CMS-editable) */}
        {chatbot.enabled !== false && (
          <section id="chatbot" className="section" style={{ background: color.offWhite }}>
            <div className="container">
              <div className="section-head">
                <h2>{chatbot.title || 'Hỏi đáp nhanh với Trợ lý AI trên Zalo'}</h2>
                <p>{chatbot.subtitle || 'Quét mã QR để chat với bot — trả lời tức thì 24/7.'}</p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{
                  background: '#fff', borderRadius: 16, padding: 24, textAlign: 'center',
                  boxShadow: '0 8px 24px rgba(9,30,66,0.12)', maxWidth: 320,
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrSrc} alt="QR chat bot Zalo" width={260} height={260}
                    style={{ width: 260, height: 260, objectFit: 'contain', borderRadius: 12 }} />
                  <p style={{ margin: '14px 0 0', fontWeight: 700, color: color.navyMedium }}>{chatbot.botName || 'Bot Code Web Không Khó'}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 14, color: color.navyLight }}>Mở Zalo → quét QR để bắt đầu chat</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Final CTA */}
        <section className="section">
          <div className="container">
            <div className="cta-banner">
              <h2>Ready to get your team organized?</h2>
              <p>Start free in seconds. No credit card, no setup, no clutter.</p>
              <a href={USER_APP_URL} className="btn btn-on-dark btn-lg">{hero.primaryCtaLabel}</a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="site-footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <span className="brand">
                <span className="brand__mark"><IconBrand /></span>
                {brand.name}
              </span>
              <p>{footer.tagline}</p>
            </div>
            {Object.entries(FOOTER).map(([heading, links]) => (
              <div className="footer-col" key={heading}>
                <h4>{heading}</h4>
                <ul>
                  {links.map((l) => (
                    <li key={l}><a href="#top">{l}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="footer-bottom">
            <p>{footer.copyright}</p>
            <div className="footer-social">
              <a href="#top" aria-label="X (Twitter)"><IconX /></a>
              <a href="#top" aria-label="GitHub"><IconGithub /></a>
              <a href="#top" aria-label="LinkedIn"><IconLinkedin /></a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

function BoardMock() {
  return (
    <div className="board-mock" aria-hidden="true">
      <div className="board-mock__bar">
        <span className="board-mock__dot" />
        <span className="board-mock__dot" />
        <span className="board-mock__dot" />
        <span className="board-mock__title">Product Roadmap</span>
      </div>
      <div className="board-mock__lists">
        <div className="mock-list">
          <div className="mock-list__head">To do</div>
          <div className="mock-card"><span className="mock-label" style={{ background: color.purple }} />Design landing page</div>
          <div className="mock-card"><span className="mock-label" style={{ background: color.cyan }} />Write release notes</div>
          <div className="mock-card">Plan Q3 sprint</div>
        </div>
        <div className="mock-list">
          <div className="mock-list__head">In progress</div>
          <div className="mock-card mock-card__lift"><span className="mock-label" style={{ background: color.blue }} />Build API endpoints</div>
          <div className="mock-card"><span className="mock-label" style={{ background: color.green }} />User testing</div>
        </div>
        <div className="mock-list">
          <div className="mock-list__head">Done</div>
          <div className="mock-card"><span className="mock-label" style={{ background: color.green }} />Setup CI/CD</div>
          <div className="mock-card"><span className="mock-label" style={{ background: color.blueDark }} />Auth flow</div>
        </div>
      </div>
    </div>
  );
}
