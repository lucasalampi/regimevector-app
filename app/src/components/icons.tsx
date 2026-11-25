import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';

// Lucide geometry at stroke-width 1.5, per the Industry DS.
type P = { size?: number; color?: string; fill?: string };
const base = (size: number, color: string, fill = 'none') => ({
  width: size, height: size, viewBox: '0 0 24 24', fill, stroke: color, strokeWidth: 1.5,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
});

export const ChevronRight = ({ size = 18, color = '#0b0f1a' }: P) => <Svg {...base(size, color)}><Path d="m9 18 6-6-6-6" /></Svg>;
export const ChevronLeft = ({ size = 22, color = '#fff' }: P) => <Svg {...base(size, color)}><Path d="m15 18-6-6 6-6" /></Svg>;
export const Search = ({ size = 21, color = '#fff' }: P) => (
  <Svg {...base(size, color)}><Circle cx="11" cy="11" r="8" /><Path d="m21 21-4.3-4.3" /></Svg>
);
export const Star = ({ size = 18, color = '#15304e', fill = 'none' }: P) => (
  <Svg {...base(size, color, fill)}><Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></Svg>
);
export const Close = ({ size = 18, color = '#0b0f1a' }: P) => <Svg {...base(size, color)}><Path d="M18 6 6 18" /><Path d="m6 6 12 12" /></Svg>;
export const Bookmark = ({ size = 18, color = '#15304e', fill = 'none' }: P) => (
  <Svg {...base(size, color, fill)}><Path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></Svg>
);
export const Sun = ({ size = 21, color }: P) => (
  <Svg {...base(size, color!)}>
    <Circle cx="12" cy="12" r="4" />
    <Path d="M12 2v2" /><Path d="M12 20v2" /><Path d="M2 12h2" /><Path d="M20 12h2" />
    <Path d="m4.93 4.93 1.41 1.41" /><Path d="m17.66 17.66 1.41 1.41" /><Path d="m6.34 17.66-1.41 1.41" /><Path d="m19.07 4.93-1.41 1.41" />
  </Svg>
);
export const Grid = ({ size = 21, color }: P) => (
  <Svg {...base(size, color!)}>
    <Rect x="3" y="3" width="7" height="7" /><Rect x="14" y="3" width="7" height="7" /><Rect x="14" y="14" width="7" height="7" /><Rect x="3" y="14" width="7" height="7" />
  </Svg>
);
export const FileText = ({ size = 21, color }: P) => (
  <Svg {...base(size, color!)}>
    <Path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><Path d="M14 2v6h6" /><Path d="M16 13H8" /><Path d="M16 17H8" />
  </Svg>
);
export const Bell = ({ size = 21, color }: P) => (
  <Svg {...base(size, color!)}><Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></Svg>
);
export const Menu = ({ size = 21, color }: P) => (
  <Svg {...base(size, color!)}><Path d="M4 6h16" /><Path d="M4 12h16" /><Path d="M4 18h16" /></Svg>
);
