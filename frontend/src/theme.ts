import { Platform } from 'react-native';

// Dark "archive" design system (sampled from the approved Profile / Sign-in / Home mockups).
export const colors = {
  bg: '#13171B',
  bg2: '#1A1519',
  card: '#1D242B',
  cardAlt: '#222A31',
  line: 'rgba(255,255,255,0.14)',
  inputBg: '#12181D',
  inputLine: '#3A444C',
  text: '#FFFFFF',
  muted: '#A9B0B6',
  faint: '#6C757C',
  lime: '#C6F04F',
  limeDark: '#10140A',
  limeSoft: 'rgba(198,240,79,0.14)',
  rust: '#7B4332',
  danger: '#FF7B68',
  warn: '#FFB74D',
  info: '#7CC4FF',
  purple: '#D1A3FF',
  // legacy aliases so any untouched file keeps compiling
  ink: '#FFFFFF', inkSoft: '#A9B0B6', forest: '#13171B', forestBright: '#C6F04F',
  moss: '#C6F04F', cream: '#13171B', paper: '#1D242B', mist: '#222A31', gold: '#7B4332', border: 'rgba(255,255,255,0.14)',
};

export const fonts = {
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' }) as string,
};

export const radii = { sm: 14, md: 22, lg: 28, pill: 999 };
export const shadows = {
  card: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 18, elevation: 4 },
  floating: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 7 },
};
