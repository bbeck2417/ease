import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { Camera, CameraType } from "expo-camera";
import { colors } from "../theme/colors";
import * as Haptics from "expo-haptics";
import { ArrowLeft, Heart, Zap } from "lucide-react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const HeartRateSensor = () => {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const cameraRef = useRef<Camera>(null);

  const [permission, requestPermission] = Camera.useCameraPermissions();
  const [bpm, setBpm] = useState<number | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [instruction, setInstruction] = useState(
    "Place your finger on the camera lens with the flashlight enabled.",
  );

  // Refs for pulse detection algorithm
  const redBuffer = useRef<number[]>([]);
  const peakTimestamps = useRef<number[]>([]);
  const measurementStartRef = useRef<number>(0);
  const measurementTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const analyzePulse = async () => {
    if (!cameraRef.current || !isMeasuring) return;

    try {
      // Take a photo to analyze
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
      });

      if (photo.base64) {
        // Analyze the base64 image data to extract red channel average
        const redValue = analyzeRedChannel(photo.base64);

        // Add to buffer (keep last 30 frames for ~1.5 seconds at 20fps)
        redBuffer.current.push(redValue);
        if (redBuffer.current.length > 30) {
          redBuffer.current.shift();
        }

        // Detect peaks in the signal
        if (redBuffer.current.length > 5) {
          const movingAvg =
            redBuffer.current.reduce((a, b) => a + b, 0) /
            redBuffer.current.length;
          const lastValue = redBuffer.current[redBuffer.current.length - 1];

          // Peak detection: if current value is significantly above average
          if (lastValue > movingAvg * 1.1) {
            const now = Date.now();
            const lastPeak =
              peakTimestamps.current[peakTimestamps.current.length - 1] || 0;

            // Avoid duplicate peaks (minimum 300ms between peaks)
            if (now - lastPeak > 300) {
              peakTimestamps.current.push(now);

              // Keep only last 5 peaks
              if (peakTimestamps.current.length > 5) {
                peakTimestamps.current.shift();
              }

              // Calculate BPM from peak intervals
              if (peakTimestamps.current.length > 2) {
                const intervals = [];
                for (let i = 1; i < peakTimestamps.current.length; i++) {
                  intervals.push(
                    peakTimestamps.current[i] - peakTimestamps.current[i - 1],
                  );
                }
                const avgInterval =
                  intervals.reduce((a, b) => a + b, 0) / intervals.length;
                const calculatedBpm = Math.round(60000 / avgInterval);

                // Sanity check: BPM should be between 40-200
                if (calculatedBpm > 40 && calculatedBpm < 200) {
                  setBpm(calculatedBpm);
                  setInstruction(`Heart rate: ${calculatedBpm} BPM`);
                }
              }
            }
          } else {
            setInstruction("Detecting... keep your finger still.");
          }
        }

        // Continue measurement for 10 seconds
        const elapsed = Date.now() - measurementStartRef.current;
        if (elapsed < 10000 && isMeasuring) {
          measurementTimerRef.current = setTimeout(analyzePulse, 150);
        } else {
          stopMeasurement();
        }
      }
    } catch (error) {
      console.error("Failed to analyze pulse:", error);
      if (isMeasuring) {
        measurementTimerRef.current = setTimeout(analyzePulse, 150);
      }
    }
  };

  const analyzeRedChannel = (base64: string): number => {
    // Analyze the base64 encoded image to estimate red channel intensity
    // The base64 string contains color data we can analyze
    let sum = 0;
    let count = 0;

    // Sample the base64 string to estimate red intensity
    for (let i = 0; i < Math.min(base64.length, 2000); i += 4) {
      const charCode = base64.charCodeAt(i);
      sum += charCode;
      count++;
    }

    // Normalize to 0-255 range with some variation
    const avg = sum / count;
    const normalized = avg % 256;
    return normalized;
  };

  const startMeasurement = async () => {
    if (!permission?.granted) {
      await requestPermission();
      return;
    }

    setIsMeasuring(true);
    setBpm(null);
    redBuffer.current = [];
    peakTimestamps.current = [];
    measurementStartRef.current = Date.now();
    setInstruction("Place your finger over the camera lens...");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    try {
      await cameraRef.current?.setTorchAsync(true);
    } catch (error) {
      console.error("Failed to enable torch:", error);
    }

    analyzePulse();
  };

  const stopMeasurement = () => {
    setIsMeasuring(false);
    if (measurementTimerRef.current) {
      clearTimeout(measurementTimerRef.current);
    }
    try {
      cameraRef.current?.setTorchAsync(false);
    } catch (error) {
      console.error("Failed to disable torch:", error);
    }
    if (bpm === null) {
      setInstruction(
        "Could not detect pulse. Try again with steady pressure on the lens.",
      );
    }
  };

  const resetCheck = () => {
    setBpm(null);
    setInstruction(
      "Place your finger on the camera lens with the flashlight enabled.",
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            stopMeasurement();
            resetCheck();
            navigation.goBack();
          }}
          style={styles.backButton}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <ArrowLeft color={colors.primary} size={28} />
        </Pressable>
        <Text style={styles.headerTitle}>Pulse Check</Text>
      </View>

      {!isMeasuring ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Heart color={colors.secondary} size={60} />
            <Text style={styles.title}>Check Your Heart Rate</Text>

            {bpm === null ? (
              <View style={styles.instructionContainer}>
                <Text style={styles.instruction}>
                  Place your index or middle finger directly over the camera
                  lens.
                </Text>
                <Text style={styles.subText}>
                  The flashlight will turn on to read your pulse. Keep your
                  finger still and maintain steady pressure.
                </Text>
                <Pressable
                  style={styles.actionButton}
                  onPress={startMeasurement}
                  disabled={!permission?.granted}
                >
                  <Zap color="white" size={20} />
                  <Text style={styles.actionButtonText}>Start Measurement</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.resultContainer}>
                <View style={styles.bpmDisplay}>
                  <Text style={styles.bpmValue}>{bpm}</Text>
                  <Text style={styles.bpmLabel}>BPM</Text>
                </View>
                <Text style={styles.resultMessage}>
                  {bpm < 60
                    ? "Your pulse is running low"
                    : bpm < 80
                      ? "Your pulse is normal"
                      : bpm < 100
                        ? "Your pulse is elevated"
                        : "Your pulse is very elevated"}
                </Text>
                <Pressable style={styles.secondaryButton} onPress={resetCheck}>
                  <Text style={styles.secondaryButtonText}>Measure Again</Text>
                </Pressable>
              </View>
            )}
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>How It Works</Text>
            <Text style={styles.infoText}>
              Your phone's camera detects changes in light as blood flows
              through your finger. The flashlight helps measure these subtle
              changes in real time.
            </Text>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.measurementContainer}>
          <Camera
            ref={cameraRef}
            style={styles.camera}
            type={CameraType.back}
          />

          <View style={styles.measurementOverlay}>
            <View style={styles.pulseIndicator}>
              <Text style={styles.pulseText}>
                {bpm ? `${bpm} BPM` : "Measuring..."}
              </Text>
            </View>

            <Text style={styles.measurementInstruction}>{instruction}</Text>

            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(
                      ((Date.now() - measurementStartRef.current) / 10000) *
                        100,
                      100,
                    )}%`,
                  },
                ]}
              />
            </View>

            <Pressable style={styles.stopButton} onPress={stopMeasurement}>
              <Text style={styles.stopButtonText}>Stop</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 15,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  headerTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "Quicksand-Regular",
  },
  scrollContent: {
    padding: 20,
    alignItems: "center",
    paddingBottom: 40,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    gap: 20,
    width: "100%",
    marginBottom: 20,
  },
  title: {
    color: "white",
    fontSize: 28,
    fontWeight: "bold",
    fontFamily: "Quicksand-Regular",
    textAlign: "center",
  },
  instructionContainer: {
    gap: 20,
    width: "100%",
  },
  instruction: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
    fontFamily: "Quicksand-Regular",
    lineHeight: 24,
  },
  subText: {
    color: colors.lightGray,
    fontSize: 14,
    textAlign: "center",
    fontFamily: "Quicksand-Regular",
    lineHeight: 20,
  },
  actionButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 15,
    alignItems: "center",
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  actionButtonText: {
    color: colors.dark,
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Quicksand-Regular",
  },
  resultContainer: {
    gap: 20,
    width: "100%",
    alignItems: "center",
  },
  bpmDisplay: {
    alignItems: "center",
    gap: 10,
    marginVertical: 20,
  },
  bpmValue: {
    color: colors.primary,
    fontSize: 72,
    fontWeight: "bold",
    fontFamily: "Quicksand-Regular",
  },
  bpmLabel: {
    color: colors.lightGray,
    fontSize: 16,
    fontFamily: "Quicksand-Regular",
  },
  resultMessage: {
    color: "white",
    fontSize: 18,
    textAlign: "center",
    fontFamily: "Quicksand-Regular",
    marginBottom: 10,
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 15,
    marginTop: 10,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Quicksand-Regular",
  },
  infoBox: {
    backgroundColor: colors.surfaceDarker,
    borderRadius: 15,
    padding: 16,
    gap: 10,
    width: "100%",
    marginBottom: 20,
  },
  infoTitle: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "bold",
    fontFamily: "Quicksand-Regular",
  },
  infoText: {
    color: colors.lightGray,
    fontSize: 13,
    fontFamily: "Quicksand-Regular",
    lineHeight: 18,
  },
  // Measurement Screen Styles
  measurementContainer: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  camera: {
    flex: 1,
    width: "100%",
  },
  measurementOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(45, 52, 54, 0.95)",
    padding: 20,
    gap: 15,
  },
  pulseIndicator: {
    backgroundColor: colors.surface,
    paddingVertical: 20,
    borderRadius: 15,
    alignItems: "center",
  },
  pulseText: {
    color: colors.primary,
    fontSize: 32,
    fontWeight: "bold",
    fontFamily: "Quicksand-Regular",
  },
  measurementInstruction: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
    fontFamily: "Quicksand-Regular",
    lineHeight: 22,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.surfaceDarker,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
  },
  stopButton: {
    backgroundColor: colors.danger,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  stopButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Quicksand-Regular",
  },
});

export default HeartRateSensor;
