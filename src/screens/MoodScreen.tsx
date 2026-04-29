import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft, CheckCircle } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { initDB } from "../utils/db";

// Define the type for our SQLite mood entries
type MoodEntry = {
  id: number;
  emoji: string;
  label: string;
  timestamp: string;
};

const moods = [
  { emoji: "😩", label: "Struggling", color: "#74b9ff" },
  { emoji: "🫤", label: "Meh", color: "#a29bfe" },
  { emoji: "😶", label: "Okay", color: "#55E6C1" },
  { emoji: "🙂", label: "Good", color: "#55E6C1" },
  { emoji: "🤩", label: "Great", color: "#fab1a0" },
];

const MoodScreen = () => {
  const navigation = useNavigation();
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // New state for the mood history log
  const [logs, setLogs] = useState<MoodEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Fetch the latest 14 entries from the database
  const fetchMoods = async () => {
    try {
      const db = await initDB();
      const result = await db.getAllAsync<MoodEntry>(
        "SELECT * FROM moods ORDER BY timestamp DESC LIMIT 14",
      );
      setLogs(result);
    } catch (error) {
      console.error("Failed to fetch mood history:", error);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Load history when the screen opens
  useEffect(() => {
    fetchMoods();
  }, []);

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

      // Immediately refresh the history list so the new mood appears!
      await fetchMoods();

      // Give the user a moment to see the success state
      setTimeout(() => navigation.goBack(), 2500);
    } catch (error) {
      console.error("Failed to save mood:", error);
    }
  };

  // Safely format the SQLite timestamp
  const formatDate = (dateString: string) => {
    if (!dateString) return "Unknown Date";
    const date = new Date(dateString + "Z"); // Append Z to ensure UTC parsing
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <ArrowLeft color="#55E6C1" size={28} />
        </Pressable>
        <Text style={styles.headerTitle}>Daily Check-in</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
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

        {/* --- RECENT CHECK-INS SECTION --- */}
        <View style={styles.logSection}>
          <Text style={styles.logTitle}>Recent Check-ins</Text>

          {loadingLogs ? (
            <ActivityIndicator
              size="large"
              color="#55E6C1"
              style={{ marginTop: 20 }}
            />
          ) : logs.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No moods logged yet.</Text>
              <Text style={styles.emptySubText}>
                Your daily check-ins will appear here.
              </Text>
            </View>
          ) : (
            <View style={styles.logsContainer}>
              {logs.map((item) => (
                <View key={item.id} style={styles.logCard}>
                  <View style={styles.logEmojiContainer}>
                    <Text style={styles.logEmoji}>{item.emoji}</Text>
                  </View>
                  <View style={styles.logTextContainer}>
                    <Text style={styles.logLabel}>{item.label}</Text>
                    <Text style={styles.logDate}>
                      {formatDate(item.timestamp)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
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
  content: { alignItems: "center", padding: 20, paddingBottom: 40 },
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

  // --- NEW LOG STYLES ---
  logSection: {
    width: "100%",
    marginTop: 50,
  },
  logTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Quicksand-Bold",
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  emptyState: {
    padding: 30,
    backgroundColor: "#34495e",
    borderRadius: 16,
    alignItems: "center",
  },
  emptyText: {
    color: "white",
    fontSize: 16,
    fontFamily: "Quicksand-Bold",
  },
  emptySubText: {
    color: "#B2BEC3",
    fontSize: 14,
    fontFamily: "Quicksand-Regular",
    marginTop: 8,
  },
  logsContainer: {
    width: "100%",
    gap: 12, // Provides spacing between mapped items
  },
  logCard: {
    flexDirection: "row",
    backgroundColor: "#34495e",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    width: "100%",
  },
  logEmojiContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#2d3e50",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  logEmoji: {
    fontSize: 24,
  },
  logTextContainer: {
    flex: 1,
  },
  logLabel: {
    color: "white",
    fontSize: 18,
    fontFamily: "Quicksand-Bold",
  },
  logDate: {
    color: "#B2BEC3",
    fontSize: 14,
    fontFamily: "Quicksand-Regular",
    marginTop: 4,
  },
});

export default MoodScreen;
