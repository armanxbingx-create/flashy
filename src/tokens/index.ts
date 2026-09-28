export const COLORS = {
  background: '#070912',
  surface: '#10141F',
  surface2: '#151A26',
  text: '#F7F7FB',
  textMuted: '#9DA1B0',
  textDim: '#686D7B',
  spectrumPink: '#FF187F',
  spectrumMagenta: '#DF12E8',
  spectrumPurple: '#8D22FF',
  spectrumOrange: '#FF6415',
  spectrumYellow: '#FFC52A',
  correct: '#34D399',
  incorrect: '#EF4444',
} as const

export const GRADIENTS = {
  spectrum: `linear-gradient(135deg, ${COLORS.spectrumPink}, ${COLORS.spectrumMagenta}, ${COLORS.spectrumPurple}, ${COLORS.spectrumOrange}, ${COLORS.spectrumYellow})`,
  spectrumHorizontal: `linear-gradient(90deg, ${COLORS.spectrumPink}, ${COLORS.spectrumMagenta}, ${COLORS.spectrumPurple}, ${COLORS.spectrumOrange}, ${COLORS.spectrumYellow})`,
  spectrumSubtle: `linear-gradient(135deg, rgba(255,24,127,0.15), rgba(223,18,232,0.15), rgba(141,34,255,0.15))`,
  spectrumGlow: `radial-gradient(ellipse at center, rgba(141,34,255,0.3) 0%, rgba(223,18,232,0.15) 40%, transparent 70%)`,
} as const

export const RADII = {
  sm: '12px',
  md: '16px',
  lg: '22px',
  hero: '28px',
  nav: '28px',
  pill: '100px',
} as const

export const DURATIONS = {
  micro: 140,
  normal: 200,
  card: 260,
  slow: 320,
} as const
