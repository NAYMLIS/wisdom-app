import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useTheme } from '../themes/ThemeContext';
import { wisdomService, DailyWisdom } from '../services/wisdomService';

interface DailyWisdomCardProps {
  onMeditatePress?: () => void;
  onBookmarkPress?: () => void;
}

const DailyWisdomCard = ({ onMeditatePress, onBookmarkPress }: DailyWisdomCardProps) => {
  const { theme } = useTheme();
  const [wisdom, setWisdom] = useState<DailyWisdom | null>(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    loadWisdom();
  }, []);

  const loadWisdom = () => {
    try {
      const today = wisdomService.getTodayWisdom();
      setWisdom(today);
      setLoading(false);

      // Animate in: fade + slide up
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } catch (error) {
      console.error('Failed to load wisdom:', error);
      setLoading(false);
    }
  };

  if (loading || !wisdom) {
    return null;
  }

  const getThemeColor = (theme: string) => {
    const colorMap: Record<string, string> = {
      gratitude: '#D4A574',
      courage: '#E74C3C',
      wonder: '#6C5CE7',
      purpose: '#0984E3',
      compassion: '#E91E63',
      joy: '#F39C12',
      peace: '#27AE60',
    };
    return colorMap[theme] || '#7B6FAA';
  };

  const accentColor = getThemeColor(wisdom.theme);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Theme indicator */}
      <View
        style={[
          styles.themeIndicator,
          { backgroundColor: accentColor },
        ]}
      />

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.dateText, { color: theme.colors.tertiary }]}>
          {wisdom.dayOfWeek}
        </Text>
        <Text style={[styles.themeText, { color: accentColor, fontWeight: '700' }]}>
          {wisdom.theme.charAt(0).toUpperCase() + wisdom.theme.slice(1)}
        </Text>
      </View>

      {/* Quote */}
      <View style={styles.quoteSection}>
        <Text style={[styles.quote, { color: theme.colors.text }]}>
          {wisdom.quote}
        </Text>
        <Text style={[styles.author, { color: theme.colors.secondary }]}>
          — {wisdom.author}
        </Text>
        <Text style={[styles.tradition, { color: theme.colors.tertiary }]}>
          {wisdom.tradition}
        </Text>
      </View>

      {/* Reflection */}
      <View style={styles.reflectionSection}>
        <Text style={[styles.reflectionLabel, { color: theme.colors.secondary }]}>
          Today's reflection
        </Text>
        <Text style={[styles.reflection, { color: theme.colors.text }]}>
          {wisdom.reflection}
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: accentColor }]}
          onPress={onMeditatePress}
        >
          <Text style={styles.buttonText}>Meditate on this</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.buttonOutline, { borderColor: accentColor }]}
          onPress={onBookmarkPress}
        >
          <Text style={[styles.bookmarkText, { color: accentColor }]}>🔖</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    padding: 18,
    marginVertical: 12,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  themeIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  themeText: {
    fontSize: 13,
  },
  quoteSection: {
    marginBottom: 16,
  },
  quote: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  author: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  tradition: {
    fontSize: 11,
    fontWeight: '400',
  },
  reflectionSection: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 12,
  },
  reflectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  reflection: {
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  buttonOutline: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookmarkText: {
    fontSize: 20,
  },
});

export default DailyWisdomCard;
