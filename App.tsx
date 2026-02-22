import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from './src/themes/ThemeContext';
import WisdomScreen from './src/screens/WisdomScreen';

export default function App() {
  return (
    <ThemeProvider>
      <StatusBar style="light" />
      <WisdomScreen />
    </ThemeProvider>
  );
}
