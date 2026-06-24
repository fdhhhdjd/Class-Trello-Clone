// Design tokens. Values resolve to CSS custom properties so light/dark theming
// works via [data-theme]. The raw palettes live in theme.js (single source).
// Export names are kept stable for backward compat with existing app code.

const v = (name, fallback) => `var(--${name}, ${fallback})`;

// Brand / palette tokens — resolve to CSS vars (themeable), fallbacks = light.
export const color = {
  // base palette
  navyDeep: v('c-navy-deep', '#091E42'),
  navyMedium: v('c-navy-medium', '#172B4D'),
  navyLight: v('c-navy-light', '#505F79'),
  blue: v('c-blue', '#1868DB'),
  blueBright: v('c-blue-bright', '#357DE8'),
  blueDark: v('c-blue-dark', '#1558BC'),
  purple: v('c-purple', '#A855F7'),
  cyan: v('c-cyan', '#06B6D4'),
  danger: v('c-danger', '#C9372C'),
  success: v('c-success', '#4C6B1F'),
  errorBg: v('c-error-bg', '#FFF5F4'),
  white: v('c-white', '#FFFFFF'),
  offWhite: v('c-off-white', '#F1F2F4'),
  lightGray: v('c-light-gray', '#DCDFE4'),
  border: v('c-border', '#DDDEE1'),
  mediumGray: v('c-medium-gray', '#A9ABAF'),
  darkGray: v('c-dark-gray', '#505258'),
  primaryBadgeBg: v('c-primary-badge-bg', '#E0ECFF'),
  // semantic aliases (preferred for dark-mode correctness)
  text: v('c-text', '#091E42'),
  textMuted: v('c-text-muted', '#505F79'),
  surface: v('c-surface', '#FFFFFF'),
  surfaceAlt: v('c-surface-alt', '#F1F2F4'),
  successBg: v('c-success-bg', '#E8F5E9'),
};

export const space = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  base: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '52px',
  xxxl: '60px',
  max: '76px',
};

export const radius = {
  badge: '2px',
  base: '4px',
  primary: '4.8px',
  large: '8px',
  pill: '50px',
};

export const shadow = {
  subtle: v('s-subtle', 'rgba(9, 30, 66, 0.13) 0px 1px 1px 0px'),
  base: v('s-base', 'rgba(9, 30, 66, 0.15) 0px 8px 16px 0px'),
  hover: v('s-hover', 'rgba(9, 30, 66, 0.20) 0px 12px 24px 0px'),
  modal: v('s-modal', 'rgba(9, 30, 66, 0.47) 0px 8px 16px 0px'),
  dropdown: v('s-dropdown', 'rgba(9, 30, 66, 0.25) 0px 4px 12px 0px'),
};

const SANS = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export const font = {
  display: SANS,
  text: SANS,
  mono: "Menlo, Monaco, 'Courier New', monospace",
};

export const focusRing = v('focus-ring', '0px 0px 0px 3px rgba(24, 104, 219, 0.15)');

export const breakpoint = {
  mobile: '767px',
  tablet: '1023px',
  desktop: '1279px',
};

// Curated palette for board backgrounds and label chips (fixed, not themed).
export const boardBackgrounds = [
  'linear-gradient(135deg, #1868DB 0%, #0747A6 100%)',
  'linear-gradient(135deg, #A855F7 0%, #6D28D9 100%)',
  'linear-gradient(135deg, #06B6D4 0%, #0E7490 100%)',
  'linear-gradient(135deg, #0EA47A 0%, #086650 100%)',
  'linear-gradient(135deg, #E8590C 0%, #BD3A00 100%)',
  'linear-gradient(135deg, #C9372C 0%, #8E1A12 100%)',
  'linear-gradient(135deg, #172B4D 0%, #091E42 100%)',
  'linear-gradient(135deg, #F2994A 0%, #DB6F26 100%)',
];

export const labelColors = {
  green: '#4BCE97',
  yellow: '#F5CD47',
  orange: '#FEA362',
  red: '#F87168',
  purple: '#9F8FEF',
  blue: '#579DFF',
  sky: '#6CC3E0',
  lime: '#94C748',
  pink: '#E774BB',
  gray: '#8590A2',
};
