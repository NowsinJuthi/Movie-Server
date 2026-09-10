import styles from "./auth-shell.module.css";

const orbits = [
  { r: 78, dots: 5, dur: "18s" },
  { r: 112, dots: 7, dur: "26s" },
  { r: 148, dots: 9, dur: "34s" },
];

/** Cinema-themed graphic inspired by Log-Server's login shield art. */
export function AuthGraphic({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 400 500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="cvAuthScanGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--auth-accent-soft)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--auth-accent-soft)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--auth-accent-soft)" stopOpacity="0" />
        </linearGradient>
        <clipPath id="cvAuthShieldClip">
          <path d="M200 168 L262 198 L262 276 C262 328 230 364 200 388 C170 364 138 328 138 276 L138 198 Z" />
        </clipPath>
      </defs>

      <g className={styles.ringSlow}>
        <circle cx="200" cy="255" r="78" stroke="var(--auth-accent-deep)" strokeWidth="0.6" opacity="0.35" />
        <circle
          cx="200"
          cy="255"
          r="78"
          stroke="var(--auth-accent)"
          strokeWidth="1.1"
          strokeDasharray="6 14"
          opacity="0.7"
        />
      </g>
      <g className={styles.ringMid}>
        <circle
          cx="200"
          cy="255"
          r="112"
          stroke="var(--auth-accent)"
          strokeWidth="0.8"
          strokeDasharray="2 10"
          opacity="0.45"
        />
      </g>
      <g className={styles.ringFast}>
        <circle
          cx="200"
          cy="255"
          r="148"
          stroke="var(--auth-accent-soft)"
          strokeWidth="0.7"
          strokeDasharray="18 22"
          opacity="0.35"
        />
      </g>

      {orbits.map((orbit) =>
        Array.from({ length: orbit.dots }).map((_, index) => (
          <g
            key={`${orbit.r}-${index}`}
            className={styles.orbitDot}
            style={{
              animationDuration: orbit.dur,
              animationDelay: `${(-index * parseFloat(orbit.dur)) / orbit.dots}s`,
            }}
          >
            <circle
              cx={200 + orbit.r}
              cy="255"
              r={index % 3 === 0 ? 2.4 : 1.5}
              fill="var(--auth-accent-soft)"
              opacity="0.85"
            />
          </g>
        )),
      )}

      <g className={styles.satellite}>
        <g transform="translate(68 92)">
          <circle r="16" stroke="var(--auth-accent)" strokeWidth="1" opacity="0.55" />
          <circle r="7" stroke="var(--auth-accent-soft)" strokeWidth="1.1" />
          <circle r="2.2" fill="var(--auth-accent-soft)" />
        </g>
      </g>
      <g className={styles.satelliteRev}>
        <g transform="translate(332 118)">
          <circle r="14" stroke="var(--auth-accent)" strokeWidth="1" opacity="0.5" />
          <circle r="6" stroke="var(--auth-accent-soft)" strokeWidth="1.1" />
          <circle r="2" fill="var(--auth-accent-soft)" />
        </g>
      </g>
      <g className={styles.satellite} style={{ animationDuration: "22s" }}>
        <g transform="translate(86 408)">
          <circle r="13" stroke="var(--auth-accent)" strokeWidth="1" opacity="0.5" />
          <circle r="5.5" stroke="var(--auth-accent-soft)" strokeWidth="1" />
          <circle r="1.8" fill="var(--auth-accent-soft)" />
        </g>
      </g>

      <g className={styles.emblem}>
        <path
          className={styles.shieldStroke}
          d="M200 168 L262 198 L262 276 C262 328 230 364 200 388 C170 364 138 328 138 276 L138 198 Z"
          stroke="var(--auth-accent-soft)"
          strokeWidth="2.4"
          pathLength="1"
        />
        <path
          d="M200 182 L248 206 L248 272 C248 314 224 344 200 364 C176 344 152 314 152 272 L152 206 Z"
          stroke="var(--auth-accent)"
          strokeWidth="0.8"
          opacity="0.4"
        />
        <g clipPath="url(#cvAuthShieldClip)">
          <rect className={styles.scan} x="130" y="160" width="140" height="28" fill="url(#cvAuthScanGrad)" />
        </g>
        {/* Play triangle instead of padlock — media brand */}
        <g className={styles.padlock}>
          <path
            d="M186 236 L186 290 L236 263 Z"
            stroke="var(--auth-accent-soft)"
            strokeWidth="2.8"
            strokeLinejoin="round"
            fill="none"
          />
          <path d="M192 246 L192 280 L224 263 Z" fill="var(--auth-accent)" opacity="0.85" />
        </g>
      </g>
    </svg>
  );
}
