import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { color, font, radius } from '@trello/ui';

marked.setOptions({ breaks: true, gfm: true });

// Open sanitized links in a new tab safely.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

// Renders markdown -> sanitized HTML. Display only.
export function Markdown({ children, style }) {
  const html = useMemo(() => {
    const src = typeof children === 'string' ? children : '';
    return DOMPurify.sanitize(marked.parse(src));
  }, [children]);

  return (
    <div
      className="md-body"
      style={{ fontFamily: font.text, fontSize: 14, color: color.text, lineHeight: 1.55, wordBreak: 'break-word', ...style }}
      dangerouslySetInnerHTML={{ __html: html }}
    >
    </div>
  );
}

export const markdownStyles = `
.md-body h1,.md-body h2,.md-body h3{font-family:${font.display};font-weight:700;margin:.6em 0 .3em;line-height:1.25}
.md-body h1{font-size:1.4em}.md-body h2{font-size:1.2em}.md-body h3{font-size:1.05em}
.md-body p{margin:.4em 0}
.md-body ul,.md-body ol{margin:.4em 0;padding-left:1.4em}
.md-body li{margin:.15em 0}
.md-body a{color:${color.blue};text-decoration:underline}
.md-body code{background:${color.surfaceAlt};padding:1px 5px;border-radius:${radius.base}px;font-size:.9em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.md-body pre{background:${color.surfaceAlt};padding:10px 12px;border-radius:${radius.base}px;overflow:auto;margin:.5em 0}
.md-body pre code{background:transparent;padding:0}
.md-body blockquote{border-left:3px solid ${color.border};margin:.5em 0;padding:.1em .9em;color:${color.textMuted}}
.md-body img{max-width:100%;border-radius:${radius.base}px}
.md-body strong{font-weight:700}.md-body em{font-style:italic}
.md-body :first-child{margin-top:0}.md-body :last-child{margin-bottom:0}
`;
