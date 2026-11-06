import React from 'react';
import Svg, {
  Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop,
} from 'react-native-svg';

export function CanvasMenuIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 128 128">
      <Defs>
        <LinearGradient id="canvasPaper" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#FFF2D8" />
        </LinearGradient>
        <LinearGradient id="drawingPencil" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#F8B642" />
          <Stop offset="0.5" stopColor="#FFE18A" />
          <Stop offset="1" stopColor="#E99430" />
        </LinearGradient>
      </Defs>
      <Ellipse cx="65" cy="120" rx="44" ry="5" fill="#23164F" opacity="0.18" />
      <G transform="rotate(-7 64 64)">
        <Rect x="27" y="20" width="79" height="94" rx="3" fill="#25164F" opacity="0.18" />
        <Rect x="23" y="17" width="79" height="94" rx="3" fill="#E8DAC6" stroke="#D9C9B3" />
        <Path d="M24 12H87L102 27V105Q102 108 99 108H24Q21 108 21 105V15Q21 12 24 12Z"
          fill="url(#canvasPaper)" stroke="#D6C5AC" strokeWidth="1.5" />
        <Path d="M87 12V25Q87 28 90 28H102" fill="#EEDBB8" stroke="#D6C5AC" strokeWidth="1.2" />
        <Path d="M26 18V101" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
        {/* Two little comic panels: a waving stickman, then a running pose. */}
        <Rect x="30" y="32" width="62" height="29" rx="2" fill="#DCF4F4" stroke="#465268" strokeWidth="1.5" />
        <Rect x="30" y="65" width="62" height="32" rx="2" fill="#F0E5FF" stroke="#465268" strokeWidth="1.5" />
        <G stroke="#364152" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <Circle cx="44" cy="42" r="5.5" fill="#FFFFFF" />
          <Path d="M44 48V54M44 50L38 48M44 50L50 45L51 41M44 54L39 59M44 54L49 59" />
          <Path d="M42 43Q44 45 46 43" strokeWidth="1" />
          <Path d="M60 37H82V48H68L63 52V48H60Z" fill="#FFFFFF" strokeWidth="1.2" />
          <Circle cx="72" cy="76" r="6" fill="#FFFFFF" />
          <Path d="M71 82L68 88M70 84L63 81L59 84M70 84L78 85L82 80M68 88L76 91L81 89M68 88L64 94L58 94" />
          <Path d="M71 77Q73 79 75 77" strokeWidth="1" />
          <Path d="M38 73H51M41 78H54M37 83H49" stroke="#A58CE9" strokeWidth="2" />
        </G>
        <Circle cx="68" cy="42" r="1" fill="#465268" />
        <Circle cx="72" cy="42" r="1" fill="#465268" />
        <Circle cx="76" cy="42" r="1" fill="#465268" />
      </G>
      <G transform="translate(104 9) rotate(38)">
        <Rect x="-6" y="4" width="14" height="70" rx="3" fill="#3C2352" opacity="0.16" />
        <Rect x="-7" y="0" width="14" height="13" rx="4" fill="#F58DA8" stroke="#C56585" strokeWidth="1" />
        <Path d="M-7 12H7V72H-7Z" fill="url(#drawingPencil)" stroke="#D99A3B" strokeWidth="1" />
        <Path d="M-3 22V68" stroke="#FFF1BB" strokeWidth="2" strokeLinecap="round" />
        <Path d="M-7 12H7V20H-7Z" fill="#C5D3DF" />
        <Path d="M-7 15H7M-7 18H7" stroke="#EFF5F9" strokeWidth="1" />
        <Path d="M-7 72L0 89L7 72Z" fill="#EFCB93" stroke="#C79C67" strokeWidth="0.8" />
        <Path d="M-2.5 83L0 89L2.5 83Z" fill="#465268" />
      </G>
    </Svg>
  );
}

export function LibraryMenuIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 128 128">
      <Ellipse cx="65" cy="121" rx="46" ry="4" fill="#23164F" opacity="0.16" />
      {/* A raised lid and the dark opening make this a manuscript archive box. */}
      <Path d="M37 19L106 29L115 63L44 53Z" fill="#F3D2A0" stroke="#B88755" strokeWidth="1.5" strokeLinejoin="round" />
      <Path d="M44 27L101 35L107 55L49 47Z" fill="#E7BE87" />
      <Path d="M44 53L115 63L88 83L15 73Z" fill="#967054" stroke="#A5764D" strokeWidth="1.2" strokeLinejoin="round" />
      <Path d="M44 53L115 63L110 68L40 58Z" fill="#C79664" />
      {/* Loose comic pages project above the open box. */}
      <G transform="rotate(9 79 62)">
        <Rect x="62" y="34" width="32" height="59" rx="2.5" fill="#E6DBF8" stroke="#B6A3CC" strokeWidth="1.2" />
        <Path d="M69 44H87M69 50H87M69 56H82" stroke="#B6A3CC" strokeWidth="1.5" strokeLinecap="round" />
      </G>
      <G transform="rotate(-8 54 61)">
        <Rect x="33" y="26" width="44" height="68" rx="2.5" fill="#FFFCF2" stroke="#D4C5AC" strokeWidth="1.3" />
        <Rect x="39" y="33" width="18" height="3" rx="1.5" fill="#77CDBB" />
        <Rect x="39" y="41" width="32" height="23" rx="1" fill="#E3F5F1" stroke="#657372" strokeWidth="1.1" />
        <Circle cx="49" cy="48" r="3.5" fill="#FFFFFF" stroke="#465268" strokeWidth="1.2" />
        <Path d="M49 52V57M49 54L44 52M49 54L54 51M49 57L45 61M49 57L53 61" fill="none" stroke="#465268" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M57 45H66V51H62L59 54V51H57Z" fill="#FFFFFF" stroke="#657372" strokeWidth="0.8" strokeLinejoin="round" />
        <Rect x="39" y="69" width="32" height="16" rx="1" fill="#F1E9FB" stroke="#657372" strokeWidth="1.1" />
        <Path d="M44 75H63M44 79H57" stroke="#B4A0CE" strokeWidth="1.5" strokeLinecap="round" />
      </G>
      {/* Simple front and side faces preserve the three-quarter perspective. */}
      <Path d="M88 83L115 63V100L88 118Z" fill="#BC8D60" stroke="#A5764D" strokeWidth="1.5" strokeLinejoin="round" />
      <Path d="M15 73L88 83V118L15 108Z" fill="#E9BF87" stroke="#B88755" strokeWidth="1.5" strokeLinejoin="round" />
      <Path d="M19 77L84 86" stroke="#FFE3B9" strokeWidth="2" strokeLinecap="round" />
      <Path d="M39 88L65 92V103L39 99Z" fill="#FFF3D9" stroke="#B88755" strokeWidth="1" strokeLinejoin="round" />
      <Path d="M45 94L59 96" stroke="#AE8057" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}
