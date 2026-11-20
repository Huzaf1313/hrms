import React from "react";

export const WorkstationIllustration: React.FC<{ className?: string }> = ({
  className = "w-full h-auto max-h-[340px]",
}) => {
  return (
    <svg
      viewBox="0 0 500 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Workforce Management Illustration"
    >
      <defs>
        {/* Gradients */}
        <linearGradient id="charSkin" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffd8c2" />
          <stop offset="100%" stopColor="#f3b497" />
        </linearGradient>

        <linearGradient id="charSweater" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>

        <linearGradient id="charPants" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>

        <linearGradient id="charHair" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8c5836" />
          <stop offset="100%" stopColor="#5c351b" />
        </linearGradient>

        <linearGradient id="laptopLid" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff7824" />
          <stop offset="100%" stopColor="#e65100" />
        </linearGradient>

        <linearGradient id="deskGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="50%" stopColor="#334155" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>

        <linearGradient id="monitorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>

        <linearGradient id="plantPot" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>

        <linearGradient id="leafGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>

        {/* Soft Drop Shadows */}
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodOpacity="0.25" floodColor="#09122c" />
        </filter>

        <filter id="deskGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" floodOpacity="0.3" floodColor="#000000" />
        </filter>
      </defs>

      {/* Background Soft Aura */}
      <circle cx="250" cy="240" r="160" fill="url(#monitorGrad)" opacity="0.12" />

      {/* Sparkles / Ambient Stars */}
      <g opacity="0.8">
        <path d="M115 190 Q120 195 125 190 Q120 185 115 190" fill="#fef08a" />
        <path d="M120 185 Q120 190 125 190 Q120 190 120 195 Q120 190 115 190 Q120 190 120 185" fill="#fef08a" />
        
        <path d="M395 180 Q398 183 401 180 Q398 177 395 180" fill="#fef08a" />
        <circle cx="410" cy="195" r="2.5" fill="#ffffff" opacity="0.7" />
        <circle cx="100" cy="210" r="2" fill="#ffffff" opacity="0.6" />
      </g>

      {/* ============================================================== */}
      {/* 1. Office Swivel Chair Behind Character                        */}
      {/* ============================================================== */}
      <g id="chair">
        {/* Chair Backrest */}
        <rect
          x="215"
          y="180"
          width="70"
          height="80"
          rx="18"
          fill="#1e293b"
          opacity="0.95"
          filter="url(#softShadow)"
        />
        {/* Chair Seat */}
        <path
          d="M200 255 C200 250, 300 250, 300 255 L295 272 C295 276, 205 276, 205 272 Z"
          fill="#0f172a"
        />
        {/* Central Base Post */}
        <rect x="245" y="272" width="10" height="40" rx="3" fill="#64748b" />
        {/* Wheeled Legs */}
        <path d="M210 310 L250 305 L290 310" stroke="#475569" strokeWidth="6" strokeLinecap="round" />
        <circle cx="210" cy="312" r="4" fill="#334155" />
        <circle cx="250" cy="308" r="4" fill="#334155" />
        <circle cx="290" cy="312" r="4" fill="#334155" />
      </g>

      {/* ============================================================== */}
      {/* 2. Character Body & Head                                       */}
      {/* ============================================================== */}
      <g id="character" filter="url(#softShadow)">
        {/* Legs in Blue Pants */}
        <g id="legs">
          {/* Left Leg */}
          <path
            d="M225 260 L205 295 L180 300"
            stroke="url(#charPants)"
            strokeWidth="24"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Left Shoe */}
          <ellipse cx="172" cy="302" rx="14" ry="9" fill="#ffffff" />
          <path d="M164 300 L180 300" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" />

          {/* Right Leg */}
          <path
            d="M275 260 L295 295 L320 300"
            stroke="url(#charPants)"
            strokeWidth="24"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Right Shoe */}
          <ellipse cx="328" cy="302" rx="14" ry="9" fill="#ffffff" />
          <path d="M320 300 L336 300" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" />
        </g>

        {/* Torso / White 3D Sweater */}
        <path
          d="M218 190 Q250 185 282 190 L290 262 Q250 268 210 262 Z"
          fill="url(#charSweater)"
        />
        {/* Sweater Collar */}
        <ellipse cx="250" cy="190" rx="18" ry="7" fill="#e2e8f0" />

        {/* Left Arm (Relaxed toward desk/laptop) */}
        <path
          d="M216 195 Q195 215 205 238 L235 238"
          stroke="url(#charSweater)"
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Left Hand */}
        <circle cx="240" cy="238" r="8" fill="url(#charSkin)" />

        {/* Right Arm (Waving up with cheer!) */}
        <path
          d="M284 195 Q310 180 325 150 L332 125"
          stroke="url(#charSweater)"
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Right Hand Waving / Peace Gesture */}
        <g transform="translate(330, 110)">
          {/* Palm */}
          <ellipse cx="6" cy="15" rx="8" ry="9" fill="url(#charSkin)" />
          {/* Two Peace / Wave Fingers */}
          <rect x="0" y="2" width="4.5" height="13" rx="2" fill="url(#charSkin)" transform="rotate(-10 2 8)" />
          <rect x="7" y="0" width="4.5" height="15" rx="2" fill="url(#charSkin)" transform="rotate(10 9 8)" />
          {/* Thumb */}
          <ellipse cx="14" cy="16" rx="4" ry="5" fill="url(#charSkin)" />
        </g>

        {/* Neck */}
        <rect x="242" y="174" width="16" height="18" rx="7" fill="url(#charSkin)" />

        {/* Head */}
        <ellipse cx="250" cy="155" rx="26" ry="28" fill="url(#charSkin)" />

        {/* Hair / Stylish Beanie Cap */}
        <path
          d="M224 150 C224 125, 276 125, 276 150 C276 155, 274 158, 270 158 C266 148, 234 148, 230 158 C226 158, 224 155, 224 150 Z"
          fill="url(#charHair)"
        />
        {/* Top knot/pom */}
        <ellipse cx="250" cy="126" rx="10" ry="8" fill="url(#charHair)" />

        {/* Round Glasses */}
        <g stroke="#1e293b" strokeWidth="2.5" fill="none">
          <circle cx="240" cy="156" r="7.5" fill="#ffffff" fillOpacity="0.25" />
          <circle cx="260" cy="156" r="7.5" fill="#ffffff" fillOpacity="0.25" />
          <line x1="247.5" y1="156" x2="252.5" y2="156" />
        </g>

        {/* Eyes & Friendly Smile */}
        <circle cx="240" cy="156" r="2.5" fill="#0f172a" />
        <circle cx="260" cy="156" r="2.5" fill="#0f172a" />
        {/* Rosy Cheeks */}
        <ellipse cx="233" cy="163" rx="4.5" ry="2.5" fill="#f43f5e" opacity="0.3" />
        <ellipse cx="267" cy="163" rx="4.5" ry="2.5" fill="#f43f5e" opacity="0.3" />
        {/* Cheerful Smile */}
        <path d="M244 167 Q250 173 256 167" stroke="#991b1b" strokeWidth="2" strokeLinecap="round" fill="none" />
      </g>

      {/* ============================================================== */}
      {/* 3. Modern Office Desk                                         */}
      {/* ============================================================== */}
      <g id="desk" filter="url(#deskGlow)">
        {/* Main Desktop Surface */}
        <rect
          x="120"
          y="238"
          width="260"
          height="12"
          rx="5"
          fill="url(#deskGrad)"
        />
        <rect
          x="125"
          y="247"
          width="250"
          height="4"
          fill="#0f172a"
          opacity="0.6"
        />

        {/* Left Leg */}
        <rect x="145" y="250" width="8" height="60" rx="3" fill="#1e293b" />
        <rect x="135" y="306" width="28" height="6" rx="2" fill="#0f172a" />

        {/* Right Leg */}
        <rect x="345" y="250" width="8" height="60" rx="3" fill="#1e293b" />
        <rect x="335" y="306" width="28" height="6" rx="2" fill="#0f172a" />
      </g>

      {/* ============================================================== */}
      {/* 4. Equipment on Desk (Monitor, Keyboard, Laptop)               */}
      {/* ============================================================== */}
      <g id="equipment">
        {/* Desktop Monitor on Left */}
        <g id="monitor" filter="url(#softShadow)">
          {/* Monitor Stand */}
          <rect x="175" y="200" width="6" height="40" rx="2" fill="#94a3b8" />
          <ellipse cx="178" cy="240" rx="16" ry="3.5" fill="#64748b" />

          {/* Monitor Screen Body (Back view angled) */}
          <rect
            x="135"
            y="170"
            width="82"
            height="55"
            rx="6"
            fill="url(#monitorGrad)"
            stroke="#334155"
            strokeWidth="2"
          />
          {/* Apple/Display Logo Badge */}
          <circle cx="176" cy="197" r="4.5" fill="#64748b" opacity="0.6" />
          <rect x="160" y="218" width="32" height="2" rx="1" fill="#38bdf8" opacity="0.7" />
        </g>

        {/* Laptop on Right (Coral/Orange Back matching PeopleSync) */}
        <g id="laptop" filter="url(#softShadow)" transform="translate(290, 185)">
          {/* Laptop Lid (Vibrant Orange Accent) */}
          <path
            d="M10 12 L44 0 L48 36 L12 44 Z"
            fill="url(#laptopLid)"
            stroke="#ea580c"
            strokeWidth="1.5"
          />
          {/* PeopleSync infinity badge on laptop */}
          <ellipse cx="29" cy="22" rx="4" ry="2.5" fill="#ffffff" opacity="0.9" transform="rotate(-15 29 22)" />
          {/* Laptop Base on Desk */}
          <polygon points="4,45 42,37 54,49 14,54" fill="#94a3b8" />
        </g>

        {/* Sleek Keyboard in Front of Monitor */}
        <rect
          x="195"
          y="240"
          width="45"
          height="5"
          rx="1.5"
          fill="#cbd5e1"
          opacity="0.8"
        />
      </g>

      {/* ============================================================== */}
      {/* 5. Cute Potted Plant on Floor                                  */}
      {/* ============================================================== */}
      <g id="plant" filter="url(#softShadow)" transform="translate(100, 275)">
        {/* Pot */}
        <path
          d="M10 20 L8 38 Q8 42 16 42 Q24 42 24 38 L22 20 Z"
          fill="url(#plantPot)"
        />
        <ellipse cx="16" cy="20" rx="6.5" ry="2.5" fill="#047857" />

        {/* Leaves */}
        <path
          d="M16 20 Q12 12 15 4 Q20 12 16 20 Z"
          fill="url(#leafGrad)"
        />
        <path
          d="M15 18 Q8 14 6 8 Q14 12 15 18 Z"
          fill="url(#leafGrad)"
        />
        <path
          d="M17 18 Q24 14 26 8 Q18 12 17 18 Z"
          fill="url(#leafGrad)"
        />
      </g>
    </svg>
  );
};
