import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../themes/ThemeContext';

const HomeScreen = () => {
  const { theme } = useTheme();
  return (
    <LinearGradient colors={[theme.colors.background, theme.colors.accent]} style={styles.container}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Daily Wisdom</Text>
      <Text style={[styles.quote, { color: theme.colors.secondary }]}>“Silence is the language of the soul.”</Text>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, marginBottom: 16, fontWeight: '600' },
  quote: { fontSize: 18, textAlign: 'center', lineHeight: 28 },
});

export default HomeScreen;
