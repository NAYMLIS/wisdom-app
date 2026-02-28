import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme } from '../themes/ThemeContext';

interface BreathingGuideTextProps {
  isActive: boolean;
  breathPace?: number; // seconds per breath cycle (default 6)
}

const BREATHING_CYCLE = [
  { text: 'Breathe in...', duration: 4 },
  { text: 'Hold...', duration: 4 },
  { text: 'Breathe out...', duration: 6 },
  { text: '', duration: 2 }, // silent hold
];

const BreathingGuideText = ({ isActive, breathPace = 6 }: BreathingGuideTextProps) => {
  const { theme } = useTheme();
  const [currentPhase, setCurrentPhase] = useState(0);
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (!isActive) {
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      return;
    }

    const cycle = BREATHING_CYCLE;
    let currentIndex = 0;

    const animatePhase = () => {
      const phase = cycle[currentIndex];

      // Fade and scale in
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: phase.text ? 0.9 : 0.3,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: phase.text ? 1 : 0.9,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();

      // Wait for phase duration, then next
      const timeout = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacityAnim, {
            toValue: 0.3,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.9,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          currentIndex = (currentIndex + 1) % cycle.length;
          setCurrentPhase(currentIndex);
          animatePhase();
        });
      }, phase.duration * 1000);

      return () => clearTimeout(timeout);
    };

    animatePhase();
  }, [isActive, opacityAnim, scaleAnim]);

  const displayText = BREATHING_CYCLE[currentPhase].text;

  if (!isActive) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View
        style={[
          styles.textWrapper,
          {
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Text style={[styles.text, { color: theme.colors.primary }]}>
          {displayText}
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  textWrapper: {
    alignItems: 'center',
  },
  text: {
    fontSize: 48,
    fontWeight: '300',
    letterSpacing: 1,
    textAlign: 'center',
    lineHeight: 56,
    fontFamily: '"Cormorant Garamond", Georgia, serif',
  },
});

export default BreathingGuideText;
