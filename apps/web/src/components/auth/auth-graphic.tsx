import styles from "./auth-shell.module.css";

const orbits = [
  { r: 78, dots: 5, dur: "18s" },
  { r: 112, dots: 7, dur: "26s" },
  { r: 148, dots: 9, dur: "34s" },
];

/** Circles + emblem share this focal point so the shield sits dead-center. */
const CX = 200;
const CY = 255;

/** Cinema-themed graphic inspired by Log-Server's login shield art. */
export function AuthGraphic({ className }: { className?: string }) {
  // Same shield as before — only the bottom tip (red-marked round) becomes a sharp V like the inner tip.
  const shieldTop = CY - 110; // 145
  const shieldTip = CY + 110; // 365
  // Top + sides unchanged; bottom uses straight lines instead of round curves.
  const outer = `M${CX} ${shieldTop} L262 ${shieldTop + 30} L262 ${CY + 21} L${CX} ${shieldTip} L138 ${CY + 21} L138 ${shieldTop + 30} Z`;
  const inner = `M${CX} ${shieldTop + 14} L248 ${shieldTop + 38} L248 ${CY + 17} L${CX} ${shieldTip - 20} L152 ${CY + 17} L152 ${shieldTop + 38} Z`;

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
          <path d={outer} />
        </clipPath>
        {/* Hide orbit strokes over the tip so the sharp V is visible (not a round arc). */}
        <clipPath id="cvAuthOrbitTipGap" clipRule="evenodd">
          <path
            fillRule="evenodd"
            d={`M0 0H400V500H0Z M${CX} ${CY + 48} L${CX - 78} ${shieldTip + 28} L${CX + 78} ${shieldTip + 28}Z`}
          />
        </clipPath>
      </defs>

      <g clipPath="url(#cvAuthOrbitTipGap)">
      <g className={styles.ringSlow}>
        <circle cx={CX} cy={CY} r="78" stroke="var(--auth-accent-deep)" strokeWidth="0.6" opacity="0.35" />
        <circle
          cx={CX}
          cy={CY}
          r="78"
          stroke="var(--auth-accent)"
          strokeWidth="1.1"
          strokeDasharray="6 14"
          opacity="0.7"
        />
      </g>
      <g className={styles.ringMid}>
        <circle
          cx={CX}
          cy={CY}
          r="112"
          stroke="var(--auth-accent)"
          strokeWidth="0.8"
          strokeDasharray="2 10"
          opacity="0.45"
        />
      </g>
      <g className={styles.ringFast}>
        <circle
          cx={CX}
          cy={CY}
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
              cx={CX + orbit.r}
              cy={CY}
              r={index % 3 === 0 ? 2.4 : 1.5}
              fill="var(--auth-accent-soft)"
              opacity="0.85"
            />
          </g>
        )),
      )}
      </g>

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
          d={outer}
          stroke="var(--auth-accent-soft)"
          strokeWidth="2.4"
          strokeLinejoin="miter"
          strokeMiterlimit="10"
          pathLength="1"
        />
        <path
          d={inner}
          stroke="var(--auth-accent)"
          strokeWidth="1.2"
          strokeLinejoin="miter"
          opacity="0.55"
        />
        <g clipPath="url(#cvAuthShieldClip)">
          <rect
            className={styles.scan}
            x="130"
            y={shieldTop - 8}
            width="140"
            height="28"
            fill="url(#cvAuthScanGrad)"
          />
        </g>

        {/* Play emblem — draw-in, pulse, and ripple rings */}
        <g className={styles.playEmblem} transform={`translate(${CX} ${CY})`}>
          <circle className={styles.playRipple} r="34" />
          <circle className={styles.playRipple} r="34" style={{ animationDelay: "1.1s" }} />
          <circle className={styles.playHalo} r="28" />
          <g className={styles.playCore}>
            <path
              className={styles.playStroke}
              d="M-25 -26 L-25 26 L25 0 Z"
              strokeLinejoin="round"
              pathLength="1"
            />
            <path className={styles.playFill} d="M-17 -16 L-17 16 L15 0 Z" />
          </g>
        </g>
      </g>
    </svg>
  );
}
