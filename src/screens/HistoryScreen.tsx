import React, { useState, useEffect, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { ArrowLeft, Clock, Heart } from "lucide-react-native";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { initDB } from "../utils/db";
import { colors } from "../theme/colors";

interface MeasurementRow {
  id: number;
  bpm: number;
  timestamp: string | null;
}

const parseDbDate = (value: string | null, assumeUtc: boolean): Date | null => {
  if (!value) return null;

  // If timezone exists in string, let JS parse it directly.
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(value)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/,
  );
  if (!match) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");

  return assumeUtc
    ? new Date(Date.UTC(year, month, day, hour, minute, second))
    : new Date(year, month, day, hour, minute, second);
};

const HistoryScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const [measurements, setMeasurements] = useState<MeasurementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [assumeUtc, setAssumeUtc] = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const db = await initDB();
      const tableInfo = await db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(measurements);",
      );
      const hasTimestamp = tableInfo.some((c) => c.name === "timestamp");
      const hasCreatedAt = tableInfo.some((c) => c.name === "created_at");

      let dateColumn = "timestamp";
      let isUtcColumn = true;
      if (!hasTimestamp && hasCreatedAt) {
        dateColumn = "created_at";
        isUtcColumn = false;
      }

      const results = await db.getAllAsync<MeasurementRow>(
        `SELECT id, bpm, ${dateColumn} as timestamp FROM measurements ORDER BY ${dateColumn} DESC`,
      );

      setAssumeUtc(isUtcColumn);
      setMeasurements(results);
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      fetchHistory();
    }
  }, [isFocused, fetchHistory]);

  const renderItem = ({ item }: { item: MeasurementRow }) => {
    const date = parseDbDate(item.timestamp, assumeUtc);
    const timeStr = date
      ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "--:--";
    const dateStr = date
      ? date.toLocaleDateString([], { month: "short", day: "numeric" })
      : "Unknown date";

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Heart color={colors.danger} size={18} fill={colors.danger} />
          <Text style={styles.bpmText}>{item.bpm} BPM</Text>
        </View>
        <View style={styles.cardFooter}>
          <Clock color="#B2BEC3" size={14} />
          <Text style={styles.timeText}>
            {dateStr} at {timeStr}
          </Text>
        </View>
      </View>
    );
  };

  const hitSlop = { top: 20, bottom: 20, left: 20, right: 20 };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.headerBar,
          { paddingTop: insets.top, height: insets.top + 60 },
        ]}
      >
        <Pressable
          style={styles.headerButtonLeft}
          onPress={() => navigation.goBack()}
          hitSlop={hitSlop}
        >
          <ArrowLeft color={colors.primary} size={24} />
        </Pressable>
        <Text style={styles.title}>BPM History</Text>
        <View style={styles.headerButtonRightSpacer} />
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
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 20 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No measurements saved yet.</Text>
          <Text style={styles.emptySubText}>
            Try your first reading from the heart monitor.
          </Text>
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
  headerBar: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2D3436",
  },
  headerButtonLeft: {
    position: "absolute",
    left: 8,
    bottom: 0,
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  headerButtonRightSpacer: {
    position: "absolute",
    right: 8,
    bottom: 0,
    width: 60,
    height: 60,
  },
  title: {
    color: "white",
    fontSize: 28,
    fontFamily: "Quicksand-Bold",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  card: {
    backgroundColor: "#34495e",
    borderRadius: 20,
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
    fontFamily: "Quicksand-Bold",
    marginBottom: 10,
    textAlign: "center",
  },
  emptySubText: {
    color: "#B2BEC3",
    fontSize: 15,
    textAlign: "center",
    fontFamily: "Quicksand-Regular",
  },
});

export default HistoryScreen;
