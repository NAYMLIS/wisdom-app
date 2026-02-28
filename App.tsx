import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from './src/themes/ThemeContext';
import WisdomScreen from './src/screens/WisdomScreen';

export default function App() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      const link = document.createElement('link');
      link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=EB+Garamond:wght@400;500;600&display=swap';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
  }, []);

  return (
    <ThemeProvider>
      <StatusBar style="dark" />
      <WisdomScreen />
    </ThemeProvider>
  );
}
