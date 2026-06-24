import type { CSSProperties } from 'react';

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------

export const resolveAvatarColor = (avatar: string): string => {
  switch (avatar) {
    case 'indigo': return '#6366f1';
    case 'pink': return '#ec4899';
    case 'emerald': return '#10b981';
    case 'amber': return '#f59e0b';
    case 'cyan': return '#06b6d4';
    case 'rose': return '#f43f5e';
    case 'violet': return '#8b5cf6';
    default: return '#6366f1';
  }
};

export const stripEmojis = (str: string): string => {
  if (typeof str !== 'string') return str;
  return str.replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu, '')
            .replace(/\p{Extended_Pictographic}/gu, '')
            .trim();
};

// ---------------------------------------------------------------------------
// Design token palette
// ---------------------------------------------------------------------------

export const colors = {
  bg: '#090b11',
  bgAlt: '#0d0f18',
  surface: 'rgba(255, 255, 255, 0.03)',
  surfaceHover: 'rgba(255, 255, 255, 0.06)',
  border: 'rgba(255,255,255,0.06)',
  text: '#ffffff',
  textMuted: '#94a3b8',
  primary: '#2563eb',
  primaryGlow: 'rgba(37,99,235,0.15)',
  secondary: '#64748b',
  secondaryGlow: 'rgba(100,116,139,0.1)',
  accent: '#10b981',
  danger: '#ef4444',
};
