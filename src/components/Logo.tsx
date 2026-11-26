import React from "react";

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  textClassName?: string;
}

export const Logo: React.FC<LogoProps> = ({
  className = "w-8 h-8",
  size,
  showText = false,
  textClassName = "font-bold text-slate-800 text-sm tracking-tight",
}) => {
  const inlineStyle = size ? { width: size, height: size } : undefined;

  return (
    <div className="flex items-center gap-2 select-none">
      <div
        className={`relative flex items-center justify-center shrink-0 rounded-lg overflow-hidden transition-transform duration-200 hover:scale-105 active:scale-95 ${className}`}
        style={inlineStyle}
      >
        <svg
          viewBox="0 0 512 512"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-xs"
        >
          <defs>
            {/* Top facet iridescent glass gradient */}
            <linearGradient id="logo-top-prism" x1="10%" y1="20%" x2="90%" y2="80%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.95" />
              <stop offset="25%" stopColor="#818cf8" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#f472b6" stopOpacity="0.9" />
              <stop offset="75%" stopColor="#fb923c" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.95" />
            </linearGradient>

            {/* Deep crystal core reflections */}
            <linearGradient id="logo-dark-core" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0b1329" />
              <stop offset="35%" stopColor="#1e1b4b" />
              <stop offset="70%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>

            {/* Bottom wing rainbow refraction gradient */}
            <linearGradient id="logo-bottom-prism" x1="85%" y1="15%" x2="15%" y2="85%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.95" />
              <stop offset="30%" stopColor="#0284c7" stopOpacity="0.85" />
              <stop offset="55%" stopColor="#e11d48" stopOpacity="0.9" />
              <stop offset="75%" stopColor="#ea580c" stopOpacity="0.9" />
              <stop offset="90%" stopColor="#facc15" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.95" />
            </linearGradient>

            {/* Specular highlight gradients */}
            <linearGradient id="logo-specular" x1="0%" y1="0%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
            </linearGradient>

            <linearGradient id="logo-rainbow-edge" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff0055" />
              <stop offset="20%" stopColor="#ff9900" />
              <stop offset="40%" stopColor="#ffee00" />
              <stop offset="60%" stopColor="#00ffcc" />
              <stop offset="80%" stopColor="#0099ff" />
              <stop offset="100%" stopColor="#cc00ff" />
            </linearGradient>

            <filter id="logo-shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#020617" floodOpacity="0.25" />
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#0284c7" floodOpacity="0.2" />
            </filter>
          </defs>

          <g filter="url(#logo-shadow)">
            {/* TOP SECTION OF S-MONOGRAM */}
            {/* Top Block Dark Under-volume */}
            <path
              d="M272 40 L468 152 C486 162 488 186 470 200 L380 264 C350 286 312 284 278 266 L220 236 C190 220 152 222 126 242 L72 282 C56 294 36 288 32 268 L24 168 C22 150 36 134 54 124 L244 42 C252 38 264 38 272 40 Z"
              fill="url(#logo-dark-core)"
            />

            {/* Top Block Main Iridescent Surface */}
            <path
              d="M268 46 L460 154 C474 162 476 180 462 192 L384 250 C356 270 322 268 290 252 L234 224 C198 206 156 208 126 230 L80 264 C68 272 52 268 50 254 L44 172 C42 158 52 146 66 138 L240 50 C248 46 258 46 268 46 Z"
              fill="url(#logo-top-prism)"
              opacity="0.9"
            />

            {/* Top facet isometric ceiling (reflective light plane) */}
            <path
              d="M266 48 L458 154 L276 156 L72 136 L244 50 C252 46 260 46 266 48 Z"
              fill="url(#logo-specular)"
              opacity="0.75"
            />

            {/* Inner curve of top hook (rainbow refraction) */}
            <path
              d="M136 226 C168 202 210 200 248 218 L304 246 C336 262 366 264 394 242 L454 196 C434 212 404 222 376 218 L296 206 C250 200 206 214 174 244 Z"
              fill="url(#logo-rainbow-edge)"
              opacity="0.8"
            />

            {/* Specular rim highlight on top facet ridge */}
            <path
              d="M268 46 L460 154"
              stroke="#ffffff"
              strokeWidth="5"
              strokeLinecap="round"
              opacity="0.95"
            />
            <path
              d="M52 132 L268 46"
              stroke="#ffffff"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.9"
            />
            <path
              d="M276 156 L458 154"
              stroke="url(#logo-rainbow-edge)"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.85"
            />

            {/* BOTTOM SECTION OF S-MONOGRAM */}
            {/* Bottom Block Dark Under-volume */}
            <path
              d="M240 472 L44 360 C26 350 24 326 42 312 L132 248 C162 226 200 228 234 246 L292 276 C322 292 360 290 386 270 L440 230 C456 218 476 224 480 244 L488 344 C490 362 476 378 458 388 L268 470 C260 474 248 474 240 472 Z"
              fill="url(#logo-dark-core)"
            />

            {/* Bottom Block Main Iridescent Surface */}
            <path
              d="M244 466 L52 358 C38 350 36 332 50 320 L128 262 C156 242 190 244 222 260 L278 288 C314 306 356 304 386 282 L432 248 C444 240 460 244 462 258 L468 340 C470 354 460 366 446 374 L272 462 C264 466 254 466 244 466 Z"
              fill="url(#logo-bottom-prism)"
              opacity="0.92"
            />

            {/* Bottom facet isometric facet */}
            <path
              d="M246 464 L54 358 L236 356 L440 376 L268 462 C260 466 252 466 246 464 Z"
              fill="url(#logo-specular)"
              opacity="0.65"
            />

            {/* Inner curve of bottom hook (rainbow refraction) */}
            <path
              d="M376 286 C344 310 302 312 264 294 L208 266 C176 250 146 248 118 270 L58 316 C78 300 108 290 136 294 L216 306 C262 312 306 298 338 268 Z"
              fill="url(#logo-rainbow-edge)"
              opacity="0.8"
            />

            {/* Bottom bevel & rim specular highlights */}
            <path
              d="M244 466 L52 358"
              stroke="#ffffff"
              strokeWidth="5"
              strokeLinecap="round"
              opacity="0.95"
            />
            <path
              d="M460 380 L244 466"
              stroke="#ffffff"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.9"
            />
            <path
              d="M236 356 L54 358"
              stroke="url(#logo-rainbow-edge)"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.85"
            />

            {/* Central S-Loop Interlock Glass Refractions */}
            <path
              d="M128 240 Q180 200 240 230 Q300 260 360 250"
              stroke="#ffffff"
              strokeWidth="3.5"
              strokeLinecap="round"
              opacity="0.85"
            />
            <path
              d="M384 272 Q332 312 272 282 Q212 252 152 262"
              stroke="#ffffff"
              strokeWidth="3.5"
              strokeLinecap="round"
              opacity="0.85"
            />

            {/* Prism Glints / Sparkles at acute apex corners */}
            <circle cx="268" cy="46" r="4" fill="#ffffff" />
            <circle cx="460" cy="154" r="3.5" fill="#ffffff" />
            <circle cx="52" cy="132" r="3" fill="#ffffff" />
            <circle cx="244" cy="466" r="4" fill="#ffffff" />
            <circle cx="52" cy="358" r="3.5" fill="#ffffff" />
            <circle cx="460" cy="380" r="3" fill="#ffffff" />
          </g>
        </svg>
      </div>

      {showText && (
        <span className={textClassName}>
          Foundry
        </span>
      )}
    </div>
  );
};
