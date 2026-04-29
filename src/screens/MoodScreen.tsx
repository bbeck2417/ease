import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft, CheckCircle } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { initDB } from "../utils/db";

const moods = [
  { emoji: "😔", label: "Struggling", color: "#74b9ff" },
  { emoji: "😕", label: "Meh", color: "#a29bfe" },
  { emoji: "🙂", label: "Okay", color: "#55E6C1" },
  { emoji: "😊", label: "Good", color: "#55E6C1" },
  { emoji: "🤩", label: "Great", color: "#fab1a0" },
];

const MoodScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const saveMood = async (emoji: string, label: string) => {
    setSelectedMood(label);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const db = await initDB();
      await db.runAsync("INSERT INTO moods (emoji, label) VALUES (?, ?)", [
        emoji,
        label,
      ]);
      setSaved(true);
      // Give the user a moment to see the success state
      setTimeout(() => navigation.goBack(), 2500);
    } catch (error) {
      console.error("Failed to save mood:", error);
    }
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
        <Text style={styles.headerTitle}>Daily Check-in</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 20 },
        ]}
      >
        <Text style={styles.question}>How are you feeling right now?</Text>

        <View style={styles.moodGrid}>
          {moods.map((mood) => (
            <Pressable
              key={mood.label}
              style={[
                styles.moodButton,
                selectedMood === mood.label && {
                  borderColor: mood.color,
                  backgroundColor: "#34495e",
                },
              ]}
              onPress={() => saveMood(mood.emoji, mood.label)}
              disabled={saved}
            >
              <Text style={styles.emoji}>{mood.emoji}</Text>
              <Text style={[styles.moodLabel, { color: mood.color }]}>
                {mood.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {saved && (
          <View style={styles.successContainer}>
            <CheckCircle color="#55E6C1" size={40} />
            <Text style={styles.successText}>
              Mood logged. Be kind to yourself today.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#2D3436" },
  header: { flexDirection: "row", alignItems: "center", padding: 20 },
  backButton: { marginRight: 15 },
  headerTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
    fontFamily: "Quicksand-Bold",
  },
  content: { alignItems: "center", padding: 20 },
  question: {
    color: "white",
    fontSize: 24,
    textAlign: "center",
    marginBottom: 40,
    fontFamily: "Quicksand-Bold",
  },
  moodGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 20,
  },
  moodButton: {
    width: 100,
    height: 120,
    backgroundColor: "#2d3e50",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  emoji: { fontSize: 40, marginBottom: 10 },
  moodLabel: { fontWeight: "bold", fontFamily: "Quicksand-Bold" },
  successContainer: { marginTop: 40, alignItems: "center", gap: 10 },
  successText: {
    color: "#B2BEC3",
    fontSize: 16,
    fontFamily: "Quicksand-Regular",
    textAlign: "center",
  },
});

export default MoodScreen;
