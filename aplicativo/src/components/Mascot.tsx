import React from "react";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from "react-native-svg";

/**
 * Contextual moods for the rocket mascot — picked by the screen/moment to make
 * the character react to what's actually happening (idle browsing, a goal just
 * landed, a level-up, an empty plan, or a streak about to lapse).
 */
export type MascotPose = "idle" | "happy" | "proud" | "sleepy" | "worried";

interface Props {
  pose?: MascotPose;
  size?: number;
}

const INK = "#1B2538";

function Sparkle({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <Path
      d="M0 -5 L1.4 -1.4 L5 0 L1.4 1.4 L0 5 L-1.4 1.4 L-5 0 L-1.4 -1.4 Z"
      fill="#FACC15"
      transform={`translate(${x} ${y}) scale(${scale})`}
    />
  );
}

function Face({ pose }: { pose: MascotPose }) {
  switch (pose) {
    case "happy":
      return (
        <G>
          <Path d="M37 41 Q41 36 45 41" stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none" />
          <Path d="M51 41 Q55 36 59 41" stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none" />
          <Path d="M40 47 Q48 56.5 56 47 Q48 53.5 40 47 Z" fill={INK} />
          <Ellipse cx="35" cy="46.5" rx="3.4" ry="2.4" fill="#FF8FA3" opacity={0.55} />
          <Ellipse cx="61" cy="46.5" rx="3.4" ry="2.4" fill="#FF8FA3" opacity={0.55} />
        </G>
      );
    case "proud":
      return (
        <G>
          <Path
            d="M35.5 38.5 H60.5 V41 Q60.5 44.5 56 44.5 H50.5 Q48 44.5 48 42 Q48 44.5 45.5 44.5 H40 Q35.5 44.5 35.5 41 Z"
            fill={INK}
          />
          <Circle cx="42" cy="41" r="1.1" fill="#7DD3FC" opacity={0.85} />
          <Circle cx="54" cy="41" r="1.1" fill="#7DD3FC" opacity={0.85} />
          <Path d="M43 49 Q49 53.5 55.5 48.5" stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none" />
        </G>
      );
    case "sleepy":
      return (
        <G>
          <Path d="M37 41 Q41 42.6 45 41" stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none" />
          <Path d="M51 41 Q55 42.6 59 41" stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none" />
          <Ellipse cx="48" cy="50" rx="3" ry="2.2" fill={INK} />
        </G>
      );
    case "worried":
      return (
        <G>
          <Circle cx="41" cy="41.5" r="3.4" fill={INK} />
          <Circle cx="55" cy="41.5" r="3.4" fill={INK} />
          <Circle cx="39.9" cy="40.3" r="1" fill="#fff" opacity={0.85} />
          <Circle cx="53.9" cy="40.3" r="1" fill="#fff" opacity={0.85} />
          <Path d="M36.5 36.5 L42 38.7" stroke={INK} strokeWidth={2} strokeLinecap="round" />
          <Path d="M59.5 36.5 L54 38.7" stroke={INK} strokeWidth={2} strokeLinecap="round" />
          <Path
            d="M42.5 51 Q45.5 47.5 48 50 Q50.5 52.5 53.5 49.5"
            stroke={INK}
            strokeWidth={2.2}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      );
    case "idle":
    default:
      return (
        <G>
          <Circle cx="41" cy="40" r="3.6" fill={INK} />
          <Circle cx="55" cy="40" r="3.6" fill={INK} />
          <Circle cx="39.8" cy="38.8" r="1.1" fill="#fff" opacity={0.85} />
          <Circle cx="53.8" cy="38.8" r="1.1" fill="#fff" opacity={0.85} />
          <Path d="M42 48 Q48 52.5 54 48" stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none" />
        </G>
      );
  }
}

function Accessory({ pose }: { pose: MascotPose }) {
  switch (pose) {
    case "happy":
      return (
        <G opacity={0.9}>
          <Sparkle x={71} y={17} scale={0.95} />
          <Sparkle x={19} y={29} scale={0.6} />
        </G>
      );
    case "proud":
      return (
        <G opacity={0.9}>
          <Sparkle x={70} y={14} scale={1.05} />
          <Sparkle x={22} y={24} scale={0.55} />
        </G>
      );
    case "sleepy":
      return (
        <G opacity={0.8} fill="none" stroke="#64748B" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M69 25 L77 20 L69 20 L77 15" />
          <Path d="M62 34.5 L68 31 L62 31 L68 27.5" strokeWidth={1.5} opacity={0.8} />
        </G>
      );
    case "worried":
      return <Path d="M67 29 Q70.5 34.5 67 39 Q63.5 34.5 67 29 Z" fill="#7DD3FC" opacity={0.85} />;
    case "idle":
    default:
      return null;
  }
}

/** Illustrated rocket character — the app's mascot, with moods that mirror the user's current moment. */
export default function Mascot({ pose = "idle", size = 72 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Defs>
        <LinearGradient id="mascotBody" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#E2E8F0" />
        </LinearGradient>
        <LinearGradient id="mascotFlame" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FF2A4D" />
          <Stop offset="0.5" stopColor="#F59E0B" />
          <Stop offset="1" stopColor="#FFEB8A" />
        </LinearGradient>
      </Defs>

      {pose === "sleepy" ? (
        <Ellipse cx="48" cy="81" rx="17" ry="3.4" fill="#0B1220" opacity={0.16} />
      ) : (
        <Path d="M40 76 Q48 92 56 76 Q52 84 48 88 Q44 84 40 76 Z" fill="url(#mascotFlame)" />
      )}

      <Path d="M48 8 C58 20 64 36 64 50 L64 66 L32 66 L32 50 C32 36 38 20 48 8 Z" fill="url(#mascotBody)" />
      <Path d="M32 50 L20 70 L32 66 Z" fill="#FF2A4D" />
      <Path d="M64 50 L76 70 L64 66 Z" fill="#FF2A4D" />
      <Path d="M32 60 L64 60 L64 66 L32 66 Z" fill="#3B69FF" opacity={0.85} />

      <Face pose={pose} />
      <Accessory pose={pose} />
    </Svg>
  );
}
