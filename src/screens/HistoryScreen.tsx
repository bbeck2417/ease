// src/screens/HistoryScreen.tsx

import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";


const HistoryScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Pressable
        style={[styles.headerLeftButton, { top: insets.top + 10, left: 16 }]}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
      >
        <ArrowLeft color="#55E6C1" size={24} />
      </Pressable>

      <View style={styles.headerTitleContainer}>
        <Text style={styles.title}>History</Text>
      </View>

      <Text style={styles.text}>No measurements yet.</Text>
    </View>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2D3436",
    padding: 20,
  },
  title: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  text: {
    color: "#B2BEC3",
    fontSize: 16,
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
    marginTop: 18, // Pushes title down to align nicely with the absolute button
    marginBottom: 20,
  },
});

export default HistoryScreen;
