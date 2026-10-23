import type { SVGProps } from "react";

/** Original Bison Quest mascot: a young explorer bison with an orange bandana. */
export function BisonMascot({ size = 120, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="Bison Quest explorer bison" {...props}>
      <defs>
        <radialGradient id="bq-head" cx="50%" cy="40%" r="65%">
          <stop offset="0" stopColor="#8a5531" />
          <stop offset="1" stopColor="#5a321b" />
        </radialGradient>
      </defs>
      {/* horns */}
      <path d="M27 52 C 10 49, 6 30, 17 19 C 18 33, 27 40, 37 42 Z" fill="#f7ead0" stroke="#3a220f" strokeWidth="3" strokeLinejoin="round" />
      <path d="M93 52 C 110 49, 114 30, 103 19 C 102 33, 93 40, 83 42 Z" fill="#f7ead0" stroke="#3a220f" strokeWidth="3" strokeLinejoin="round" />
      {/* ears */}
      <ellipse cx="22" cy="62" rx="11" ry="7" fill="#6b3f22" stroke="#3a220f" strokeWidth="3" transform="rotate(-20 22 62)" />
      <ellipse cx="98" cy="62" rx="11" ry="7" fill="#6b3f22" stroke="#3a220f" strokeWidth="3" transform="rotate(20 98 62)" />
      {/* head */}
      <path d="M60 30 C 88 30, 96 52, 94 72 C 92 94, 78 104, 60 104 C 42 104, 28 94, 26 72 C 24 52, 32 30, 60 30 Z" fill="url(#bq-head)" stroke="#3a220f" strokeWidth="3" />
      {/* woolly crown */}
      <g fill="#43240f" stroke="#2c170a" strokeWidth="2">
        <circle cx="44" cy="36" r="12" />
        <circle cx="60" cy="30" r="14" />
        <circle cx="76" cy="36" r="12" />
        <circle cx="52" cy="44" r="9" />
        <circle cx="68" cy="44" r="9" />
      </g>
      {/* muzzle */}
      <ellipse cx="60" cy="84" rx="23" ry="15" fill="#b98059" stroke="#3a220f" strokeWidth="3" />
      <ellipse cx="51" cy="83" rx="3.4" ry="4.6" fill="#2c170a" />
      <ellipse cx="69" cy="83" rx="3.4" ry="4.6" fill="#2c170a" />
      <path d="M54 93 Q60 97 66 93" stroke="#2c170a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* eyes */}
      <circle cx="45" cy="62" r="7.5" fill="#fff" stroke="#2c170a" strokeWidth="2" />
      <circle cx="75" cy="62" r="7.5" fill="#fff" stroke="#2c170a" strokeWidth="2" />
      <circle cx="46.5" cy="63" r="4" fill="#0b2545" />
      <circle cx="76.5" cy="63" r="4" fill="#0b2545" />
      <circle cx="48" cy="61.5" r="1.4" fill="#fff" />
      <circle cx="78" cy="61.5" r="1.4" fill="#fff" />
      {/* cheeks */}
      <ellipse cx="34" cy="76" rx="5" ry="3" fill="#f28c28" opacity="0.45" />
      <ellipse cx="86" cy="76" rx="5" ry="3" fill="#f28c28" opacity="0.45" />
      {/* explorer bandana */}
      <path d="M30 98 Q60 114 90 98 L86 110 Q60 122 34 110 Z" fill="#f28c28" stroke="#a8520a" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M78 106 L92 118 L82 104 Z" fill="#d9700f" stroke="#a8520a" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export type GemVisualState = "active" | "locked" | "collected";

/** Faceted collectible gem. State is always also conveyed by a text label elsewhere. */
export function GemSvg({
  color,
  state,
  size = 48,
  title,
}: {
  color: string;
  state: GemVisualState;
  size?: number;
  title?: string;
}) {
  const fill = state === "locked" ? "#9aa6b8" : color;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      {state === "active" ? <circle cx="32" cy="32" r="30" fill={color} opacity="0.22" /> : null}
      <polygon points="10,24 21,9 43,9 54,24 32,57" fill={fill} stroke="#0b2545" strokeWidth="3" strokeLinejoin="round" />
      <polygon points="21,9 43,9 37,24 27,24" fill="#fff" opacity="0.45" />
      <polygon points="10,24 27,24 32,57" fill="#fff" opacity="0.2" />
      <polygon points="37,24 54,24 32,57" fill="#000" opacity="0.18" />
      <polygon points="27,24 37,24 32,57" fill="#fff" opacity="0.1" />
      <polyline points="10,24 54,24" stroke="#0b2545" strokeWidth="2" opacity="0.5" />
      {state === "active" ? <circle cx="23" cy="16" r="2.6" fill="#fff" /> : null}
      {state === "locked" ? (
        <g transform="translate(24 28)">
          <rect x="0" y="7" width="16" height="13" rx="3" fill="#0b2545" />
          <path d="M3.5 7 V4.5 a4.5 4.5 0 0 1 9 0 V7" stroke="#0b2545" strokeWidth="3" fill="none" />
        </g>
      ) : null}
      {state === "collected" ? (
        <g>
          <circle cx="48" cy="48" r="11" fill="#1d7a38" stroke="#fff" strokeWidth="3" />
          <path d="M43 48 l4 4 l7 -8" stroke="#fff" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ) : null}
    </svg>
  );
}

type IconProps = { size?: number; className?: string };
const base = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  className,
});

export const Icon = {
  Menu: ({ size = 24, className }: IconProps) => (
    <svg {...base(size, className)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
  ),
  Locate: ({ size = 24, className }: IconProps) => (
    <svg {...base(size, className)}><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" fill="currentColor" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
  ),
  Camera: ({ size = 24, className }: IconProps) => (
    <svg {...base(size, className)}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="4" /></svg>
  ),
  Close: ({ size = 24, className }: IconProps) => (
    <svg {...base(size, className)}><path d="M6 6l12 12M18 6L6 18" /></svg>
  ),
  Check: ({ size = 24, className }: IconProps) => (
    <svg {...base(size, className)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
  ),
  Cross: ({ size = 24, className }: IconProps) => (
    <svg {...base(size, className)}><path d="M7 7l10 10M17 7L7 17" /></svg>
  ),
  Question: ({ size = 24, className }: IconProps) => (
    <svg {...base(size, className)}><path d="M9.2 9a3 3 0 1 1 4.3 2.7c-.9.5-1.5 1.2-1.5 2.3" /><circle cx="12" cy="18" r="0.6" fill="currentColor" /></svg>
  ),
  Bulb: ({ size = 24, className }: IconProps) => (
    <svg {...base(size, className)}><path d="M9 18h6M10 21h4M8 14a6 6 0 1 1 8 0c-.8.8-1 1.6-1 2.5H9c0-.9-.2-1.7-1-2.5z" /></svg>
  ),
  Share: ({ size = 24, className }: IconProps) => (
    <svg {...base(size, className)}><path d="M12 3v12M7 8l5-5 5 5M5 13v7h14v-7" /></svg>
  ),
  Download: ({ size = 24, className }: IconProps) => (
    <svg {...base(size, className)}><path d="M12 3v12M7 10l5 5 5-5M5 20h14" /></svg>
  ),
  Pin: ({ size = 24, className }: IconProps) => (
    <svg {...base(size, className)}><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
  ),
  Offline: ({ size = 24, className }: IconProps) => (
    <svg {...base(size, className)}><path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M3 3l18 18" /><circle cx="12" cy="19" r="0.8" fill="currentColor" /></svg>
  ),
  Album: ({ size = 24, className }: IconProps) => (
    <svg {...base(size, className)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 16l5-5 4 4 3-3 6 6" /><circle cx="16" cy="9" r="1.5" /></svg>
  ),
  Route: ({ size = 24, className }: IconProps) => (
    <svg {...base(size, className)}><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" /></svg>
  ),
  ChevronDown: ({ size = 24, className }: IconProps) => (
    <svg {...base(size, className)}><path d="M6 9l6 6 6-6" /></svg>
  ),
  ChevronUp: ({ size = 24, className }: IconProps) => (
    <svg {...base(size, className)}><path d="M6 15l6-6 6 6" /></svg>
  ),
  Upload: ({ size = 24, className }: IconProps) => (
    <svg {...base(size, className)}><path d="M12 15V3M7 8l5-5 5 5M4 15v5h16v-5" /></svg>
  ),
  Refresh: ({ size = 24, className }: IconProps) => (
    <svg {...base(size, className)}><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" /></svg>
  ),
};
