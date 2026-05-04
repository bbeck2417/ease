// src/screens/MeasureScreen.tsx

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LineChart } from "react-native-chart-kit";
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft } from "lucide-react-native";
import { colors } from "../theme/colors";

const data = {
  labels: ["0", "1", "2", "3", "4", "5", "6"],
  datasets: [
    {
      data: [65, 65, 80, 90, 75, 65, 90],
      color: (opacity = 1) => `rgba(134, 65, 244, ${opacity})`,
      strokeWidth: 2,
    },
  ],
};
const screenWidth = Dimensions.get("window").width;

const MeasureScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

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

      {/* --- FIXED: Extracted Header Title --- */}
      <View style={styles.headerTitleContainer}>
        <Text style={styles.title}>Heart Rate Monitor</Text>
      </View>

      {/* Instructions and Start Button */}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.instruction}>
          Press the button below to start measuring your heart rate.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => console.log("Start Measurement")}
        >
          <Text style={styles.buttonText}>Start Measurement</Text>
        </TouchableOpacity>

        {/* Real-time Graph */}
        <View style={styles.chartContainer}>
          <LineChart
            data={data}
            width={screenWidth - 40}
            height={220}
            yAxisLabel="$"
            chartConfig={{
              backgroundColor: "#e26a00",
              backgroundGradientFrom: "#2980b9",
              backgroundGradientTo: "#ec4899",
              decimalPlaces: 2,
              color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
              style: {
                borderRadius: 16,
              },
              propsForDots: {
                r: "4",
                strokeWidth: "2",
                stroke: "#ffa726",
              },
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2D3436",
    padding: 20,
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
    marginBottom: 20,
  },
  title: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    // Removed marginBottom: 20 from here since the container handles it now
  },
  content: {
    marginTop: 10,
    justifyContent: "center",
  },
  instruction: {
    color: "#B2BEC3",
    fontSize: 16,
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#55E6C1",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  chartContainer: {
    marginTop: 30,
  },
});

export default MeasureScreen;
