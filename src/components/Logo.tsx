interface LogoProps {
  className?: string;
  size?: number;
}

export default function Logo({ className = "w-8 h-8", size = 32 }: LogoProps) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 64 64" 
      width={size} 
      height={size}
      className={className}
      role="img"
      aria-label="Uma palavra logo"
    >
      <defs>
        <linearGradient id="logoBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#24242c" />
          <stop offset="100%" stopColor="#141418" />
        </linearGradient>
        <linearGradient id="logoYellowGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FCFD76" />
          <stop offset="100%" stopColor="#eef05a" />
        </linearGradient>
        <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Base Squircle Tile */}
      <rect 
        x="2" 
        y="2" 
        width="60" 
        height="60" 
        rx="15" 
        fill="url(#logoBgGrad)" 
        stroke="#33333c" 
        strokeWidth="2" 
      />

      {/* RSVP Reticle Focus Guides (Top & Bottom Center Notches in Highlighter Yellow) */}
      <line x1="32" y1="9" x2="32" y2="15" stroke="#FCFD76" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="32" y1="49" x2="32" y2="55" stroke="#FCFD76" strokeWidth="2.5" strokeLinecap="round" />

      {/* Horizontal Sight Lines (Subtle Reading Frame) */}
      <line x1="12" y1="32" x2="21" y2="32" stroke="#454552" strokeWidth="2" strokeLinecap="round" />
      <line x1="43" y1="32" x2="52" y2="32" stroke="#454552" strokeWidth="2" strokeLinecap="round" />

      {/* Central Letter "U" (Uma) */}
      <path 
        d="M 23 23 L 23 35 C 23 40 27 42 32 42 C 37 42 41 40 41 35 L 41 23" 
        fill="none" 
        stroke="#e8e8ec" 
        strokeWidth="4.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />

      {/* High-contrast RSVP Optimal Recognition Point (ORP) Glowing Center Accent */}
      <circle cx="32" cy="32" r="3.5" fill="url(#logoYellowGlow)" filter="url(#logoGlow)" />
    </svg>
  );
}
