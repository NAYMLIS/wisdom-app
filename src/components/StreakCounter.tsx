import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme } from '../themes/ThemeContext';
import { userDataService } from '../services/userDataService';

interface StreakCounterProps {
  size?: 'small' | 'medium' | 'large';
}

const StreakCounter = ({ size = 'medium' }: StreakCounterProps) => {
  const { theme } = useTheme();
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const scaleAnim = new Animated.Value(1);

  useEffect(() => {
    loadStreak();
  }, []);

  const loadStreak = async () => {
    try {
      const stats = await userDataService.getStats();
      setStreak(stats.streak);
      setLoading(false);

      // Pulse animation when loaded
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } catch (error) {
      console.error('Failed to load streak:', error);
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return { containerSize: 60, fontSize: 14, flameSize: 16 };
      case 'large':
        return { containerSize: 100, fontSize: 32, flameSize: 40 };
      default:
        return { containerSize: 80, fontSize: 24, flameSize: 28 };
    }
  };

  const { containerSize, fontSize, flameSize } = getSizeStyles();

  if (loading) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: containerSize,
          height: containerSize,
          borderRadius: containerSize / 2,
          backgroundColor: theme.colors.surface,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={[styles.flame, { fontSize: flameSize }]}>🔥</Text>
        <Text style={[styles.count, { fontSize, color: theme.colors.primary }]}>
          {streak}
        </Text>
      </View>
      <Text style={[styles.label, { fontSize: 11, color: theme.colors.tertiary }]}>days</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(184, 150, 62, 0.4)',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flame: {
    marginBottom: 2,
  },
  count: {
    fontWeight: '700',
    lineHeight: 1,
  },
  label: {
    marginTop: 2,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default StreakCounter;
