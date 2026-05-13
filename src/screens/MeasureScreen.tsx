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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft, HeartPulse, CameraOff, Info } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import {
  Camera,
  useCameraDevices,
  useCameraPermission,
  useFrameOutput,
} from "react-native-vision-camera";
import { runOnJS } from "react-native-reanimated";

const WINDOW_SIZE = 60; // Increased window for better baseline tracking
const MEASUREMENT_DURATION = 20000; // 20 seconds for stability

const MeasureScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const devices = useCameraDevices();
  const device = useMemo(() => {
    return devices.find((d) => d.position === "back" && d.hasTorch) || 
           devices.find((d) => d.position === "back");
  }, [devices]);

  const { hasPermission, requestPermission } = useCameraPermission();

  const [measuring, setMeasuring] = useState(false);
  const [finished, setFinished] = useState(false);
  const [bpm, setBpm] = useState<number | null>(null);

  useEffect(() => {
    if (device) {
      console.log(`Selected Device: ${device.id}, hasTorch: ${device.hasTorch}`);
    }
  }, [device]);

  const isMeasuringRef = useRef(false);
  const signalBuffer = useRef<number[]>([]);
  const lastBeatTime = useRef<number>(0);
  const beats = useRef<number[]>([]);
  const jsStartTime = useRef<number>(0);
  const lastValueRef = useRef<number>(0);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission]);

  const onMeasurementFinished = useCallback((finalBpm: number | null) => {
    setMeasuring(false);
    isMeasuringRef.current = false;
    setFinished(true);
    setBpm(finalBpm || 0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const processFrameData = useCallback(
    (brightness: number) => {
      if (!isMeasuringRef.current) return;
      const now = Date.now();

      if (jsStartTime.current > 0) {
        const elapsed = now - jsStartTime.current;
        
        // Smoother filter to reduce high-frequency noise
        const smoothedBrightness = lastValueRef.current * 0.8 + brightness * 0.2;
        lastValueRef.current = smoothedBrightness;

        signalBuffer.current.push(smoothedBrightness);
        if (signalBuffer.current.length > WINDOW_SIZE)
          signalBuffer.current.shift();

        // Need at least a full window and some warm-up time
        if (signalBuffer.current.length >= WINDOW_SIZE && elapsed > 2000) {
          const avg = signalBuffer.current.reduce((a, b) => a + b, 0) / signalBuffer.current.length;
          const min = Math.min(...signalBuffer.current);
          const max = Math.max(...signalBuffer.current);
          const range = max - min;

          // Adaptive thresholding: look for values crossing 65% of the range
          if (range > 0.5) { // Lowered range requirement to catch subtle beats
            const threshold = min + range * 0.65;
            const currentVal = signalBuffer.current[signalBuffer.current.length - 1];
            const prevVal = signalBuffer.current[signalBuffer.current.length - 2];

            // Rising edge detection
            if (currentVal >= threshold && prevVal < threshold) {
              const timeSinceLastBeat = now - lastBeatTime.current;
              
              // Standard human range: 40 BPM (1500ms) to 180 BPM (333ms)
              if (lastBeatTime.current === 0) {
                lastBeatTime.current = now;
              } else if (timeSinceLastBeat > 330 && timeSinceLastBeat < 1500) {
                beats.current.push(timeSinceLastBeat);
                
                // Keep longer history for a more stable average
                if (beats.current.length > 10) beats.current.shift();
                
                if (beats.current.length >= 3) {
                  const sortedBeats = [...beats.current].sort((a, b) => a - b);
                  // Use a trimmed mean (remove fastest/slowest) to ignore outliers
                  let sum = 0;
                  let count = 0;
                  const startIdx = beats.current.length > 5 ? 1 : 0;
                  const endIdx = beats.current.length > 5 ? sortedBeats.length - 1 : sortedBeats.length;
                  
                  for (let i = startIdx; i < endIdx; i++) {
                    sum += sortedBeats[i];
                    count++;
                  }
                  
                  const avgInterval = sum / count;
                  const currentBpm = Math.round(60000 / avgInterval);
                  setBpm(currentBpm);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                lastBeatTime.current = now;
              } else if (timeSinceLastBeat >= 1500) {
                // If we waited too long, reset the beat timer but don't count it
                lastBeatTime.current = now;
              }
            }
          }
        }

        if (elapsed > MEASUREMENT_DURATION) {
          let finalValue = 0;
          if (beats.current.length >= 4) {
            const sortedBeats = [...beats.current].sort((a, b) => a - b);
            const midBeats = sortedBeats.slice(1, -1); // Trim outliers
            const avgInterval = midBeats.reduce((a, b) => a + b, 0) / midBeats.length;
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
        const sampleCount = 200; // Increased sample count for better noise reduction
        const step = Math.floor(data.length / (3 * sampleCount));

        for (let i = 0; i < sampleCount; i++) {
          sum += data[i * step];
        }
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
    
    setMeasuring(true);
    isMeasuringRef.current = true;
    setFinished(false);
    setBpm(0);
    jsStartTime.current = Date.now();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const showIPhoneTip = () => {
    Alert.alert(
      "iPhone Connection Tip",
      "If you see 'No developer servers found' on iPhone, try:\n\n1. Ensure both devices are on the exact same Wi-Fi.\n2. Use 'npx expo start --tunnel' to bypass network restrictions.",
      [{ text: "OK" }]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ArrowLeft color="#55E6C1" size={28} />
        </Pressable>
        <Text style={styles.title}>BPM Reader</Text>
        <Pressable onPress={showIPhoneTip} style={styles.infoButton}>
          <Info color="#B2BEC3" size={24} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.vitalsCard}>
          <HeartPulse color={measuring ? "#ff7675" : "#55E6C1"} size={48} />
          <Text style={styles.bpmText}>{bpm !== null && bpm > 0 ? bpm : "--"}</Text>
          <Text style={styles.unitText}>BPM</Text>
        </View>

        <View style={styles.cameraContainer}>
          {hasPermission && device ? (
            /* @ts-ignore - bypassing the CameraViewProps conflict */
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
                }
              : startMeasurement
          }
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 60,
  },
  backButton: { position: "absolute", left: 20 },
  infoButton: { position: "absolute", right: 20 },
  title: { color: "white", fontSize: 24, fontFamily: "Quicksand-Bold" },
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
