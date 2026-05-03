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
  Modal,
  FlatList,
  ActivityIndicator,
  Dimensions,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Phone, X, UserPlus, Quote, ArrowLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Contacts from "expo-contacts";
import { initDB } from "../utils/db";
import { useNavigation } from "@react-navigation/native";

const { height } = Dimensions.get("window");

const SettingsScreen = () => {
  const insets = useSafeAreaInsets();
  const [contacts, setContacts] = useState<
    { id: number; name: string; phone: string }[]
  >([]);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [mantras, setMantras] = useState<{ id: number; text: string }[]>([]);
  const [newMantra, setNewMantra] = useState("");
  const [isContactsModalVisible, setIsContactsModalVisible] = useState(false);
  const [phoneContacts, setPhoneContacts] = useState<Contacts.Contact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
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

  const importContactFromPhone = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsLoadingContacts(true);

    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "To import contacts, you need to allow access to your phonebook in your device settings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ],
      );
      setIsLoadingContacts(false);
      return;
    }

    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
    });

    if (data.length > 0) {
      const contactsWithPhones = data.filter(
        (c) => c.phoneNumbers && c.phoneNumbers.length > 0,
      );
      setPhoneContacts(contactsWithPhones);
      setIsContactsModalVisible(true);
    } else {
      // Optionally, show an alert that no contacts were found.
      console.log("No contacts with phone numbers found.");
    }
    setIsLoadingContacts(false);
  };

  const handleContactSelect = (contact: Contacts.Contact) => {
    setNewName(contact.name);
    if (contact.phoneNumbers && contact.phoneNumbers[0]?.number) {
      setNewPhone(contact.phoneNumbers[0].number);
    }
    setIsContactsModalVisible(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

  const formatPhoneNumber = (text: string) => {
    // 1. Remove all non-numeric characters
    const cleaned = text.replace(/\D/g, "");

    // 2. Apply formatting (Example: 555-555-5555)
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);

    if (match) {
      const part1 = match[1];
      const part2 = match[2];
      const part3 = match[3];

      if (part3) return `${part1}-${part2}-${part3}`;
      if (part2) return `${part1}-${part2}`;
      return part1;
    }

    return cleaned;
  };

  const handlePhoneNumberChangeText = (text: string) => {
    const formatted = formatPhoneNumber(text);
    setNewPhone(formatted);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
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
                placeholder="555-555-555"
                placeholderTextColor="#636e72"
                keyboardType="phone-pad"
                inputMode="tel"
                value={newPhone}
                maxLength={12}
                onChangeText={handlePhoneNumberChangeText}
                // Forces the keyboard's "Done" button to trigger the add logic
                returnKeyType="done"
                onSubmitEditing={addContact}
              />
              <Pressable
                style={[
                  styles.addButton,
                  (!newName.trim() || !newPhone.trim()) &&
                    styles.disabledButton,
                ]}
                onPress={addContact}
                disabled={!newName.trim() || !newPhone.trim()}
              >
                <Text style={styles.addText}>Add Contact</Text>
              </Pressable>
              <Pressable
                style={styles.importButton}
                onPress={importContactFromPhone}
              >
                {isLoadingContacts ? (
                  <ActivityIndicator color="#55E6C1" />
                ) : (
                  <UserPlus color="#55E6C1" size={20} />
                )}
                <Text style={styles.importButtonText}>Import From Phone</Text>
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

      {/* Contacts Import Modal */}
      <Modal
        visible={isContactsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsContactsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Import Contact</Text>
              <Pressable onPress={() => setIsContactsModalVisible(false)}>
                <X color="#B2BEC3" size={28} />
              </Pressable>
            </View>
            <FlatList
              data={phoneContacts}
              keyExtractor={(item, index) => item.id ?? index.toString()}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.card}
                  onPress={() => handleContactSelect(item)}
                >
                  <View>
                    <Text style={styles.cardMain}>{item.name}</Text>
                    {item.phoneNumbers && item.phoneNumbers[0]?.number && (
                      <Text style={styles.cardSub}>
                        {item.phoneNumbers[0].number}
                      </Text>
                    )}
                  </View>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyListText}>
                  No contacts with phone numbers found on your device.
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
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
  scrollContent: { padding: 20, paddingBottom: 40 },
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
  },
  disabledButton: {
    opacity: 0.5,
  },
  importButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#55E6C1",
    padding: 12,
    borderRadius: 10,
  },
  addText: {
    color: "#2D3436",
    fontWeight: "bold",
    fontFamily: "Quicksand-Regular",
    fontSize: 18,
  },
  importButtonText: {
    color: "#55E6C1",
    fontWeight: "bold",
    fontFamily: "Quicksand-Regular",
    fontSize: 16,
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
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#2D3436",
    height: height * 0.7,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
    fontFamily: "Quicksand-Regular",
  },
  emptyListText: {
    color: "#B2BEC3",
    textAlign: "center",
    marginTop: 40,
    fontFamily: "Quicksand-Regular",
  },
});

export default SettingsScreen;
