// src/screens/MeasureScreen.tsx
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
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import {
  ArrowLeft,
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
} from "react-native-vision-camera";
import { runOnJS } from "react-native-reanimated";
import { initDB } from "../utils/db";

const WINDOW_SIZE = 60;
const MEASUREMENT_DURATION = 20000;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const MeasureScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  // --- LOGIC UNCHANGED ---
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

  const isMeasuringRef = useRef(false);
  const signalBuffer = useRef<number[]>([]);
  const lastBeatTime = useRef<number>(0);
  const beats = useRef<number[]>([]);
  const jsStartTime = useRef<number>(0);
  const lastValueRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission]);

  const saveMeasurement = async (value: number) => {
    try {
      const db = await initDB();
      await db.runAsync("INSERT INTO measurements (bpm) VALUES (?);", [value]);
    } catch (error) {
      console.error("Failed to save measurement:", error);
    }
  };

  const onMeasurementFinished = useCallback(async (finalBpm: number | null) => {
    setMeasuring(false);
    isMeasuringRef.current = false;
    setFinished(true);
    setBpm(finalBpm || 0);
    setProgress(1);
    if (finalBpm && finalBpm > 0) await saveMeasurement(finalBpm);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const processFrameData = useCallback(
    (brightness: number) => {
      if (!isMeasuringRef.current) return;
      const now = Date.now();
      if (jsStartTime.current > 0) {
        const elapsed = now - jsStartTime.current;
        const smoothedBrightness =
          lastValueRef.current * 0.8 + brightness * 0.2;
        lastValueRef.current = smoothedBrightness;
        signalBuffer.current.push(smoothedBrightness);
        if (signalBuffer.current.length > WINDOW_SIZE)
          signalBuffer.current.shift();
        if (signalBuffer.current.length >= WINDOW_SIZE && elapsed > 2000) {
          const min = Math.min(...signalBuffer.current);
          const max = Math.max(...signalBuffer.current);
          const range = max - min;
          if (range > 0.5) {
            const threshold = min + range * 0.65;
            const currentVal =
              signalBuffer.current[signalBuffer.current.length - 1];
            const prevVal =
              signalBuffer.current[signalBuffer.current.length - 2];
            if (currentVal >= threshold && prevVal < threshold) {
              const timeSinceLastBeat = now - lastBeatTime.current;
              if (lastBeatTime.current === 0) {
                lastBeatTime.current = now;
              } else if (timeSinceLastBeat > 330 && timeSinceLastBeat < 1500) {
                beats.current.push(timeSinceLastBeat);
                if (beats.current.length > 10) beats.current.shift();
                if (beats.current.length >= 3) {
                  const sortedBeats = [...beats.current].sort((a, b) => a - b);
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
                  const avgInterval = sum / count;
                  setBpm(Math.round(60000 / avgInterval));
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                lastBeatTime.current = now;
              } else if (timeSinceLastBeat >= 1500) {
                lastBeatTime.current = now;
              }
            }
          }
        }
        if (elapsed > MEASUREMENT_DURATION) {
          let finalValue = 0;
          if (beats.current.length >= 4) {
            const sortedBeats = [...beats.current].sort((a, b) => a - b);
            const midBeats = sortedBeats.slice(1, -1);
            const avgInterval =
              midBeats.reduce((a, b) => a + b, 0) / midBeats.length;
            finalValue = Math.round(60000 / avgInterval);
          }
          onMeasurementFinished(finalValue);
        }
      }
    },
    [onMeasurementFinished],
  );

  const frameOutput = useFrameOutput({
    onFrame: (frame: any) => {
      "worklet";
      if (!frame.isValid) return;
      try {
        const buffer = frame.getPixelBuffer();
        const data = new Uint8Array(buffer);
        let sum = 0;
        const sampleCount = 200;
        const step = Math.floor(data.length / (3 * sampleCount));
        for (let i = 0; i < sampleCount; i++) sum += data[i * step];
        runOnJS(processFrameData)(sum / sampleCount);
      } catch (e) {
      } finally {
        frame.dispose();
      }
    },
    pixelFormat: "yuv",
  });

  const startMeasurement = () => {
    if (!hasPermission || !device) return;
    signalBuffer.current = [];
    beats.current = [];
    lastBeatTime.current = 0;
    lastValueRef.current = 0;
    setProgress(0);
    setMeasuring(true);
    isMeasuringRef.current = true;
    setFinished(false);
    setBpm(0);
    jsStartTime.current = Date.now();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - jsStartTime.current;
      const p = Math.min(elapsed / MEASUREMENT_DURATION, 1);
      setProgress(p);
      if (p >= 1) clearInterval(timerRef.current!);
    }, 100);
  };
  // --- END UNCHANGED LOGIC ---

  const showIPhoneTip = () => {
    Alert.alert(
      "iPhone Connection Tip",
      "If you see 'No developer servers found', ensure both devices are on the same Wi-Fi or use 'npx expo start --tunnel'.",
      [{ text: "OK" }],
    );
  };

  // Standard hitSlop for accessibility
  const hitSlop = { top: 15, bottom: 15, left: 15, right: 15 };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* REFACTORED HEADER: Flex-based for consistent press areas */}
      <View style={styles.header}>
        <View style={styles.headerSideContainer}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.iconButton}
            hitSlop={hitSlop}
          >
            <ArrowLeft color="#55E6C1" size={28} />
          </Pressable>
        </View>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>BPM Reader</Text>
        </View>

        <View style={[styles.headerSideContainer, styles.headerActions]}>
          <Pressable
            onPress={() => navigation.navigate("History")}
            style={styles.iconButton}
            hitSlop={hitSlop}
          >
            <History color="#B2BEC3" size={24} />
          </Pressable>
          <Pressable
            onPress={showIPhoneTip}
            style={styles.iconButton}
            hitSlop={hitSlop}
          >
            <Info color="#B2BEC3" size={24} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
            /* @ts-ignore */
            <Camera
              key={device.id}
              style={styles.camera}
              device={device}
              isActive={true}
              torchMode={measuring ? "on" : "off"}
              video={true}
              outputs={[frameOutput]}
            />
          ) : (
            <CameraOff color="#B2BEC3" size={32} />
          )}
        </View>

        <Text style={styles.instructionText}>
          {measuring
            ? "Keep your finger steady over the camera lens and flash..."
            : "Place your finger over the camera and flash, then press Start."}
        </Text>

        <TouchableOpacity
          style={[
            styles.mainButton,
            measuring && { backgroundColor: "#d63031" },
          ]}
          onPress={
            measuring
              ? () => {
                  setMeasuring(false);
                  isMeasuringRef.current = false;
                  if (timerRef.current) clearInterval(timerRef.current);
                }
              : startMeasurement
          }
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
  // Header refactored to use Flexbox instead of Absolute positioning
  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  headerSideContainer: {
    width: 80, // Fixed width ensures the center title stays centered
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  headerActions: {
    justifyContent: "flex-end",
    gap: 8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: "white", fontSize: 22, fontFamily: "Quicksand-Bold" },
  scrollContent: { padding: 24, alignItems: "center" },
  vitalsCard: {
    backgroundColor: "#34495e",
    width: "100%",
    borderRadius: 30,
    padding: 40,
    alignItems: "center",
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
