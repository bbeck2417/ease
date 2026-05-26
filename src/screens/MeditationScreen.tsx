import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Easing,
  LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pause, Play, Repeat, Repeat1, Waves } from "lucide-react-native";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { RootStackParamList } from "../../App";
import { colors } from "../theme/colors";
import { MEDITATION_TRACKS, MeditationTrack } from "../data/meditationTracks";
import AppHeader from "../components/AppHeader";

const Visualizer = ({ isPlaying, hasTrackAudio }: { isPlaying: boolean; hasTrackAudio: boolean }) => {
  const barAnimations = useMemo(
    () => [
      new Animated.Value(0.35),
      new Animated.Value(0.55),
      new Animated.Value(0.42),
      new Animated.Value(0.65),
      new Animated.Value(0.5),
    ],
    [],
  );

  const loopsRef = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    if (isPlaying) {
      loopsRef.current = barAnimations.map((value, index) => {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(value, {
              toValue: 1,
              duration: 1000 + index * 160,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: false,
            }),
            Animated.timing(value, {
              toValue: 0.3,
              duration: 900 + index * 180,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: false,
            }),
          ]),
        );
        loop.start();
        return loop;
      });
      return;
    }

    loopsRef.current.forEach((loop) => loop.stop());
    loopsRef.current = [];

    barAnimations.forEach((value, index) => {
      Animated.timing(value, {
        toValue: 0.45 + index * 0.04,
        duration: 250,
        useNativeDriver: false,
      }).start();
    });
  }, [barAnimations, isPlaying]);

  return (
    <View style={styles.visualizerShell}>
      <View style={styles.visualizerGlow} />
      <View style={styles.visualizerBars}>
        {barAnimations.map((value, index) => (
          <Animated.View
            key={`bar-${index}`}
            style={[
              styles.visualizerBar,
              {
                height: value.interpolate({
                  inputRange: [0.2, 1],
                  outputRange: [28, 90],
                }),
                opacity: value.interpolate({
                  inputRange: [0.2, 1],
                  outputRange: [0.45, 0.95],
                }),
              },
            ]}
          />
        ))}
      </View>
      <Text style={styles.visualizerCaption}>
        {isPlaying
          ? "Breathing with your soundtrack"
          : hasTrackAudio
            ? "Press play to begin"
            : "Add a local CC0 file to this track"}
      </Text>
    </View>
  );
};

const MeditationScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const initialTrackWithAudio =
    MEDITATION_TRACKS.find((track) => Boolean(track.localAsset)) ?? MEDITATION_TRACKS[0];
  const [selectedTrackId, setSelectedTrackId] = useState(initialTrackWithAudio.id);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRepeatEnabled, setIsRepeatEnabled] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [progressTrackWidth, setProgressTrackWidth] = useState(0);

  const selectedTrack = useMemo(
    () =>
      MEDITATION_TRACKS.find((track) => track.id === selectedTrackId) ??
      MEDITATION_TRACKS[0],
    [selectedTrackId],
  );

  const hasSelectedTrackAudio = Boolean(selectedTrack.localAsset);
  const progressRatio =
    durationMillis > 0 ? Math.min(1, Math.max(0, positionMillis / durationMillis)) : 0;

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const prepareTrack = async (track: MeditationTrack) => {
    if (!track.localAsset) {
      throw new Error("Track has no local audio file assigned.");
    }

    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
    }

    const { sound: loadedSound } = await Audio.Sound.createAsync(track.localAsset, {
      shouldPlay: false,
      isLooping: isRepeatEnabled,
    });

    loadedSound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;
      setPositionMillis(status.positionMillis ?? 0);
      setDurationMillis(status.durationMillis ?? 0);
      setIsPlaying(status.isPlaying ?? false);
    });

    setSound(loadedSound);
    setIsPlaying(false);
    setPositionMillis(0);
    setDurationMillis(0);
    return loadedSound;
  };

  const formatMillis = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const onProgressTrackLayout = (event: LayoutChangeEvent) => {
    setProgressTrackWidth(event.nativeEvent.layout.width);
  };

  const onSeek = async (locationX: number) => {
    if (!sound || durationMillis <= 0 || progressTrackWidth <= 0) return;
    const ratio = Math.min(1, Math.max(0, locationX / progressTrackWidth));
    const nextPosition = Math.floor(durationMillis * ratio);
    try {
      await sound.setPositionAsync(nextPosition);
      setPositionMillis(nextPosition);
    } catch (error) {
      console.error("Unable to seek meditation track:", error);
    }
  };

  const onTogglePlayPause = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (!hasSelectedTrackAudio) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    try {
      let activeSound = sound;

      if (!activeSound) {
        activeSound = await prepareTrack(selectedTrack);
      }

      if (!activeSound) return;

      const status = await activeSound.getStatusAsync();
      if (!status.isLoaded) return;

      if (status.isPlaying) {
        await activeSound.pauseAsync();
        setIsPlaying(false);
      } else {
        await activeSound.playAsync();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error("Unable to play meditation track:", error);
    }
  };

  const onToggleRepeat = async () => {
    const nextRepeatState = !isRepeatEnabled;
    setIsRepeatEnabled(nextRepeatState);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (sound) {
      try {
        await sound.setIsLoopingAsync(nextRepeatState);
      } catch (error) {
        console.error("Unable to update repeat state:", error);
      }
    }
  };

  const onSelectTrack = async (track: MeditationTrack) => {
    if (track.id === selectedTrackId) return;

    setSelectedTrackId(track.id);
    Haptics.selectionAsync();

    const wasPlaying = isPlaying;

    if (!track.localAsset) {
      setIsPlaying(false);
      return;
    }

    try {
      const preparedSound = await prepareTrack(track);
      if (wasPlaying) {
        await preparedSound.playAsync();
        setIsPlaying(true);
      }
    } catch (_error) {
      setIsPlaying(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <AppHeader title="Meditation" onBackPress={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>Settle in and choose a soundscape.</Text>

        <Visualizer isPlaying={isPlaying} hasTrackAudio={hasSelectedTrackAudio} />

        <View style={styles.nowPlayingCard}>
          <Waves color={colors.primary} size={20} />
          <View style={styles.nowPlayingTextWrap}>
            <Text style={styles.nowPlayingLabel}>Now selected</Text>
            <Text style={styles.nowPlayingTitle}>{selectedTrack.title}</Text>
          </View>
        </View>

        <View style={styles.controlRow}>
          <Pressable
            style={[styles.controlButton, styles.playButton, !hasSelectedTrackAudio && styles.playButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? "Pause meditation track" : "Play meditation track"}
            onPress={onTogglePlayPause}
            disabled={!hasSelectedTrackAudio}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            {isPlaying ? (
              <Pause color={colors.dark} size={22} />
            ) : (
              <Play color={colors.dark} size={22} />
            )}
            <Text style={styles.playText}>{isPlaying ? "Pause" : "Play"}</Text>
          </Pressable>

          <Pressable
            style={[
              styles.controlButton,
              styles.repeatButton,
              isRepeatEnabled && styles.repeatButtonActive,
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              isRepeatEnabled ? "Disable repeat playback" : "Enable repeat playback"
            }
            onPress={onToggleRepeat}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            {isRepeatEnabled ? (
              <Repeat1 color={colors.dark} size={20} />
            ) : (
              <Repeat color={colors.primary} size={20} />
            )}
            <Text
              style={[
                styles.repeatText,
                isRepeatEnabled && { color: colors.dark },
              ]}
            >
              Repeat
            </Text>
          </Pressable>
        </View>

        <View style={styles.timelineCard}>
          <Pressable
            style={styles.progressTrack}
            onLayout={onProgressTrackLayout}
            onPress={(event) => onSeek(event.nativeEvent.locationX)}
            disabled={!hasSelectedTrackAudio}
          >
            <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
          </Pressable>
          <View style={styles.timelineLabels}>
            <Text style={styles.timelineText}>{formatMillis(positionMillis)}</Text>
            <Text style={styles.timelineText}>{formatMillis(durationMillis)}</Text>
          </View>
        </View>

        <View style={styles.librarySection}>
          <Text style={styles.libraryTitle}>Sound Library</Text>
          {MEDITATION_TRACKS.map((track) => {
            const isSelected = track.id === selectedTrackId;
            return (
              <Pressable
                key={track.id}
                style={[styles.trackCard, isSelected && styles.trackCardSelected]}
                accessibilityRole="button"
                accessibilityLabel={`Select ${track.title}`}
                onPress={() => onSelectTrack(track)}
              >
                <View style={styles.trackMeta}>
                  <Text style={[styles.trackTitle, isSelected && styles.trackTitleSelected]}>
                    {track.title}
                  </Text>
                  <Text style={styles.trackSubtitle}>
                    {track.localAsset ? "Local file ready" : track.subtitle}
                  </Text>
                </View>
                <View
                  style={[
                    styles.dot,
                    isSelected && styles.dotActive,
                    !track.localAsset && styles.dotPending,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 18,
  },
  subtitle: {
    color: colors.lightGray,
    fontSize: 16,
    textAlign: "center",
    fontFamily: "Quicksand-Regular",
  },
  visualizerShell: {
    marginTop: 6,
    borderRadius: 24,
    backgroundColor: "#2f4356",
    borderWidth: 1,
    borderColor: "rgba(85,230,193,0.4)",
    overflow: "hidden",
    paddingVertical: 22,
    alignItems: "center",
  },
  visualizerGlow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(85,230,193,0.07)",
    top: -120,
  },
  visualizerBars: {
    width: "100%",
    maxWidth: 260,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    minHeight: 100,
  },
  visualizerBar: {
    width: 26,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  visualizerCaption: {
    marginTop: 14,
    color: colors.lightGray,
    fontSize: 14,
    fontFamily: "Quicksand-Regular",
  },
  nowPlayingCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  nowPlayingTextWrap: {
    flex: 1,
  },
  nowPlayingLabel: {
    color: colors.lightGray,
    fontSize: 13,
    fontFamily: "Quicksand-Regular",
  },
  nowPlayingTitle: {
    color: "white",
    fontSize: 18,
    fontFamily: "Quicksand-Bold",
    marginTop: 2,
  },
  controlRow: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
  },
  controlButton: {
    borderRadius: 18,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  playButton: {
    flex: 2,
    backgroundColor: colors.primary,
  },
  playButtonDisabled: {
    opacity: 0.55,
  },
  repeatButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "transparent",
  },
  repeatButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  playText: {
    color: colors.dark,
    fontSize: 18,
    fontFamily: "Quicksand-Bold",
  },
  repeatText: {
    color: colors.primary,
    fontSize: 16,
    fontFamily: "Quicksand-Bold",
  },
  timelineCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(178,190,195,0.35)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
  },
  timelineLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timelineText: {
    color: colors.lightGray,
    fontSize: 12,
    fontFamily: "Quicksand-Regular",
  },
  librarySection: {
    marginTop: 4,
    gap: 10,
  },
  libraryTitle: {
    color: "white",
    fontSize: 20,
    fontFamily: "Quicksand-Bold",
    marginBottom: 4,
  },
  trackCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "transparent",
  },
  trackCardSelected: {
    borderColor: colors.primary,
    backgroundColor: "#2f4f53",
  },
  trackMeta: {
    flex: 1,
    paddingRight: 12,
  },
  trackTitle: {
    color: "white",
    fontSize: 17,
    fontFamily: "Quicksand-Bold",
  },
  trackTitleSelected: {
    color: colors.primary,
  },
  trackSubtitle: {
    color: colors.lightGray,
    fontSize: 13,
    fontFamily: "Quicksand-Regular",
    marginTop: 3,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(178,190,195,0.55)",
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  dotPending: {
    opacity: 0.5,
  },
});

export default MeditationScreen;
