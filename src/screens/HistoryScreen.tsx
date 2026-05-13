// src/screens/HistoryScreen.tsx

import React, { useState, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from "react-native";
import { ArrowLeft, Clock, Heart } from "lucide-react-native";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { initDB } from "../utils/db";
import { colors } from "../theme/colors";

interface Measurement {
  id: number;
  bpm: number;
  timestamp: string;
}

const HistoryScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const db = await initDB();
      const results = await db.getAllAsync<Measurement>(
        "SELECT * FROM measurements ORDER BY timestamp DESC"
      );
      setMeasurements(results);
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchHistory();
    }
  }, [isFocused]);

  const renderItem = ({ item }: { item: Measurement }) => {
    const date = new Date(item.timestamp);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Heart color={colors.danger} size={18} fill={colors.danger} />
          <Text style={styles.bpmText}>{item.bpm} BPM</Text>
        </View>
        <View style={styles.cardFooter}>
          <Clock color="#B2BEC3" size={14} />
          <Text style={styles.timeText}>{dateStr} at {timeStr}</Text>
        </View>
      </View>
    );
  };

  const hitSlop = { top: 30, bottom: 30, left: 30, right: 30 };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Pressable
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <ArrowLeft color={colors.primary} size={24} />
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.title}>BPM History</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : measurements.length > 0 ? (
        <FlatList
          data={measurements}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No measurements saved yet.</Text>
          <Text style={styles.emptySubText}>Try your first reading from the heart monitor.</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2D3436",
  },
  headerTitleContainer: {
    width: "100%",
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  headerButton: {
    position: "absolute",
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    elevation: 10,
    backgroundColor: "transparent",
  },
  title: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "Quicksand-Bold",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#34495e",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  bpmText: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
    marginLeft: 10,
    fontFamily: "Quicksand-Bold",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeText: {
    color: "#B2BEC3",
    fontSize: 14,
    marginLeft: 6,
    fontFamily: "Quicksand-Regular",
  },
  emptyText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  emptySubText: {
    color: "#B2BEC3",
    fontSize: 15,
    textAlign: "center",
  },
});

export default HistoryScreen;
