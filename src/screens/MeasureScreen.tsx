import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import {
  HeartPulse,
  CameraOff,
  Info,
  History,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import {
  Camera,
  useCameraDevices,
  useCameraPermission,
  useFrameOutput,
  type Frame,
} from "react-native-vision-camera";
import { runOnJS } from "react-native-reanimated";
import { initDB } from "../utils/db";
import AppHeader from "../components/AppHeader";

const WINDOW_SIZE = 60;
const MEASUREMENT_DURATION = 20_000;
const ANALYSIS_INTERVAL_MS = 66; // ~15Hz
const WORKLET_SAMPLE_EVERY_N_FRAMES = 3;
const MIN_SIGNAL_RANGE = 0.5; // Very permissive; avoid false "weak signal" states
const BPM_UI_UPDATE_INTERVAL_MS = 350;
const HAPTIC_MIN_INTERVAL_MS = 900;
const LOW_SIGNAL_GRACE_MS = 10_000;
const LOW_SIGNAL_CONSECUTIVE_FRAMES = 120; // ~8s at 15Hz
const LOW_COVERAGE_LUMA_THRESHOLD = 40;

type SignalQuality = "searching" | "good" | "low";
type BeatPolarity = -1 | 0 | 1;

const MeasureScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const devices = useCameraDevices();
  const device = useMemo(() => {
    return (
      devices.find((d) => d.position === "back" && d.hasTorch) ||
      devices.find((d) => d.position === "back")
    );
  }, [devices]);

  const { hasPermission, requestPermission } = useCameraPermission();
  const [measuring, setMeasuring] = useState(false);
  const [finished, setFinished] = useState(false);
  const [bpm, setBpm] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [signalQuality, setSignalQuality] =
    useState<SignalQuality>("searching");

  const isMeasuringRef = useRef(false);
  const signalBuffer = useRef<number[]>([]);
  const lastBeatTime = useRef<number>(0);
  const beats = useRef<number[]>([]);
  const jsStartTime = useRef<number>(0);
  const lastValueRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAnalysisTsRef = useRef(0);
  const lowSignalFramesRef = useRef(0);
  const signalQualityRef = useRef<SignalQuality>("searching");
  const beatPolarityRef = useRef<BeatPolarity>(0);
  const lastBpmUiUpdateRef = useRef(0);
  const lastHapticTsRef = useRef(0);
  const hasCreatedAtColumnRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  const clearProgressTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearProgressTimer();
      isMeasuringRef.current = false;
    };
  }, [clearProgressTimer]);

  const saveMeasurement = async (value: number) => {
    try {
      const db = await initDB();
      if (hasCreatedAtColumnRef.current === null) {
        const schemaRows = await db.getAllAsync<{ name: string }>(
          "PRAGMA table_info(measurements);",
        );
        hasCreatedAtColumnRef.current = schemaRows.some(
          (row) => row.name === "created_at",
        );
      }

      if (hasCreatedAtColumnRef.current) {
        // Persist local wall-clock time so History renders in device-local time.
        await db.runAsync(
          "INSERT INTO measurements (bpm, created_at) VALUES (?, datetime('now', 'localtime'));",
          [value],
        );
      } else {
        await db.runAsync("INSERT INTO measurements (bpm) VALUES (?);", [
          value,
        ]);
      }
    } catch (error) {
      console.error("Failed to save measurement:", error);
    }
  };

  const setSignalQualitySafe = useCallback((quality: SignalQuality) => {
    if (signalQualityRef.current === quality) return;
    signalQualityRef.current = quality;
    setSignalQuality(quality);
  }, []);

  const stopMeasurement = useCallback(() => {
    setMeasuring(false);
    isMeasuringRef.current = false;
    clearProgressTimer();
  }, [clearProgressTimer]);

  const onMeasurementFinished = useCallback(
    async (finalBpm: number | null) => {
      stopMeasurement();
      setFinished(true);
      setBpm(finalBpm || 0);
      setProgress(1);
      if (finalBpm && finalBpm > 0) await saveMeasurement(finalBpm);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [stopMeasurement],
  );

  const processFrameData = useCallback(
    (brightness: number) => {
      if (!isMeasuringRef.current) return;
      const now = Date.now();
      if (now - lastAnalysisTsRef.current < ANALYSIS_INTERVAL_MS) return;
      lastAnalysisTsRef.current = now;

      if (jsStartTime.current <= 0) return;
      const elapsed = now - jsStartTime.current;

      const smoothedBrightness =
        lastValueRef.current * 0.75 + brightness * 0.25;
      lastValueRef.current = smoothedBrightness;
      signalBuffer.current.push(smoothedBrightness);
      if (signalBuffer.current.length > WINDOW_SIZE)
        signalBuffer.current.shift();

      if (signalBuffer.current.length >= WINDOW_SIZE && elapsed > 2000) {
        const min = Math.min(...signalBuffer.current);
        const max = Math.max(...signalBuffer.current);
        const range = max - min;
        const mean =
          signalBuffer.current.reduce((acc, value) => acc + value, 0) /
          signalBuffer.current.length;
        const variance =
          signalBuffer.current.reduce((acc, value) => {
            const d = value - mean;
            return acc + d * d;
          }, 0) / signalBuffer.current.length;
        const stdDev = Math.sqrt(variance);

        const hasCoverage = smoothedBrightness >= LOW_COVERAGE_LUMA_THRESHOLD;
        const hasPulseEvidence = beats.current.length > 0;
        const hasOscillation = range > MIN_SIGNAL_RANGE || stdDev > 0.2;

        if (hasOscillation || hasPulseEvidence) {
          lowSignalFramesRef.current = 0;
          setSignalQualitySafe("good");

          if (signalBuffer.current.length >= 3) {
            const currentVal =
              signalBuffer.current[signalBuffer.current.length - 1];
            const prevVal =
              signalBuffer.current[signalBuffer.current.length - 2];
            const prevPrevVal =
              signalBuffer.current[signalBuffer.current.length - 3];
            const currentDetrended = currentVal - mean;
            const prevDetrended = prevVal - mean;
            const prevPrevDetrended = prevPrevVal - mean;

            const localMax =
              prevDetrended > prevPrevDetrended &&
              prevDetrended >= currentDetrended;
            const localMin =
              prevDetrended < prevPrevDetrended &&
              prevDetrended <= currentDetrended;
            const extremumAmplitude = Math.abs(prevDetrended);
            const amplitudeThreshold = Math.max(stdDev * 0.6, 0.08);

            if (extremumAmplitude >= amplitudeThreshold) {
              if (beatPolarityRef.current === 0) {
                beatPolarityRef.current = prevDetrended >= 0 ? 1 : -1;
              }

              const isBeatCandidate =
                (beatPolarityRef.current === 1 && localMax) ||
                (beatPolarityRef.current === -1 && localMin);

              if (isBeatCandidate) {
                const timeSinceLastBeat = now - lastBeatTime.current;

                if (lastBeatTime.current === 0) {
                  lastBeatTime.current = now;
                } else if (
                  timeSinceLastBeat > 330 &&
                  timeSinceLastBeat < 1500
                ) {
                  beats.current.push(timeSinceLastBeat);
                  if (beats.current.length > 10) beats.current.shift();

                  if (beats.current.length >= 3) {
                    const sortedBeats = [...beats.current].sort(
                      (a, b) => a - b,
                    );
                    let sum = 0;
                    let count = 0;
                    const startIdx = beats.current.length > 5 ? 1 : 0;
                    const endIdx =
                      beats.current.length > 5
                        ? sortedBeats.length - 1
                        : sortedBeats.length;

                    for (let i = startIdx; i < endIdx; i++) {
                      sum += sortedBeats[i];
                      count++;
                    }

                    if (count > 0) {
                      const avgInterval = sum / count;
                      const nextBpm = Math.round(60000 / avgInterval);
                      if (
                        now - lastBpmUiUpdateRef.current >=
                        BPM_UI_UPDATE_INTERVAL_MS
                      ) {
                        setBpm(nextBpm);
                        lastBpmUiUpdateRef.current = now;
                      }
                      if (
                        now - lastHapticTsRef.current >=
                        HAPTIC_MIN_INTERVAL_MS
                      ) {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        lastHapticTsRef.current = now;
                      }
                    }
                  }
                  lastBeatTime.current = now;
                } else if (timeSinceLastBeat >= 1500) {
                  lastBeatTime.current = now;
                }
              }
            }
          }
        } else {
          lowSignalFramesRef.current += 1;
          if (
            elapsed > LOW_SIGNAL_GRACE_MS &&
            lowSignalFramesRef.current >= LOW_SIGNAL_CONSECUTIVE_FRAMES &&
            !hasCoverage &&
            !hasPulseEvidence
          ) {
            setSignalQualitySafe("low");
          } else if (signalQualityRef.current === "low") {
            setSignalQualitySafe("searching");
          }
        }
      }

      if (elapsed > MEASUREMENT_DURATION) {
        let finalValue = 0;
        if (beats.current.length >= 4) {
          const sortedBeats = [...beats.current].sort((a, b) => a - b);
          const midBeats = sortedBeats.slice(1, -1);
          if (midBeats.length > 0) {
            const avgInterval =
              midBeats.reduce((a, b) => a + b, 0) / midBeats.length;
            finalValue = Math.round(60000 / avgInterval);
          }
        }
        onMeasurementFinished(finalValue);
      }
    },
    [onMeasurementFinished, setSignalQualitySafe],
  );

  const frameOutput = useFrameOutput({
    onFrame: (frame: Frame) => {
      "worklet";
      if (!frame.isValid) return;

      try {
        const state = globalThis as typeof globalThis & {
          __ppgFrameCounter?: number;
        };
        const frameCounter = (state.__ppgFrameCounter ?? 0) + 1;
        state.__ppgFrameCounter = frameCounter;
        if (frameCounter % WORKLET_SAMPLE_EVERY_N_FRAMES !== 0) return;

        let averageLuma = -1;

        if (frame.isPlanar) {
          const planes = frame.getPlanes();
          const yPlane = planes[0];
          if (yPlane?.isValid) {
            const yBytes = new Uint8Array(yPlane.getPixelBuffer());
            const width = yPlane.width;
            const height = yPlane.height;
            const rowStride = yPlane.bytesPerRow;

            if (width > 0 && height > 0 && rowStride > 0) {
              // Center ROI tends to be more stable than full-frame averaging for finger PPG.
              const roiW = Math.max(8, Math.floor(width * 0.35));
              const roiH = Math.max(8, Math.floor(height * 0.35));
              const startX = Math.floor((width - roiW) / 2);
              const startY = Math.floor((height - roiH) / 2);
              const stepX = Math.max(1, Math.floor(roiW / 18));
              const stepY = Math.max(1, Math.floor(roiH / 18));

              let sum = 0;
              let count = 0;
              for (let y = startY; y < startY + roiH; y += stepY) {
                const rowOffset = y * rowStride;
                for (let x = startX; x < startX + roiW; x += stepX) {
                  sum += yBytes[rowOffset + x];
                  count += 1;
                }
              }

              if (count > 0) averageLuma = sum / count;
            }
          }
        } else {
          const data = new Uint8Array(frame.getPixelBuffer());
          if (data.length > 0) {
            let sum = 0;
            const sampleCount = 256;
            const step = Math.max(1, Math.floor(data.length / sampleCount));
            for (let i = 0; i < sampleCount; i++) sum += data[i * step];
            averageLuma = sum / sampleCount;
          }
        }

        if (averageLuma >= 0) {
          runOnJS(processFrameData)(averageLuma);
        }
      } catch (error) {
        // Intentionally ignored to keep measurement resilient.
      } finally {
        frame.dispose();
      }
    },
    pixelFormat: "yuv",
    dropFramesWhileBusy: true,
    enablePreviewSizedOutputBuffers: true,
  });

  const startMeasurement = () => {
    if (!hasPermission || !device) return;

    signalBuffer.current = [];
    beats.current = [];
    lastBeatTime.current = 0;
    beatPolarityRef.current = 0;
    lastValueRef.current = 0;
    lastAnalysisTsRef.current = 0;
    lowSignalFramesRef.current = 0;
    lastBpmUiUpdateRef.current = 0;
    lastHapticTsRef.current = 0;

    setSignalQualitySafe("searching");
    setProgress(0);
    setMeasuring(true);
    isMeasuringRef.current = true;
    setFinished(false);
    setBpm(0);
    jsStartTime.current = Date.now();

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    clearProgressTimer();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - jsStartTime.current;
      const p = Math.min(elapsed / MEASUREMENT_DURATION, 1);
      setProgress(p);
      if (p >= 1) clearProgressTimer();
    }, 100);
  };

  const showIPhoneTip = () => {
    Alert.alert(
      "iPhone Connection Tip",
      "If you see 'No developer servers found', ensure both devices are on the same Wi-Fi or use 'npx expo start --tunnel'.",
      [{ text: "OK" }],
    );
  };

  const hitSlop = { top: 15, bottom: 15, left: 15, right: 15 };

  return (
    <View style={styles.container}>
      <AppHeader
        title="BPM Reader"
        onBackPress={() => navigation.goBack()}
        rightSlot={(
          <View style={styles.headerSideRightGroup}>
            <Pressable
              onPress={() => navigation.navigate("History")}
              style={styles.headerIconButton}
              hitSlop={hitSlop}
            >
              <History color="#B2BEC3" size={24} pointerEvents="none" />
            </Pressable>
            <Pressable
              onPress={showIPhoneTip}
              style={styles.headerIconButton}
              hitSlop={hitSlop}
            >
              <Info color="#B2BEC3" size={24} pointerEvents="none" />
            </Pressable>
          </View>
        )}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.vitalsCard}>
          <HeartPulse color={measuring ? "#ff7675" : "#55E6C1"} size={48} />
          <Text style={styles.bpmText}>
            {bpm !== null && bpm > 0 ? bpm : "--"}
          </Text>
          <Text style={styles.unitText}>BPM</Text>
        </View>

        {measuring && (
          <View style={styles.progressContainer}>
            <View
              style={[styles.progressBar, { width: `${progress * 100}%` }]}
            />
          </View>
        )}

        <View style={styles.cameraContainer}>
          {hasPermission && device ? (
            <Camera
              key={device.id}
              style={styles.camera}
              device={device}
              isActive={true}
              torchMode={measuring ? "on" : "off"}
              outputs={[frameOutput]}
            />
          ) : (
            <CameraOff color="#B2BEC3" size={32} />
          )}
        </View>

        <Text style={styles.instructionText}>
          {measuring
            ? signalQuality === "low"
              ? "Signal is weak. Cover lens/flash fully and keep pressure steady."
              : "Keep your finger steady over the camera lens and flash..."
            : finished
              ? "Reading complete. You can start again any time."
              : "Place your finger over the camera and flash, then press Start."}
        </Text>

        <TouchableOpacity
          style={[
            styles.mainButton,
            measuring && { backgroundColor: "#d63031" },
          ]}
          onPress={measuring ? stopMeasurement : startMeasurement}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>
            {measuring ? "Cancel" : "Start Reading"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#2D3436" },
  headerSideRightGroup: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  vitalsCard: {
    backgroundColor: "#34495e",
    width: "100%",
    borderRadius: 30,
    padding: 40,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 24,
  },
  bpmText: {
    color: "white",
    fontSize: 72,
    fontFamily: "Quicksand-Bold",
    marginTop: 10,
  },
  unitText: { color: "#B2BEC3", fontSize: 18, fontFamily: "Quicksand-Regular" },
  progressContainer: {
    width: "100%",
    height: 6,
    backgroundColor: "#34495e",
    borderRadius: 3,
    marginBottom: 32,
    overflow: "hidden",
  },
  progressBar: { height: "100%", backgroundColor: "#55E6C1" },
  cameraContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
    marginBottom: 24,
    backgroundColor: "black",
  },
  camera: { flex: 1 },
  instructionText: {
    color: "#B2BEC3",
    fontSize: 16,
    fontFamily: "Quicksand-Regular",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  mainButton: {
    backgroundColor: "#55E6C1",
    width: "100%",
    paddingVertical: 20,
    borderRadius: 20,
    alignItems: "center",
  },
  buttonText: { color: "#2D3436", fontSize: 18, fontFamily: "Quicksand-Bold" },
});

export default MeasureScreen;
