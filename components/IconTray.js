// components/IconTray.js — Content-sized action tray for floating tray headers.
// All action chips stay visible in one row inside this tray. The parent Tray
// places it below the floating title chip and aligns it right; the tray sizes
// itself to the combined width of its icons, so it never stretches across the
// card or needs scrolling, arrows, or an overflow menu.
//
//   <IconTray
//     actions={[
//       { icon: 'upload', label: 'Upload', onPress: ... },
//       { icon: 'print',  label: 'Print All', onPress: ... },
//       ...
//     ]}
//   />

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Button from './Button';

export default function IconTray({ actions = [], style }) {
  if (!Array.isArray(actions) || actions.length === 0) return null;

  return (
    <View style={[styles.tray, style]}>
      {actions.map((action) => (
        <Button
          key={action.key || action.label}
          size="xs"
          variant="tint"
          iconOnly
          icon={action.icon}
          onPress={action.onPress}
          accessibilityLabel={action.label}
          style={styles.action}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Content-sized, non-wrapping row: every action is visible at once while
  // the parent aligns this compact tray to the right.
  tray: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 2,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 3,
    paddingVertical: 2,
  },
  action: { flexShrink: 0 },
});
