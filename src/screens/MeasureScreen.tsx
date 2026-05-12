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
  const [debugBright, setDebugBright] = useState(0);

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
    setDebugBright(Math.round(brightness));
    
    if (isMeasuringRef.current && jsStartTime.current > 0) {
      const now = Date.now();
      const elapsed = now - jsStartTime.current;

      // DSP Step 1: Low-Pass Filter (Exponential Moving Average) to remove noise
      const lastSmoothed = signalBuffer.current.length > 0 
        ? signalBuffer.current[signalBuffer.current.length - 1] 
        : brightness;
      const smoothedBrightness = (lastSmoothed * 0.6) + (brightness * 0.4);

      signalBuffer.current.push(smoothedBrightness);
      if (signalBuffer.current.length > WINDOW_SIZE) {
        signalBuffer.current.shift();
      }

      if (signalBuffer.current.length >= WINDOW_SIZE && elapsed > 1500) {
        // DSP Step 2: Extract Wave Properties
        const min = Math.min(...signalBuffer.current);
        const max = Math.max(...signalBuffer.current);
        const range = max - min;
        
        // A range > 1 indicates we have SOME signal (your device was 80 to 84, so range=4)
        const hasSignal = range > 1.0;
        setConfidence(hasSignal ? 1 : 0.2); 

        if (hasSignal) {
          // DSP Step 3: Adaptive Threshold Peak Detection
          // We trigger a beat when the signal crosses 60% of the wave's current height
          const threshold = min + (range * 0.6);
          const currentVal = signalBuffer.current[signalBuffer.current.length - 1];
          const prevVal = signalBuffer.current[signalBuffer.current.length - 2];

          // Trigger on rising edge crossing the threshold
          if (currentVal >= threshold && prevVal < threshold) {
            const timeSinceLastBeat = now - lastBeatTime.current;
            
            // Validate: Humanly possible beats (30 to 180 BPM)
            if (timeSinceLastBeat > 330 && timeSinceLastBeat < 2000) {
              beats.current.push(timeSinceLastBeat);
              if (beats.current.length > 6) beats.current.shift();
              
              const avgInterval = beats.current.reduce((a, b) => a + b, 0) / beats.current.length;
              setBpm(Math.round(60000 / avgInterval));
              lastBeatTime.current = now;
              
              if (beats.current.length % 2 === 0) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }
          }
        }
      }

      if (elapsed > 15000) {
        let finalBpmValue = 0;
        // Accept even 2 beats as a success for testing
        if (beats.current.length >= 2) {
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
        if (data.length === 0) return;

        // SAFE BROAD SAMPLING
        // We only sample from the first half of the array, which guarantees
        // we are only reading the Y (luminance) channel in a YUV buffer, avoiding green/purple noise.
        let sum = 0;
        let count = 0;
        const yBoundary = Math.floor(data.length * 0.5); 
        const step = Math.floor(yBoundary / 100); 
        
        for (let i = 0; i < 100; i++) {
          const index = i * step;
          if (index < data.length) {
            sum += data[index];
            count++;
          }
        }
        
        const brightness = count > 0 ? sum / count : 0;
        runOnJS(onFrameReceived)(brightness, frameCounter.value);
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
          
          <View style={styles.bpmValueWrapper}>
             <Text style={styles.bpmVal}>{bpm && bpm > 0 ? bpm : "--"}</Text>
             <Text style={styles.bpmLabel}>BPM</Text>
          </View>
          
          <View style={styles.debugRow}>
            <Text style={styles.debugText}>
              Brightness: {debugBright}
            </Text>
          </View>

          {measuring && (
            <View style={styles.confidenceBar}>
              <View style={[styles.confidenceFill, { width: `${confidence * 100}%` }]} />
              <Text style={styles.confidenceText}>
                {confidence < 0.5 ? "Check finger position..." : "Signal Detected"}
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

        <View style={styles.cameraOuterWrapper}>
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
              />
            ) : (
              <CameraOff color="#636e72" size={32} />
            )}
          </View>
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
  content: { padding: 20, alignItems: "center", width: '100%' },
  
  bpmBox: { alignItems: "center", justifyContent: "center", height: 220, width: '100%' },
  bpmValueWrapper: { width: '100%', alignItems: 'center' },
  bpmVal: { color: "white", fontSize: 64, fontWeight: "bold", fontFamily: "Quicksand-Bold", textAlign: 'center', width: '100%' },
  bpmLabel: { color: "#B2BEC3", fontSize: 18, textAlign: 'center', width: '100%' },
  
  debugRow: { marginTop: 10 },
  debugText: { color: colors.primary, fontSize: 13, fontWeight: 'bold' },
  
  confidenceBar: { width: 140, height: 4, backgroundColor: '#3d3d3d', borderRadius: 2, marginTop: 15, overflow: 'hidden' },
  confidenceFill: { height: '100%', backgroundColor: colors.primary },
  confidenceText: { color: '#B2BEC3', fontSize: 11, marginTop: 6, textTransform: 'uppercase', textAlign: 'center' },
  
  instructionCard: { backgroundColor: "#34495e", padding: 20, borderRadius: 16, width: "100%", marginBottom: 20 },
  instructionTitle: { color: "white", fontSize: 18, fontWeight: "bold", fontFamily: "Quicksand-Bold", marginBottom: 10 },
  instructionText: { color: "#B2BEC3", fontSize: 15, lineHeight: 24, fontFamily: "Quicksand-Regular" },
  
  cameraOuterWrapper: { width: '100%', alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
  cameraCircle: { width: 140, height: 140, borderRadius: 70, overflow: "hidden", borderWidth: 4, borderColor: colors.primary, backgroundColor: "#000" },
  camera: { width: "100%", height: "100%" },
  
  actionContainer: { width: "100%", minHeight: 120 },
  buttonStart: { backgroundColor: colors.primary, paddingVertical: 18, borderRadius: 16, alignItems: "center", width: "100%" },
  buttonSave: { backgroundColor: colors.primary, paddingVertical: 18, borderRadius: 16, alignItems: "center", width: "100%", flexDirection: 'row', justifyContent: 'center', gap: 10 },
  buttonStop: { paddingVertical: 18, borderRadius: 16, alignItems: "center", width: "100%", borderWidth: 2, borderColor: colors.primary },
  buttonRetry: { paddingVertical: 16, alignItems: "center", width: "100%", marginTop: 10 },
  buttonTextDark: { color: "#2D3436", fontSize: 18, fontWeight: "bold" },
  buttonTextLight: { color: colors.primary, fontSize: 16, fontWeight: "bold" },
  errorBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, backgroundColor: 'rgba(231, 76, 60, 0.1)', borderRadius: 12, marginBottom: 10 },
  errorText: { color: colors.danger, fontWeight: 'bold' }
});

export default MeasureScreen;
