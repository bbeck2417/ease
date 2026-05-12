// src/screens/MeasureScreen.tsx

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { ArrowLeft, Activity, Save, CameraOff, Info } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import {
  Camera,
  useCameraDevices,
  useCameraPermission,
  useFrameOutput,
} from "react-native-vision-camera";
import { useSharedValue, runOnJS } from "react-native-reanimated";
import { colors } from "../theme/colors";
import { initDB } from "../utils/db";

const screenWidth = Dimensions.get("window").width;
const WINDOW_SIZE = 45; // 1.5 seconds

const MeasureScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  const devices = useCameraDevices();
  const device = useMemo(() => {
    return devices.find((d) => d.id === "0") || 
           devices.find((d) => d.position === "back" && d.hasTorch) ||
           devices.find((d) => d.position === "back");
  }, [devices]);
                 
  const { hasPermission, requestPermission } = useCameraPermission();

  const [measuring, setMeasuring] = useState(false);
  const isMeasuringRef = useRef(false);
  const [torchOn, setTorchOn] = useState(false);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bpm, setBpm] = useState<number | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [frames, setFrames] = useState(0);

  const jsStartTime = useRef<number>(0);
  const signalBuffer = useRef<number[]>([]);
  const lastBeatTime = useRef<number>(0);
  const beats = useRef<number[]>([]);
  const frameCounter = useSharedValue<number>(0);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission]);

  useEffect(() => {
    if (measuring) {
      const timer = setTimeout(() => setTorchOn(true), 500); 
      return () => clearTimeout(timer);
    } else {
      setTorchOn(false);
    }
  }, [measuring]);

  const onMeasurementFinished = useCallback((finalBpm: number | null) => {
    setMeasuring(false);
    isMeasuringRef.current = false;
    setFinished(true);
    setBpm(finalBpm || 0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    jsStartTime.current = 0;
  }, []);

  const onFrameReceived = useCallback((brightness: number, currentFrameCount: number) => {
    setFrames(currentFrameCount);
    
    if (isMeasuringRef.current && jsStartTime.current > 0) {
      const now = Date.now();
      const elapsed = now - jsStartTime.current;

      signalBuffer.current.push(brightness);
      if (signalBuffer.current.length > WINDOW_SIZE) signalBuffer.current.shift();

      if (signalBuffer.current.length >= WINDOW_SIZE && elapsed > 1500) {
        const avg = signalBuffer.current.reduce((a, b) => a + b, 0) / signalBuffer.current.length;
        const currentVal = brightness;
        const prevVal = signalBuffer.current[signalBuffer.current.length - 2];

        const variance = Math.max(...signalBuffer.current) - Math.min(...signalBuffer.current);
        setConfidence(Math.min(variance / 2.5, 1)); 

        if (currentVal > avg * 1.0005 && prevVal <= avg * 1.0005) {
          const timeSinceLastBeat = now - lastBeatTime.current;
          if (timeSinceLastBeat > 350 && timeSinceLastBeat < 1500) {
            beats.current.push(timeSinceLastBeat);
            if (beats.current.length > 6) beats.current.shift();
            const avgInterval = beats.current.reduce((a, b) => a + b, 0) / beats.current.length;
            setBpm(Math.round(60000 / avgInterval));
            lastBeatTime.current = now;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        }
      }

      if (elapsed > 15000) {
        let finalBpmValue = 0;
        if (beats.current.length >= 3) {
            const avgInterval = beats.current.reduce((a, b) => a + b, 0) / beats.current.length;
            finalBpmValue = Math.round(60000 / avgInterval);
        }
        onMeasurementFinished(finalBpmValue > 0 ? finalBpmValue : null);
      }
    }
  }, [onMeasurementFinished]);

  const frameOutput = useFrameOutput({
    onFrame: (frame) => {
      "worklet";
      if (!frame.isValid) return;
      frameCounter.value = frameCounter.value + 1;
      
      try {
        const buffer = frame.isPlanar ? frame.getPlanes()[0].getPixelBuffer() : frame.getPixelBuffer();
        const data = new Uint8Array(buffer);
        
        let sum = 0;
        const count = 40;
        const center = Math.floor(data.length / 2);
        const step = 2; 
        
        for (let i = 0; i < count; i++) {
          sum += data[center + (i - count/2) * step];
        }
        
        runOnJS(onFrameReceived)(sum / count, frameCounter.value);
      } catch (e) {} finally {
        frame.dispose();
      }
    },
    pixelFormat: 'yuv'
  });

  const startMeasurement = () => {
    if (!hasPermission || !device) return;
    setMeasuring(true);
    isMeasuringRef.current = true;
    setFinished(false);
    setBpm(0); 
    setFrames(0);
    setConfidence(0);
    signalBuffer.current = [];
    beats.current = [];
    lastBeatTime.current = 0;
    jsStartTime.current = Date.now();
    frameCounter.value = 0;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const saveMeasurement = async () => {
    if (!bpm || bpm === 0) return;
    setSaving(true);
    try {
      const db = await initDB();
      await db.runAsync("INSERT INTO measurements (bpm, timestamp) VALUES (?, ?)", [bpm, new Date().toISOString()]);
      navigation.navigate("History");
    } catch (error) {
      navigation.navigate("History");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
        <ArrowLeft color={colors.primary} size={24} />
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.title}>BPM Reader</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.bpmBox}>
          <Activity color={measuring ? colors.danger : colors.primary} size={40} />
          <View style={styles.bpmValueContainer}>
             <Text style={styles.bpmVal}>{bpm && bpm > 0 ? bpm : "--"}</Text>
             <Text style={styles.bpmLabel}>BPM</Text>
          </View>
          
          {measuring && (
            <View style={styles.confidenceBar}>
              <View style={[styles.confidenceFill, { width: `${confidence * 100}%` }]} />
              <Text style={styles.confidenceText}>
                {confidence < 0.25 ? "Check finger position..." : "Signal Strong"}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.instructionCard}>
          <Text style={styles.instructionTitle}>How to measure</Text>
          <Text style={styles.instructionText}>
            1. Lightly cover the REAR CAMERA lens and flash.{"\n"}
            2. Keep your finger still for 15 seconds.{"\n"}
            3. Do not press too hard!
          </Text>
        </View>

        <View style={styles.cameraCircle}>
          {hasPermission && device ? (
            <Camera
              style={styles.camera}
              device={device}
              isActive={true} 
              torchMode={torchOn ? "on" : "off"}
              // @ts-ignore
              torch={torchOn ? "on" : "off"} 
              outputs={[frameOutput]}
              resizeMode="cover"
            />
          ) : (
            <CameraOff color="#636e72" size={32} />
          )}
        </View>

        <View style={styles.actionContainer}>
          {!measuring && !finished && (
            <TouchableOpacity style={styles.buttonStart} onPress={startMeasurement}>
              <Text style={styles.buttonTextDark}>Start Measurement</Text>
            </TouchableOpacity>
          )}

          {measuring && (
            <TouchableOpacity
              style={styles.buttonStop}
              onPress={() => {
                setMeasuring(false);
                isMeasuringRef.current = false;
                setBpm(null);
                jsStartTime.current = 0;
              }}
            >
              <Text style={styles.buttonTextLight}>Cancel</Text>
            </TouchableOpacity>
          )}

          {finished && (
            <View style={{ width: '100%' }}>
              {bpm && bpm > 0 ? (
                <TouchableOpacity style={styles.buttonSave} onPress={saveMeasurement} disabled={saving}>
                  <Save color="#2D3436" size={20} />
                  <Text style={styles.buttonTextDark}>{saving ? "Saving..." : "Save to History"}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.errorBox}>
                  <Info color={colors.danger} size={20} />
                  <Text style={styles.errorText}>Low signal quality. Try again.</Text>
                </View>
              )}
              <TouchableOpacity style={styles.buttonRetry} onPress={startMeasurement}>
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
  container: { flex: 1, backgroundColor: "#2D3436" },
  backButton: { position: "absolute", top: 50, left: 16, zIndex: 10, padding: 10 },
  header: { alignItems: "center", marginTop: 18, marginBottom: 10 },
  title: { color: "white", fontSize: 24, fontWeight: "bold", fontFamily: "Quicksand-Bold" },
  content: { padding: 20, alignItems: "center" },
  bpmBox: { alignItems: "center", justifyContent: "center", height: 220, width: '100%' },
  bpmValueContainer: { alignItems: 'center', justifyContent: 'center' },
  bpmVal: { color: "white", fontSize: 64, fontWeight: "bold", fontFamily: "Quicksand-Bold", textAlign: 'center' },
  bpmLabel: { color: "#B2BEC3", fontSize: 18, textAlign: 'center' },
  confidenceBar: { width: 140, height: 4, backgroundColor: '#3d3d3d', borderRadius: 2, marginTop: 15, overflow: 'hidden' },
  confidenceFill: { height: '100%', backgroundColor: colors.primary },
  confidenceText: { color: '#B2BEC3', fontSize: 11, marginTop: 6, textTransform: 'uppercase', textAlign: 'center' },
  cameraCircle: { width: 140, height: 140, borderRadius: 70, overflow: "hidden", borderWidth: 4, borderColor: colors.primary, marginBottom: 30, backgroundColor: "#2d3e50", justifyContent: "center", alignItems: "center" },
  camera: { width: "100%", height: "100%" },
  instructionCard: { backgroundColor: "#34495e", padding: 20, borderRadius: 16, width: "100%", marginBottom: 20 },
  instructionTitle: { color: "white", fontSize: 18, fontWeight: "bold", fontFamily: "Quicksand-Bold", marginBottom: 10 },
  instructionText: { color: "#B2BEC3", fontSize: 15, lineHeight: 24, fontFamily: "Quicksand-Regular" },
  actionContainer: { width: "100%", minHeight: 120 },
  buttonStart: { backgroundColor: colors.primary, paddingVertical: 18, borderRadius: 16, alignItems: "center", width: "100%", flexDirection: 'row', justifyContent: 'center', gap: 10 },
  buttonSave: { backgroundColor: colors.primary, paddingVertical: 18, borderRadius: 16, alignItems: "center", width: "100%", flexDirection: 'row', justifyContent: 'center', gap: 10 },
  buttonStop: { paddingVertical: 18, borderRadius: 16, alignItems: "center", width: "100%", borderWidth: 2, borderColor: colors.primary },
  buttonRetry: { paddingVertical: 16, alignItems: "center", width: "100%", marginTop: 10 },
  buttonTextDark: { color: "#2D3436", fontSize: 18, fontWeight: "bold" },
  buttonTextLight: { color: colors.primary, fontSize: 16, fontWeight: "bold" },
  errorBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, backgroundColor: 'rgba(231, 76, 60, 0.1)', borderRadius: 12, marginBottom: 10 },
  errorText: { color: colors.danger, fontWeight: 'bold' }
});

export default MeasureScreen;
