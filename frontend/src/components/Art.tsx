import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

// Premium illustrative card backdrop: gradient + wavy texture + leaf silhouette with a lime arc and dot.
const PALETTES = {
  1: { stops: ['#7A4632', '#5B5F2B', '#A8CF3C'], leafX: 0, flip: false },
  2: { stops: ['#222A2B', '#34461C', '#86AE2D'], leafX: 0, flip: true },
  3: { stops: ['#1E2528', '#2A3A1C', '#4F6C20'], leafX: 0, flip: false },
} as const;

export function CardArt({ variant }: { variant: 1 | 2 | 3 }) {
  const p = PALETTES[variant];
  const waves = Array.from({ length: 16 }, (_, i) => {
    const y = 14 + i * 22;
    return `M-10 ${y} Q 30 ${y - 14} 70 ${y} T 150 ${y} T 230 ${y} T 310 ${y} T 390 ${y}`;
  });
  const x = (v: number) => (p.flip ? 320 - v : v);
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 320 360" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id={`cg${variant}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={p.stops[0]} />
          <Stop offset="0.55" stopColor={p.stops[1]} />
          <Stop offset="1" stopColor={p.stops[2]} />
        </LinearGradient>
      </Defs>
      <Path d="M0 0H320V360H0Z" fill={`url(#cg${variant})`} />
      {waves.map((d, i) => (<Path key={i} d={d} stroke="#FFFFFF" strokeOpacity={0.07} strokeWidth={1.2} fill="none" />))}
      <Path d={`M${x(236)} 40 C ${x(312)} 70 ${x(318)} 220 ${x(252)} 320 C ${x(214)} 262 ${x(186)} 150 ${x(236)} 40 Z`} fill="#0B0E0E" fillOpacity={variant === 1 ? 0.62 : 0.45} />
      <Path d={`M${x(248)} 74 C ${x(268)} 140 ${x(268)} 210 ${x(254)} 272`} stroke="#C6F04F" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <Circle cx={x(247)} cy={66} r={7} fill="#C6F04F" />
    </Svg>
  );
}

// Sign-in hero: two crossing arcs on a dark green panel.
export function ArcsArt() {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 320 120" preserveAspectRatio="xMidYMid slice">
      <Path d="M0 0H320V120H0Z" fill="#203A2F" />
      <Path d="M40 100 C 90 10 190 0 275 70" stroke="#C97A63" strokeWidth={3} fill="none" strokeLinecap="round" />
      <Path d="M30 108 C 100 24 190 20 255 100" stroke="#7DB45C" strokeWidth={3} fill="none" strokeLinecap="round" />
    </Svg>
  );
}
