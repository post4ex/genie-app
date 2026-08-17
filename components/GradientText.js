// components/GradientText.js — gradient-filled text for futuristic headings.
// Paints a LinearGradient through a MaskedView shaped by the text glyphs.
//
//   <GradientText colors={['#9C2007', '#f59e0b']} style={styles.title}>Welcome Back</GradientText>
//
// Note: `style` is applied to the visible Text — include font size/weight there.
// textShadow* props work on the mask layer too (pass them via the style).

import React from 'react';
import { Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';

export default function GradientText({ colors, start, end, style, children, ...rest }) {
  return (
    // androidRenderingMode="software": RNCMaskedView defaults to a HARDWARE
    // layer, which cannot be drawn into the software canvas react-native-view-shot
    // uses — captures of any view containing gradient text would fail with
    // "Failed to capture view snapshot" on Android.
    <MaskedView androidRenderingMode="software" maskElement={<Text style={style} {...rest}>{children}</Text>}>
      <LinearGradient
        colors={colors}
        start={start || { x: 0, y: 0 }}
        end={end || { x: 1, y: 1 }}
      >
        {/* Invisible twin gives the gradient its size */}
        <Text style={[style, { opacity: 0 }]} {...rest}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}
