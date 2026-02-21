import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import Slider from '@react-native-community/slider';
import BreathingCircle from '../components/BreathingCircle';
import { useTheme } from '../themes/ThemeContext';
import { loadSoundAsync, playOneShot } from '../services/audioService';
import { LoopPlayer } from '../services/loopPlayer';

const DURATIONS = [5, 10, 15, 20, 30, 45, 60];
const INTERVALS = [1, 2, 3, 5, 10, 15, 20, 30];

type AmbientKey = 'brown' | 'rain' | 'ocean' | 'forest' | 'bowl';

const MeditateScreen = () => {
  const { theme } = useTheme();
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
  const ambientRefs = useRef<Record<AmbientKey, LoopPlayer | null>>({
    brown: null,
    rain: null,
    ocean: null,
    forest: null,
    bowl: null,
  });

  const AMBIENT_ASSETS: Record<AmbientKey, any> = {
    brown: require('../assets/sounds/brown_noise.m4a'),
    rain: require('../assets/sounds/rain.m4a'),
    ocean: require('../assets/sounds/ocean.m4a'),
    forest: require('../assets/sounds/forest.m4a'),
    bowl: require('../assets/sounds/singing_bowl.m4a'),
  };

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true });
    const load = async () => {
      intervalBellRef.current = await loadSoundAsync(require('../assets/sounds/interval_bell.m4a'));
      finalGongRef.current = await loadSoundAsync(require('../assets/sounds/final_gong.m4a'));

      for (const key of Object.keys(AMBIENT_ASSETS) as AmbientKey[]) {
        const lp = new LoopPlayer(AMBIENT_ASSETS[key]);
        await lp.init();
        ambientRefs.current[key] = lp;
      }
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

  useEffect(() => {
    if (!isRunning && !isPreparing) {
      setRemaining(durationMin * 60);
    }
  }, [durationMin]);

  useEffect(() => {
    const toggleAmbient = async () => {
      for (const key of Object.keys(volumes) as AmbientKey[]) {
        const lp = ambientRefs.current[key];
        if (!lp) continue;

        if (!isRunning || volumes[key] <= 0) {
          await lp.stop();
          continue;
        }
        if (isPaused) {
          await lp.pause();
          continue;
        }
        // Playing state
        await lp.play(volumes[key]);
      }
    };
    toggleAmbient();
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
    const id = setInterval(async () => {
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
    if (isRunning && isPaused) {
      setIsPaused(false);
      for (const key of Object.keys(ambientRefs.current) as AmbientKey[]) {
        const lp = ambientRefs.current[key];
        if (!lp) continue;
        if (volumes[key] > 0) {
          await lp.resume();
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
      await ambientRefs.current[key]?.pause();
    }
  };

  const handleStop = async () => {
    setIsRunning(false);
    setIsPaused(false);
    setIsPreparing(false);
    setElapsed(0);
    setRemaining(durationMin * 60);
    for (const key of Object.keys(ambientRefs.current) as AmbientKey[]) {
      await ambientRefs.current[key]?.stop();
    }
  };

  const formattedTime = useMemo(() => {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, [remaining]);

  const updateVolume = async (key: AmbientKey, value: number) => {
    setVolumes((prev) => ({ ...prev, [key]: value }));
    const lp = ambientRefs.current[key];
    if (!lp) return;
    if (value <= 0) {
      await lp.stop();
    } else if (isRunning && !isPaused) {
      await lp.play(value);
    } else {
      await lp.setVolume(value);
    }
  };

  return (
    <LinearGradient colors={[theme.colors.background, theme.colors.accent]} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Meditation</Text>

        <BreathingCircle paceSeconds={breathPace} />

        <Text style={[styles.timer, { color: theme.colors.text }]}>
          {isPreparing ? prepCount : formattedTime}
        </Text>
        {isPaused && <Text style={[styles.subtle, { color: theme.colors.secondary }]}>Paused</Text>}
        {sessionComplete && (
          <View style={styles.completeBox}>
            <Text style={[styles.completeTitle, { color: theme.colors.text }]}>Session Complete</Text>
            <Text style={[styles.subtle, { color: theme.colors.secondary }]}>Duration: {durationMin} minutes</Text>
            <TouchableOpacity style={[styles.button, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.buttonText}>Journal Reflection</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.controlsRow}>
          <TouchableOpacity style={[styles.button, { backgroundColor: theme.colors.primary }]} onPress={handleStart}>
            <Text style={styles.buttonText}>{isRunning && !isPaused ? 'Running' : isPaused ? 'Resume' : 'Start'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.buttonOutline, { borderColor: theme.colors.secondary }]} onPress={handlePause}>
            <Text style={[styles.buttonText, { color: theme.colors.secondary }]}>Pause</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.buttonOutline, { borderColor: theme.colors.secondary }]} onPress={handleStop}>
            <Text style={[styles.buttonText, { color: theme.colors.secondary }]}>Stop</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Duration</Text>
          <View style={styles.pillRow}>
            {DURATIONS.map((d) => (
              <TouchableOpacity
                key={d}
                style={[
                  styles.pill,
                  { borderColor: theme.colors.secondary },
                  d === durationMin && { backgroundColor: theme.colors.primary },
                ]}
                onPress={() => setDurationMin(d)}
              >
                <Text style={[styles.pillText, d === durationMin && { color: '#fff' }]}>{d} min</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Interval Bell</Text>
          <View style={styles.pillRow}>
            {INTERVALS.map((i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.pill,
                  { borderColor: theme.colors.secondary },
                  i === intervalMin && { backgroundColor: theme.colors.primary },
                ]}
                onPress={() => setIntervalMin(i)}
              >
                <Text style={[styles.pillText, i === intervalMin && { color: '#fff' }]}>{i} min</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Breath Pace ({breathPace}s)</Text>
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
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Ambient Mixer</Text>
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
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, alignItems: 'center', paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '600', marginBottom: 16 },
  timer: { fontSize: 56, fontWeight: '300', marginVertical: 16 },
  subtle: { fontSize: 14, marginTop: 4 },
  controlsRow: { flexDirection: 'row', gap: 12, marginTop: 12, marginBottom: 24 },
  button: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 24 },
  buttonOutline: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 24, borderWidth: 1 },
  buttonText: { color: '#fff', fontWeight: '600' },
  section: { width: '100%', marginTop: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 10 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: 1, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  pillText: { fontSize: 14, color: '#333' },
  sliderRow: { marginBottom: 12 },
  sliderLabel: { fontSize: 14, marginBottom: 4 },
  completeBox: { alignItems: 'center', marginTop: 12, marginBottom: 8 },
  completeTitle: { fontSize: 20, fontWeight: '600' },
});

export default MeditateScreen;
