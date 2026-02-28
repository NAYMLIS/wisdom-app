import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '../themes/ThemeContext';

const BreathingCircle: React.FC<{ paceSeconds?: number }> = ({ paceSeconds = 6 }) => {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.18, { duration: paceSeconds * 1000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [paceSeconds]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.container}>
      <View style={[styles.outerRing, { borderColor: theme.colors.secondary }]} />
      <View style={[styles.innerRing, { borderColor: theme.colors.primary }]} />
      <Animated.View
        style={[
          styles.circle,
          {
            borderColor: theme.colors.primary,
            backgroundColor: 'rgba(184,150,62,0.1)',
            shadowColor: theme.colors.primary,
          },
          animatedStyle,
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 210,
    height: 210,
  },
  outerRing: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 999,
    borderWidth: 1,
    opacity: 0.25,
  },
  innerRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 999,
    borderWidth: 1,
    opacity: 0.35,
  },
  circle: {
    width: 160,
    height: 160,
    borderRadius: 999,
    borderWidth: 2,
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
  },
});

export default BreathingCircle;
