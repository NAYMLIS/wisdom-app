import { useRef } from 'react';
import { Animated } from 'react-native';

/**
 * Hook for tap feedback animations (scale + fade)
 * Makes buttons feel responsive and premium
 */
export const useTapFeedback = () => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scale, {
      toValue: 0.95,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  return {
    scale,
    handlePressIn,
    handlePressOut,
  };
};
