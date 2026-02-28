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
  LayoutAnimation,
  UIManager,
  Modal,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import Constants from 'expo-constants';
import Slider from '@react-native-community/slider';
import BreathingCircle from '../components/BreathingCircle';
import BreathingGuideText from '../components/BreathingGuideText';
import StreakCounter from '../components/StreakCounter';
import MeditationStats from '../components/MeditationStats';
import DailyWisdomCard from '../components/DailyWisdomCard';
import { useTheme } from '../themes/ThemeContext';
import { loadSoundAsync, playOneShot } from '../services/audioService';
import { WebNoise, unlockAudio } from '../services/webNoise';
import { askCounsel, CounselSource } from '../services/counselService';
import { userDataService } from '../services/userDataService';

const DURATIONS = [5, 10, 15, 20, 30, 45, 60];
const INTERVALS = [1, 2, 3, 5, 10, 15, 20, 30];

const TRADITIONS = [
  'All Traditions',
  'Christianity',
  'Islam',
  'Buddhism',
  'Hinduism',
  'Judaism',
  'Taoism',
  'Sikhism',
  'Philosophy',
];

type AmbientKey = 'brown' | 'rain' | 'ocean' | 'forest' | 'bowl';

type Message = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  sources?: CounselSource[];
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
  const [isTyping, setIsTyping] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [traditionPreference, setTraditionPreference] = useState('All Traditions');

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
  const [moodAfter, setMoodAfter] = useState<'calm' | 'clear' | 'energized' | undefined>(undefined);
  const [sessionLogged, setSessionLogged] = useState(false);

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
  const chatScrollRef = useRef<ScrollView | null>(null);

  // Decorative gold flecks (subtle ornamental dots)
  const flecks = useMemo(
    () =>
      Array.from({ length: 20 }).map((_, index) => ({
        id: `fleck-${index}`,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: Math.random() * 3 + 1,
        opacity: Math.random() * 0.12 + 0.04,
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

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
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

  useEffect(() => {
    requestAnimationFrame(() => {
      chatScrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages, isTyping]);

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

  const handleSessionLogged = async () => {
    if (!sessionLogged && sessionComplete) {
      try {
        // Get the active ambient preset name
        const activePreset = Object.entries(volumes).find(
          ([_, vol]) => vol > 0
        )?.[0] ?? 'silence';
        
        await userDataService.logMeditationSession(
          durationMin,
          activePreset,
          undefined,
          moodAfter
        );
        setSessionLogged(true);
      } catch (error) {
        console.error('Failed to log meditation session:', error);
      }
    }
  };

  const handleDismissSession = async () => {
    await handleSessionLogged();
    setSessionComplete(false);
    setMoodAfter(undefined);
    setSessionLogged(false);
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

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    const userMessage = { id: `${Date.now()}`, role: 'user' as const, text };
    setMessages((prev) => [...prev, userMessage]);
    setDraft('');
    setIsTyping(true);

    const history = [...messages, userMessage]
      .slice(-6)
      .map((msg) => ({ role: msg.role, text: msg.text }));
    const tradition = traditionPreference === 'All Traditions' ? undefined : traditionPreference;

    const result = await askCounsel(text, history, tradition);
    setIsTyping(false);
    const assistantMessage = {
      id: `${Date.now()}-reply`,
      role: 'assistant' as const,
      text: result.response,
      sources: result.sources,
    };
    setMessages((prev) => [...prev, assistantMessage]);
  };

  const handleSuggestion = (suggestion: string) => {
    setDraft(suggestion);
  };

  const toggleSources = (messageId: string) => {
    setExpandedSources((prev) => ({ ...prev, [messageId]: !prev[messageId] }));
  };

  return (
    <LinearGradient colors={[theme.colors.background, theme.colors.accent]} style={styles.container}>
      <View style={styles.starfield} pointerEvents="none">
        {flecks.map((fleck) => (
          <View
            key={fleck.id}
            style={[
              styles.fleck,
              {
                left: fleck.left,
                top: fleck.top,
                width: fleck.size,
                height: fleck.size,
                opacity: fleck.opacity,
              },
            ]}
          />
        ))}
      </View>
      {/* Ornamental corner accents */}
      <View
        pointerEvents="none"
        style={[styles.ornamentTopRight, { borderColor: theme.colors.border }]}
      />
      <View
        pointerEvents="none"
        style={[styles.ornamentBottomLeft, { borderColor: theme.colors.border }]}
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
            </View>
            <TouchableOpacity
              style={[styles.settingsButton, { borderColor: theme.colors.secondary }]}
              onPress={() => setShowSettings(true)}
            >
              <Text style={[styles.settingsIcon, { color: theme.colors.primary }]}>⚙︎</Text>
            </TouchableOpacity>
            <Text style={[styles.tagline, { color: theme.colors.secondary, fontFamily: theme.fonts.body, fontStyle: 'italic' }]}>
              Where all paths converge in quiet light.
            </Text>
          </View>

          <View style={styles.statsSection}>
            <StreakCounter size="medium" />
            <MeditationStats />
          </View>

          <DailyWisdomCard
            onMeditatePress={() => setShowMeditation(true)}
            onBookmarkPress={() => {
              // TODO: Implement bookmarking to user data
            }}
          />

          <View style={[styles.card, styles.chatCard, { backgroundColor: theme.colors.surface, minHeight: chatMinHeight }]}
          >
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.heading }]}>AI Counsel</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.secondary }]}>
                A gentle space for reflection and clarity.
              </Text>
            </View>

            <View style={[styles.chatWatermark, { borderColor: theme.colors.secondary }]} pointerEvents="none">
              <View style={[styles.chatWatermarkInner, { borderColor: theme.colors.primary }]} />
            </View>

            <View style={styles.chatBody}>
              <ScrollView
                ref={(ref) => {
                  chatScrollRef.current = ref;
                }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.chatList}
              >
                {messages.length === 1 && (
                  <View style={styles.emptyState}>
                    <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                      What weighs on your heart today?
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: theme.colors.secondary }]}>
                      Choose a question or share your own.
                    </Text>
                    <View style={styles.chipRow}>
                      {[
                        'How do I find peace in difficult times?',
                        'What is the meaning of suffering?',
                        'Guide me in forgiveness',
                        'I need strength today',
                      ].map((prompt) => (
                        <TouchableOpacity
                          key={prompt}
                          style={[styles.chip, { borderColor: theme.colors.secondary }]}
                          onPress={() => handleSuggestion(prompt)}
                        >
                          <Text style={[styles.chipText, { color: theme.colors.text }]}>{prompt}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {messages.map((msg) => (
                  <FadeInMessage key={msg.id}>
                    <View
                      style={[
                        styles.bubble,
                        msg.role === 'assistant' ? styles.bubbleLeft : styles.bubbleRight,
                        msg.role === 'assistant'
                          ? [styles.assistantBubble, { borderColor: theme.colors.secondary }]
                          : [styles.userBubble, { borderColor: theme.colors.primary }],
                      ]}
                    >
                      <Text style={[styles.bubbleText, { color: theme.colors.text }]}>{msg.text}</Text>
                      {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                        <View style={styles.sourcesWrap}>
                          <TouchableOpacity onPress={() => toggleSources(msg.id)}>
                            <Text style={[styles.sourcesToggle, { color: theme.colors.secondary }]}> 
                              {expandedSources[msg.id] ? 'Hide Sources' : 'Sources'}
                            </Text>
                          </TouchableOpacity>
                          {expandedSources[msg.id] && (
                            <View style={styles.sourcesList}>
                              {msg.sources.map((source, index) => (
                                <Text key={`${msg.id}-${index}`} style={[styles.sourceText, { color: theme.colors.secondary }]}> 
                                  • {source.text} — {source.source}
                                </Text>
                              ))}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  </FadeInMessage>
                ))}
                {isTyping && (
                  <View
                    style={[
                      styles.bubble,
                      styles.bubbleLeft,
                      styles.assistantBubble,
                      { borderColor: theme.colors.secondary },
                    ]}
                  >
                    <TypingIndicator color={theme.colors.secondary} />
                  </View>
                )}
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

          <View style={styles.ornamentalDivider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
            <Text style={[styles.dividerOrnament, { color: theme.colors.primary }]}>✦</Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
          </View>

          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}
          >
            <TouchableOpacity
              style={styles.accordionHeader}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setShowMeditation((prev) => !prev);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.meditationHeaderLeft}>
                <View style={[styles.meditationIcon, { borderColor: theme.colors.primary }]}> 
                    <Text style={[styles.meditationIconText, { color: theme.colors.primary }]}>✦</Text>
                </View>
                <View>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.heading }]}>Meditation</Text>
                  <Text style={[styles.sectionSubtitle, { color: theme.colors.secondary }]}>
                    Breathe with bells, ambient sound, and stillness.
                  </Text>
                </View>
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
                    <BreathingGuideText isActive={isRunning && !isPaused && !isPreparing} breathPace={breathPace} />
                  </View>
                </View>

                <Text style={[styles.timer, { color: theme.colors.text }]}>{isPreparing ? prepCount : formattedTime}</Text>
                {isPaused && <Text style={[styles.subtle, { color: theme.colors.secondary }]}>Paused</Text>}
                {sessionComplete && (
                  <View style={styles.completeBox}>
                    <Text style={[styles.completeTitle, { color: theme.colors.text }]}>✨ Session Complete</Text>
                    <Text style={[styles.subtle, { color: theme.colors.secondary }]}>Duration: {durationMin} minutes</Text>
                    
                    <View style={styles.moodSection}>
                      <Text style={[styles.moodLabel, { color: theme.colors.text }]}>How are you feeling?</Text>
                      <View style={styles.moodRow}>
                        {[
                          { emoji: '😌', label: 'Calm', value: 'calm' as const },
                          { emoji: '🧠', label: 'Clear', value: 'clear' as const },
                          { emoji: '⚡', label: 'Energized', value: 'energized' as const },
                        ].map((mood) => (
                          <TouchableOpacity
                            key={mood.value}
                            style={[
                              styles.moodButton,
                              { borderColor: theme.colors.tertiary },
                              moodAfter === mood.value && { borderColor: theme.colors.primary, borderWidth: 2 },
                            ]}
                            onPress={() => setMoodAfter(mood.value)}
                          >
                            <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                            <Text style={[styles.moodText, { color: theme.colors.text }]}>{mood.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[styles.button, { backgroundColor: theme.colors.primary }]}
                      onPress={handleDismissSession}
                    >
                      <Text style={styles.buttonText}>Finish</Text>
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
                            d === durationMin && { color: '#FDFBF7' },
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
                            i === intervalMin && { color: '#FDFBF7' },
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

      <Modal transparent visible={showSettings} animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setShowSettings(false)}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}> 
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Settings</Text>
            <Text style={[styles.modalLabel, { color: theme.colors.secondary }]}>App</Text>
            <Text style={[styles.modalText, { color: theme.colors.text }]}>v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
            <Text style={[styles.modalLabel, { color: theme.colors.secondary }]}>About</Text>
            <Text style={[styles.modalText, { color: theme.colors.text }]}>Ancient wisdom and modern practice. Seek guidance from humanity's deepest spiritual traditions.</Text>
            <Text style={[styles.modalLabel, { color: theme.colors.secondary }]}>Tradition Preference</Text>
            <View style={styles.traditionList}>
              {TRADITIONS.map((option) => {
                const selected = traditionPreference === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.traditionOption, { borderColor: selected ? theme.colors.primary : 'rgba(212,201,184,0.4)' }]}
                    onPress={() => setTraditionPreference(option)}
                  >
                    <View style={[styles.radioOuter, { borderColor: theme.colors.primary }]}> 
                      {selected && <View style={[styles.radioInner, { backgroundColor: theme.colors.primary }]} />}
                    </View>
                    <Text style={[styles.traditionText, { color: theme.colors.text }]}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
};

const FadeInMessage = ({ children }: { children: React.ReactNode }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
};

const TypingIndicator = ({ color }: { color: string }) => {
  const dot1 = useRef(new Animated.Value(0.2)).current;
  const dot2 = useRef(new Animated.Value(0.2)).current;
  const dot3 = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const createPulse = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.2, duration: 350, useNativeDriver: true }),
        ])
      );

    const anim1 = createPulse(dot1, 0);
    const anim2 = createPulse(dot2, 120);
    const anim3 = createPulse(dot3, 240);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.typingRow}>
      {[dot1, dot2, dot3].map((dot, index) => (
        <Animated.View
          key={`dot-${index}`}
          style={[styles.typingDot, { backgroundColor: color, opacity: dot }]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 80 },
  starfield: { ...StyleSheet.absoluteFillObject },
  fleck: { position: 'absolute', backgroundColor: '#B8963E', borderRadius: 999 },
  ornamentTopRight: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    opacity: 0.15,
  },
  ornamentBottomLeft: {
    position: 'absolute',
    bottom: -80,
    left: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    opacity: 0.12,
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
  logoText: { fontSize: 32, fontWeight: '600', letterSpacing: 2 },
  tagline: { fontSize: 14, marginTop: 6 },
  settingsButton: {
    position: 'absolute',
    right: 0,
    top: 2,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  settingsIcon: { fontSize: 16 },
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(212,201,184,0.5)',
    borderTopWidth: 2,
    borderTopColor: '#B8963E',
    shadowColor: '#8B7D6B',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  chatCard: { paddingBottom: 16 },
  sectionHeader: { marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontWeight: '600', marginBottom: 4 },
  sectionSubtitle: { fontSize: 14 },
  chatBody: { flex: 1, gap: 12 },
  chatList: { gap: 12, paddingBottom: 12 },
  chatWatermark: {
    position: 'absolute',
    right: -40,
    top: 30,
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    opacity: 0.08,
  },
  chatWatermarkInner: {
    position: 'absolute',
    left: 30,
    top: 30,
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
  },
  bubble: { maxWidth: '85%', padding: 12, borderRadius: 18 },
  bubbleLeft: { alignSelf: 'flex-start' },
  bubbleRight: { alignSelf: 'flex-end' },
  assistantBubble: {
    backgroundColor: '#FDFBF7',
    borderWidth: 1,
    shadowColor: '#8B7D6B',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  userBubble: {
    backgroundColor: 'rgba(184,150,62,0.12)',
    borderWidth: 1,
  },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  sourcesWrap: { marginTop: 8 },
  sourcesToggle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  sourcesList: { marginTop: 6, gap: 4 },
  sourceText: { fontSize: 12, lineHeight: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, borderWidth: 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 },
  sendButton: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 16 },
  sendText: { color: '#FDFBF7', fontWeight: '700' },
  typingRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  typingDot: { width: 6, height: 6, borderRadius: 3 },
  emptyState: { marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  emptySubtitle: { fontSize: 13, marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 12 },
  ornamentalDivider: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  dividerLine: { flex: 1, height: 1, opacity: 0.4 },
  dividerOrnament: { fontSize: 14, opacity: 0.6 },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meditationHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  meditationIcon: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  meditationIconText: { fontSize: 16 },
  accordionToggle: { fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  accordionBody: { marginTop: 16 },
  centered: { alignItems: 'center' },
  breathHalo: {
    padding: 18,
    borderRadius: 140,
    backgroundColor: 'rgba(245,240,232,0.6)',
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
  },
  timer: { fontSize: 46, fontWeight: '300', marginTop: 16, textAlign: 'center', letterSpacing: 2 },
  subtle: { fontSize: 14, marginTop: 4, textAlign: 'center' },
  controlsRow: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 16, flexWrap: 'wrap' },
  button: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 24 },
  buttonOutline: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 24, borderWidth: 1 },
  buttonText: { color: '#FDFBF7', fontWeight: '600' },
  section: { width: '100%', marginTop: 16 },
  sectionLabel: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: 1, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  pillText: { fontSize: 13 },
  sliderRow: { marginBottom: 12 },
  sliderLabel: { fontSize: 14, marginBottom: 4 },
  completeBox: { alignItems: 'center', marginTop: 12, marginBottom: 8 },
  completeTitle: { fontSize: 18, fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(58,47,39,0.5)',
    padding: 24,
    justifyContent: 'center',
  },
  modalCard: { borderRadius: 22, padding: 20, gap: 10, borderWidth: 1, borderColor: 'rgba(212,201,184,0.6)' },
  modalTitle: { fontSize: 22, fontWeight: '600', marginBottom: 6 },
  modalLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  modalText: { fontSize: 14, lineHeight: 20 },
  traditionList: { gap: 8, marginTop: 6 },
  traditionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  traditionText: { fontSize: 14 },
  radioOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 8, height: 8, borderRadius: 4 },
  moodSection: {
    marginVertical: 16,
    gap: 12,
  },
  moodLabel: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  moodButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 12,
    gap: 6,
  },
  moodEmoji: {
    fontSize: 24,
  },
  moodText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  statsSection: {
    alignItems: 'center',
    marginVertical: 16,
    gap: 16,
  },
});

export default WisdomScreen;
