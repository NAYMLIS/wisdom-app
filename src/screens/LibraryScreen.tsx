import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../themes/ThemeContext';

const LibraryScreen = () => {
  const { theme } = useTheme();
  return (
    <LinearGradient colors={[theme.colors.background, theme.colors.accent]} style={styles.container}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Library</Text>
      <Text style={[styles.body, { color: theme.colors.secondary }]}>Sacred texts and teachings will appear here.</Text>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, marginBottom: 12, fontWeight: '600' },
  body: { fontSize: 16, textAlign: 'center' },
});

export default LibraryScreen;
