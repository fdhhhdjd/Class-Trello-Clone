// Inlined from .claude/references/trello.com-DESIGN.md (landing avoids @trello/ui to keep bundler simple).
export const color = {
  navyDeep: '#091E42',
  navyMedium: '#172B4D',
  navyLight: '#505F79',
  blue: '#1868DB',
  blueBright: '#357DE8',
  blueDark: '#1558BC',
  purple: '#A855F7',
  cyan: '#06B6D4',
  green: '#4C6B1F',
  danger: '#C9372C',
  white: '#FFFFFF',
  offWhite: '#F1F2F4',
  border: '#DDDEE1',
  borderMedium: '#DCDFE4',
  mutedText: '#C7D1E0',
  primaryBadgeBg: '#E0ECFF',
};

export const space = {
  xs: '4px', sm: '8px', md: '12px', base: '16px',
  lg: '24px', xl: '32px', xxl: '52px', xxxl: '60px', max: '76px',
};

export const radius = { base: '4px', primary: '4.8px', large: '8px', xlarge: '16px', pill: '50px' };

export const shadow = {
  subtle: 'rgba(9, 30, 66, 0.13) 0px 1px 1px 0px',
  base: 'rgba(9, 30, 66, 0.15) 0px 8px 16px 0px',
  hover: 'rgba(9, 30, 66, 0.20) 0px 12px 24px 0px',
};

export const font = {
  display: "'Charlie Display', Georgia, 'Times New Roman', serif",
  text: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

export const USER_APP_URL = process.env.NEXT_PUBLIC_USER_APP_URL || 'http://103.179.189.81';
