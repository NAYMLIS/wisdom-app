import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import Slider from '@react-native-community/slider';
import BreathingCircle from '../components/BreathingCircle';
import { useTheme } from '../themes/ThemeContext';
import { loadSoundAsync, playOneShot } from '../services/audioService';
import { WebNoise, unlockAudio } from '../services/webNoise';

const DURATIONS = [5, 10, 15, 20, 30, 45, 60];
const INTERVALS = [1, 2, 3, 5, 10, 15, 20, 30];

type AmbientKey = 'brown' | 'rain' | 'ocean' | 'forest' | 'bowl';

type Message = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
};

const WisdomScreen = () => {
  const { theme } = useTheme();
  const { height } = useWindowDimensions();
  const chatMinHeight = Math.max(420, height * 0.6);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Seek, and understanding follows. What weighs on your mind?',
    },
  ]);
  const [draft, setDraft] = useState('');
  const [showMeditation, setShowMeditation] = useState(false);

  const [durationMin, setDurationMin] = useState(10);
  const [intervalMin, setIntervalMin] = useState(5);
  const [remaining, setRemaining] = useState(durationMin * 60);
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [prepCount, setPrepCount] = useState(3);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [breathPace, setBreathPace] = useState(6);
  const [volumes, setVolumes] = useState<Record<AmbientKey, number>>({
    brown: 0.4,
    rain: 0,
    ocean: 0,
    forest: 0,
    bowl: 0,
  });

  const intervalBellRef = useRef<Audio.Sound | null>(null);
  const finalGongRef = useRef<Audio.Sound | null>(null);
  const ambientRefs = useRef<Record<AmbientKey, WebNoise | null>>({
    brown: null,
    rain: null,
    ocean: null,
    forest: null,
    bowl: null,
  });
  const ambientInited = useRef(false);

  const rotation = useRef(new Animated.Value(0)).current;

  const stars = useMemo(
    () =>
      Array.from({ length: 48 }).map((_, index) => ({
        id: `star-${index}`,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: Math.random() * 2 + 1,
        opacity: Math.random() * 0.5 + 0.2,
      })),
    []
  );

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 60000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const reverseRotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true });
    const load = async () => {
      intervalBellRef.current = await loadSoundAsync(require('../assets/sounds/interval_bell.m4a'));
      finalGongRef.current = await loadSoundAsync(require('../assets/sounds/final_gong.m4a'));
    };
    load();

    return () => {
      intervalBellRef.current?.unloadAsync();
      finalGongRef.current?.unloadAsync();
      for (const key of Object.keys(ambientRefs.current) as AmbientKey[]) {
        ambientRefs.current[key]?.destroy();
      }
    };
  }, []);

  /** Initialize WebNoise generators — must be called from tap handler */
  const ensureAmbientInited = async () => {
    if (ambientInited.current) return;
    unlockAudio(); // MUST be synchronous in tap handler for iOS
    const types: AmbientKey[] = ['brown', 'rain', 'ocean', 'forest', 'bowl'];
    for (const key of types) {
      const wn = new WebNoise(key);
      await wn.init();
      ambientRefs.current[key] = wn;
    }
    ambientInited.current = true;
  };

  useEffect(() => {
    if (!isRunning && !isPreparing) {
      setRemaining(durationMin * 60);
    }
  }, [durationMin]);

  useEffect(() => {
    for (const key of Object.keys(volumes) as AmbientKey[]) {
      const wn = ambientRefs.current[key];
      if (!wn) continue;

      if (!isRunning || volumes[key] <= 0) {
        wn.stop();
        continue;
      }
      if (isPaused) {
        wn.pause();
        continue;
      }
      wn.play(volumes[key]);
    }
  }, [isRunning, isPaused, volumes]);

  useEffect(() => {
    if (!isPreparing) return;
    let count = 3;
    setPrepCount(count);
    const id = setInterval(() => {
      count -= 1;
      setPrepCount(count);
      if (count <= 0) {
        clearInterval(id);
        setIsPreparing(false);
        setIsRunning(true);
        setIsPaused(false);
        setElapsed(0);
        setRemaining(durationMin * 60);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [isPreparing]);

  useEffect(() => {
    if (!isRunning || isPaused) return;
    const id = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0) return 0;
        return next;
      });
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning, isPaused]);

  useEffect(() => {
    if (!isRunning || isPaused) return;
    if (elapsed === 0) return;
    const intervalSeconds = intervalMin * 60;
    const remainingSeconds = remaining;
    const shouldRing = intervalSeconds > 0 && elapsed % intervalSeconds === 0 && remainingSeconds > 0;
    if (shouldRing && intervalBellRef.current) {
      playOneShot(intervalBellRef.current, 0.9);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    if (remainingSeconds === 0 && finalGongRef.current) {
      playOneShot(finalGongRef.current, 1.0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsRunning(false);
      setIsPaused(false);
      setSessionComplete(true);
    }
  }, [elapsed, remaining, isRunning, isPaused, intervalMin]);

  useKeepAwake(isRunning || isPreparing ? 'meditation' : undefined);

  const handleStart = async () => {
    await ensureAmbientInited();

    if (isRunning && isPaused) {
      setIsPaused(false);
      for (const key of Object.keys(ambientRefs.current) as AmbientKey[]) {
        const wn = ambientRefs.current[key];
        if (!wn) continue;
        if (volumes[key] > 0) {
          wn.resume(volumes[key]);
        }
      }
      return;
    }
    if (isRunning) return;
    setSessionComplete(false);
    setIsPreparing(true);
  };

  const handlePause = async () => {
    if (!isRunning) return;
    setIsPaused(true);
    for (const key of Object.keys(ambientRefs.current) as AmbientKey[]) {
      ambientRefs.current[key]?.pause();
    }
  };

  const handleStop = async () => {
    setIsRunning(false);
    setIsPaused(false);
    setIsPreparing(false);
    setElapsed(0);
    setRemaining(durationMin * 60);
    for (const key of Object.keys(ambientRefs.current) as AmbientKey[]) {
      ambientRefs.current[key]?.stop();
    }
  };

  const formattedTime = useMemo(() => {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, [remaining]);

  const updateVolume = async (key: AmbientKey, value: number) => {
    setVolumes((prev) => ({ ...prev, [key]: value }));
    const wn = ambientRefs.current[key];
    if (!wn) return;
    if (value <= 0) {
      wn.stop();
    } else if (isRunning && !isPaused) {
      wn.play(value);
    } else {
      wn.setVolume(value);
    }
  };

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    const userMessage = { id: `${Date.now()}`, role: 'user' as const, text };
    const assistantMessage = {
      id: `${Date.now()}-reply`,
      role: 'assistant' as const,
      text: "I'm still learning to listen. Soon I'll be able to offer wisdom from the world's great traditions.",
    };
    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setDraft('');
  };

  return (
    <LinearGradient colors={[theme.colors.background, theme.colors.accent]} style={styles.container}>
      <View style={styles.starfield} pointerEvents="none">
        {stars.map((star) => (
          <View
            key={star.id}
            style={[
              styles.star,
              {
                left: star.left,
                top: star.top,
                width: star.size,
                height: star.size,
                opacity: star.opacity,
              },
            ]}
          />
        ))}
      </View>
      <Animated.View
        pointerEvents="none"
        style={[styles.geometry, { borderColor: theme.colors.secondary, transform: [{ rotate }] }]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.geometryInner,
          { borderColor: theme.colors.primary, transform: [{ rotate: reverseRotate }] },
        ]}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.logoRow}>
              <View style={[styles.logoGlyph, { borderColor: theme.colors.primary }]}>
                <View style={[styles.logoGlyphInner, { borderColor: theme.colors.secondary }]} />
              </View>
              <Text style={[styles.logoText, { color: theme.colors.text }]}>LaNita</Text>
            </View>
            <Text style={[styles.tagline, { color: theme.colors.secondary }]}>Where all paths converge in quiet light.</Text>
          </View>

          <View style={[styles.card, styles.chatCard, { backgroundColor: theme.colors.surface, minHeight: chatMinHeight }]}
          >
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>AI Counsel</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.secondary }]}>A gentle space for reflection and clarity.</Text>
            </View>

            <View style={styles.chatBody}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.chatList}>
                {messages.map((msg) => (
                  <View
                    key={msg.id}
                    style={[
                      styles.bubble,
                      msg.role === 'assistant' ? styles.bubbleLeft : styles.bubbleRight,
                      msg.role === 'assistant'
                        ? [styles.assistantBubble, { borderColor: theme.colors.primary }]
                        : [styles.userBubble, { backgroundColor: theme.colors.accent }],
                    ]}
                  >
                    <Text style={[styles.bubbleText, { color: theme.colors.text }]}>{msg.text}</Text>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.inputRow}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Share your question..."
                  placeholderTextColor={theme.colors.secondary}
                  style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.accent }]}
                />
                <TouchableOpacity
                  style={[styles.sendButton, { backgroundColor: theme.colors.primary }]}
                  onPress={handleSend}
                >
                  <Text style={styles.sendText}>Send</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}
          >
            <TouchableOpacity
              style={styles.accordionHeader}
              onPress={() => setShowMeditation((prev) => !prev)}
              activeOpacity={0.8}
            >
              <View>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Meditation</Text>
                <Text style={[styles.sectionSubtitle, { color: theme.colors.secondary }]}>Breathe with bells, ambient sound, and stillness.</Text>
              </View>
              <Text style={[styles.accordionToggle, { color: theme.colors.primary }]}>
                {showMeditation ? 'Close' : 'Meditate'}
              </Text>
            </TouchableOpacity>

            {showMeditation && (
              <View style={styles.accordionBody}>
                <View style={styles.centered}>
                  <View style={[styles.breathHalo, { shadowColor: theme.colors.primary }]}>
                    <BreathingCircle paceSeconds={breathPace} />
                  </View>
                </View>

                <Text style={[styles.timer, { color: theme.colors.text }]}>{isPreparing ? prepCount : formattedTime}</Text>
                {isPaused && <Text style={[styles.subtle, { color: theme.colors.secondary }]}>Paused</Text>}
                {sessionComplete && (
                  <View style={styles.completeBox}>
                    <Text style={[styles.completeTitle, { color: theme.colors.text }]}>Session Complete</Text>
                    <Text style={[styles.subtle, { color: theme.colors.secondary }]}>Duration: {durationMin} minutes</Text>
                    <TouchableOpacity style={[styles.button, { backgroundColor: theme.colors.primary }]}
                    >
                      <Text style={styles.buttonText}>Journal Reflection</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.controlsRow}>
                  <TouchableOpacity style={[styles.button, { backgroundColor: theme.colors.primary }]} onPress={handleStart}
                  >
                    <Text style={styles.buttonText}>{isRunning && !isPaused ? 'Running' : isPaused ? 'Resume' : 'Start'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.buttonOutline, { borderColor: theme.colors.secondary }]}
                    onPress={handlePause}
                  >
                    <Text style={[styles.buttonText, { color: theme.colors.secondary }]}>Pause</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.buttonOutline, { borderColor: theme.colors.secondary }]}
                    onPress={handleStop}
                  >
                    <Text style={[styles.buttonText, { color: theme.colors.secondary }]}>Stop</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Duration</Text>
                  <View style={styles.pillRow}>
                    {DURATIONS.map((d) => (
                      <TouchableOpacity
                        key={d}
                        style={[
                          styles.pill,
                          { borderColor: theme.colors.secondary },
                          d === durationMin && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                        ]}
                        onPress={() => setDurationMin(d)}
                      >
                        <Text
                          style={[
                            styles.pillText,
                            { color: theme.colors.text },
                            d === durationMin && { color: '#1A140F' },
                          ]}
                        >
                          {d} min
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Interval Bell</Text>
                  <View style={styles.pillRow}>
                    {INTERVALS.map((i) => (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.pill,
                          { borderColor: theme.colors.secondary },
                          i === intervalMin && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                        ]}
                        onPress={() => setIntervalMin(i)}
                      >
                        <Text
                          style={[
                            styles.pillText,
                            { color: theme.colors.text },
                            i === intervalMin && { color: '#1A140F' },
                          ]}
                        >
                          {i} min
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Breath Pace ({breathPace}s)</Text>
                  <Slider
                    value={breathPace}
                    minimumValue={4}
                    maximumValue={10}
                    step={1}
                    onValueChange={setBreathPace}
                    minimumTrackTintColor={theme.colors.primary}
                    maximumTrackTintColor={theme.colors.secondary}
                    thumbTintColor={theme.colors.primary}
                  />
                </View>

                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Ambient Mixer</Text>
                  {([
                    ['brown', 'Brown Noise'],
                    ['rain', 'Rain'],
                    ['ocean', 'Ocean'],
                    ['forest', 'Forest'],
                    ['bowl', 'Singing Bowl'],
                  ] as [AmbientKey, string][]).map(([key, label]) => (
                    <View key={key} style={styles.sliderRow}>
                      <Text style={[styles.sliderLabel, { color: theme.colors.secondary }]}>{label}</Text>
                      <Slider
                        value={volumes[key]}
                        minimumValue={0}
                        maximumValue={1}
                        step={0.05}
                        onValueChange={(v) => updateVolume(key, v)}
                        minimumTrackTintColor={theme.colors.primary}
                        maximumTrackTintColor={theme.colors.secondary}
                        thumbTintColor={theme.colors.primary}
                      />
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 80 },
  starfield: { ...StyleSheet.absoluteFillObject },
  star: { position: 'absolute', backgroundColor: '#FFFFFF', borderRadius: 999 },
  geometry: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1,
    opacity: 0.2,
  },
  geometryInner: {
    position: 'absolute',
    bottom: -120,
    left: -90,
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    opacity: 0.25,
  },
  header: { marginBottom: 18 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoGlyph: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlyphInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
  },
  logoText: { fontSize: 28, fontWeight: '700', letterSpacing: 1 },
  tagline: { fontSize: 14, marginTop: 6 },
  card: { borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  chatCard: { paddingBottom: 16 },
  sectionHeader: { marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontWeight: '600', marginBottom: 4 },
  sectionSubtitle: { fontSize: 14 },
  chatBody: { flex: 1, gap: 12 },
  chatList: { gap: 12, paddingBottom: 12 },
  bubble: { maxWidth: '85%', padding: 12, borderRadius: 18 },
  bubbleLeft: { alignSelf: 'flex-start' },
  bubbleRight: { alignSelf: 'flex-end' },
  assistantBubble: {
    backgroundColor: 'rgba(200,161,90,0.16)',
    borderWidth: 1,
    shadowColor: '#C8A15A',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  userBubble: {
    backgroundColor: 'rgba(30,26,46,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(123,111,170,0.3)',
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, borderWidth: 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 },
  sendButton: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 16 },
  sendText: { color: '#0C0A14', fontWeight: '700' },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  accordionToggle: { fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  accordionBody: { marginTop: 16 },
  centered: { alignItems: 'center' },
  breathHalo: {
    padding: 18,
    borderRadius: 140,
    backgroundColor: 'rgba(12,10,20,0.6)',
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
  },
  timer: { fontSize: 46, fontWeight: '300', marginTop: 16, textAlign: 'center' },
  subtle: { fontSize: 14, marginTop: 4, textAlign: 'center' },
  controlsRow: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 16, flexWrap: 'wrap' },
  button: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 24 },
  buttonOutline: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 24, borderWidth: 1 },
  buttonText: { color: '#fff', fontWeight: '600' },
  section: { width: '100%', marginTop: 16 },
  sectionLabel: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: 1, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  pillText: { fontSize: 13 },
  sliderRow: { marginBottom: 12 },
  sliderLabel: { fontSize: 14, marginBottom: 4 },
  completeBox: { alignItems: 'center', marginTop: 12, marginBottom: 8 },
  completeTitle: { fontSize: 18, fontWeight: '600' },
});

export default WisdomScreen;
