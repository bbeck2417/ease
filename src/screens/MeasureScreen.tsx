// src/screens/MeasureScreen.tsx

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Pressable,
} from "react-native";
import { RootStackParamList } from "../../App";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft, Activity, Save, CameraOff } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from "react-native-vision-camera";
import { colors } from "../theme/colors";
import { initDB } from "../utils/db";

const screenWidth = Dimensions.get("window").width;

const MeasureScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  // Camera Hooks
  const device = useCameraDevice("back");
  const { hasPermission, requestPermission } = useCameraPermission();

  // State Machine
  const [measuring, setMeasuring] = useState(false);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);

  // Real Data
  const [bpm, setBpm] = useState<number | null>(null);

  // Request camera permissions on mount
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission]);

  const startMeasurement = () => {
    if (!hasPermission) {
      requestPermission();
      return;
    }

    setMeasuring(true);
    setFinished(false);
    setBpm(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // TODO: In the next step, we will attach the Frame Processor here
    // to actually read the red pixels and calculate the BPM.

    // For now, we simulate the 15-second timeout of the real camera reading
    setTimeout(() => {
      setMeasuring(false);
      setFinished(true);
      setBpm(74); // Placeholder until we attach the algorithm
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 15000);
  };

  const saveMeasurement = async () => {
    if (!bpm) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const db = await initDB();
      await db.runAsync(
        "INSERT INTO measurements (bpm, timestamp) VALUES (?, ?)",
        [bpm, new Date().toISOString()],
      );
      navigation.navigate("History");
    } catch (error) {
      console.error("Failed to save measurement:", error);
      navigation.navigate("History");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Absolute Back Button */}
      <Pressable
        style={[styles.headerLeftButton, { top: insets.top + 10, left: 16 }]}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
      >
        <ArrowLeft color={colors.primary} size={24} />
      </Pressable>

      <View style={styles.headerTitleContainer}>
        <Text style={styles.title}>Heart Rate Monitor</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* --- LIVE BPM DISPLAY --- */}
        <View style={styles.bpmContainer}>
          <Activity
            color={measuring ? colors.danger : colors.primary}
            size={40}
          />
          <Text style={styles.bpmNumber}>{bpm ? bpm : "--"}</Text>
          <Text style={styles.bpmLabel}>BPM</Text>
        </View>

        {/* --- INSTRUCTIONS --- */}
        <View style={styles.instructionCard}>
          <Text style={styles.instructionTitle}>How to measure</Text>
          <Text style={styles.instructionText}>
            1. Lightly cover the REAR CAMERA lens and flashlight with your
            fingertip.{"\n"}
            2. Do not press too hard, or you will restrict blood flow.{"\n"}
            3. Press start and hold still for 15 seconds.
          </Text>
        </View>

        {/* --- CAMERA FEED (Under the finger) --- */}
        <View style={styles.cameraWrapper}>
          {hasPermission && device ? (
            <Camera
              style={styles.camera}
              device={device}
              isActive={measuring}
              torch={measuring ? "on" : "off"}
              // frameProcessor={frameProcessor} <-- We will add this next!
            />
          ) : (
            <View style={styles.noCamera}>
              <CameraOff color="#636e72" size={32} />
              <Text style={styles.noCameraText}>Camera Access Required</Text>
            </View>
          )}

          {measuring && (
            <View style={styles.cameraOverlay}>
              <Text style={styles.readingText}>Detecting Pulse...</Text>
            </View>
          )}
        </View>

        {/* --- DYNAMIC BUTTON --- */}
        <View style={styles.actionContainer}>
          {!measuring && !finished && (
            <TouchableOpacity
              style={styles.buttonStart}
              onPress={startMeasurement}
            >
              <Text style={styles.buttonTextDark}>Start Measurement</Text>
            </TouchableOpacity>
          )}

          {measuring && (
            <TouchableOpacity
              style={styles.buttonStop}
              onPress={() => {
                setMeasuring(false);
                setBpm(null);
              }}
            >
              <Text style={styles.buttonTextLight}>Cancel</Text>
            </TouchableOpacity>
          )}

          {finished && (
            <View style={styles.finishedActions}>
              <TouchableOpacity
                style={styles.buttonSave}
                onPress={saveMeasurement}
                disabled={saving}
              >
                <Save color="#2D3436" size={20} />
                <Text style={styles.buttonTextDark}>
                  {saving ? "Saving..." : "Save to History"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.buttonRetry}
                onPress={startMeasurement}
              >
                <Text style={styles.buttonTextLight}>Measure Again</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2D3436",
  },
  headerLeftButton: {
    position: "absolute",
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    elevation: 10,
  },
  headerTitleContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    marginBottom: 10,
  },
  title: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "Quicksand-Bold",
  },
  content: {
    padding: 20,
    alignItems: "center",
    paddingBottom: 40,
  },
  bpmContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
    height: 120,
  },
  bpmNumber: {
    color: "white",
    fontSize: 64,
    fontWeight: "bold",
    fontFamily: "Quicksand-Bold",
    lineHeight: 70,
  },
  bpmLabel: {
    color: "#B2BEC3",
    fontSize: 18,
    fontFamily: "Quicksand-Regular",
  },
  instructionCard: {
    backgroundColor: "#34495e",
    padding: 20,
    borderRadius: 16,
    width: "100%",
    marginBottom: 20,
  },
  instructionTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Quicksand-Bold",
    marginBottom: 10,
  },
  instructionText: {
    color: "#B2BEC3",
    fontSize: 15,
    lineHeight: 24,
    fontFamily: "Quicksand-Regular",
  },
  cameraWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
    borderWidth: 4,
    borderColor: colors.primary,
    marginBottom: 30,
    backgroundColor: "#2d3e50",
    justifyContent: "center",
    alignItems: "center",
  },
  camera: {
    width: "100%",
    height: "100%",
  },
  noCamera: {
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
  },
  noCameraText: {
    color: "#636e72",
    textAlign: "center",
    marginTop: 5,
    fontSize: 12,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  readingText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 12,
  },
  actionContainer: {
    width: "100%",
    minHeight: 100,
    justifyContent: "center",
  },
  buttonStart: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    width: "100%",
  },
  buttonStop: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    width: "100%",
    borderWidth: 2,
    borderColor: colors.primary,
  },
  buttonSave: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    gap: 10,
  },
  buttonRetry: {
    paddingVertical: 16,
    alignItems: "center",
    width: "100%",
    marginTop: 10,
  },
  buttonTextDark: {
    color: "#2D3436",
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Quicksand-Bold",
  },
  buttonTextLight: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Quicksand-Bold",
  },
  finishedActions: {
    width: "100%",
  },
});

export default MeasureScreen;
