import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Phone, X, UserPlus, Quote, ArrowLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { initDB } from "../utils/db";
import { useNavigation } from "@react-navigation/native";

const SettingsScreen = () => {
  const insets = useSafeAreaInsets();
  const [contacts, setContacts] = useState<
    { id: number; name: string; phone: string }[]
  >([]);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [mantras, setMantras] = useState<{ id: number; text: string }[]>([]);
  const [newMantra, setNewMantra] = useState("");
  const phoneInputRef = useRef<TextInput>(null);
  const navigation = useNavigation();

  const loadData = async () => {
    const db = await initDB();
    const allContacts = await db.getAllAsync<{
      id: number;
      name: string;
      phone: string;
    }>("SELECT * FROM contacts ORDER BY name ASC");
    const allMantras = await db.getAllAsync<{ id: number; text: string }>(
      "SELECT * FROM mantras",
    );
    setContacts(allContacts);
    setMantras(allMantras);
  };

  const addContact = async () => {
    if (!newName.trim() || !newPhone.trim()) return;

    try {
      const db = await initDB();
      await db.runAsync("INSERT INTO contacts (name, phone) VALUES (?, ?)", [
        newName.trim(),
        newPhone.trim(),
      ]);

      setNewName("");
      setNewPhone("");
      await loadData(); // This now works because both tables exist!
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Keyboard.dismiss();
    } catch (error) {
      console.error("Failed to save contact:", error);
    }
  };

  const addMantra = async () => {
    if (!newMantra.trim()) return;

    try {
      const db = await initDB();
      await db.runAsync("INSERT INTO mantras (text) VALUES (?)", [
        newMantra.trim(),
      ]);

      setNewMantra("");
      await loadData();

      // Dismiss the keyboard here too
      Keyboard.dismiss();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Failed to save mantra:", error);
    }
  };
  const deleteItem = async (table: string, id: number) => {
    const db = await initDB();
    await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, [id]);
    await loadData();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#2D3436" }}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack(); // This is the magic function that pops the screen off
          }}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <ArrowLeft color="#55E6C1" size={28} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Safe Team Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Safe Team</Text>
            <View style={styles.inputGroup}>
              <TextInput
                style={styles.input}
                placeholder="Name"
                placeholderTextColor="#636e72"
                value={newName}
                onChangeText={setNewName}
                returnKeyType="next"
                onSubmitEditing={() => phoneInputRef.current?.focus()}
              />
              <TextInput
                ref={phoneInputRef}
                style={styles.input}
                placeholder="Phone"
                placeholderTextColor="#636e72"
                keyboardType="phone-pad"
                value={newPhone}
                onChangeText={setNewPhone}
                // Forces the keyboard's "Done" button to trigger the add logic
                returnKeyType="done"
                onSubmitEditing={addContact}
              />
              <Pressable style={styles.addButton} onPress={addContact}>
                <Text style={styles.addText}>Add Contact</Text>
              </Pressable>
            </View>
            {contacts.map((c) => (
              <View key={c.id} style={styles.card}>
                <View>
                  <Text style={styles.cardMain}>{c.name}</Text>
                  <Text style={styles.cardSub}>{c.phone}</Text>
                </View>
                <Pressable onPress={() => deleteItem("contacts", c.id)}>
                  <X color="#D63031" size={20} />
                </Pressable>
              </View>
            ))}
          </View>

          {/* Mantras Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Mantras</Text>
            <View style={styles.inputGroup}>
              <TextInput
                style={styles.input}
                placeholder="I am safe..."
                placeholderTextColor="#636e72"
                value={newMantra}
                onChangeText={setNewMantra}
              />
              {/* Change backgroundColor to Seafoam Green (#55E6C1) to fix the 'greyed out' look */}
              <Pressable
                style={[styles.addButton, { backgroundColor: "#55E6C1" }]}
                onPress={addMantra}
              >
                <Text style={[styles.addText, { color: "#2D3436" }]}>
                  Add Mantra
                </Text>
              </Pressable>
            </View>

            {/* List of Mantras will now appear here */}
            {mantras.map((m) => (
              <View key={m.id} style={styles.card}>
                <Text style={[styles.cardMain, { flex: 1 }]}>{m.text}</Text>
                <Pressable onPress={() => deleteItem("mantras", m.id)}>
                  <X color="#D63031" size={20} />
                </Pressable>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#2D3436" },
  header: { flexDirection: "row", alignItems: "center", padding: 20, gap: 15 },
  title: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "Quicksand-Regular",
  },
  scrollContent: { padding: 20 },
  section: { marginBottom: 30 },
  sectionTitle: {
    color: "#55E6C1",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    fontFamily: "Quicksand-Regular",
  },
  inputGroup: { gap: 10, marginBottom: 15 },
  input: {
    backgroundColor: "#34495e",
    color: "white",
    padding: 12,
    borderRadius: 10,
    fontSize: 16,
  },
  addButton: {
    backgroundColor: "#55E6C1",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    fontSize: 14,
  },
  addText: {
    fontWeight: "bold",
    fontFamily: "Quicksand-Regular",
    fontSize: 18,
  },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#34495e",
    padding: 15,
    borderRadius: 12,
    marginBottom: 8,
  },
  cardMain: {
    color: "white",
    fontWeight: "bold",
    fontFamily: "Quicksand-Regular",
    fontSize: 18,
  },
  cardSub: { color: "#B2BEC3", fontSize: 16, fontFamily: "Quicksand-Regular" },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
});

export default SettingsScreen;
