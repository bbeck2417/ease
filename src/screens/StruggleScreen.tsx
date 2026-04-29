import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Animated,
  Easing,
  StyleSheet,
  Dimensions,
  Modal,
  ScrollView,
  Platform,
} from "react-native";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { RootStackParamList } from "../../App";
import * as Linking from "expo-linking";
import * as Haptics from "expo-haptics";
import {
  Phone,
  Wind,
  Eye,
  Hand,
  Ear,
  Activity,
  Pizza,
  X,
  MapPin,
  Settings,
  Shield,
  Quote,
  Users,
  BookOpen,
  Heart,
} from "lucide-react-native";
import { colors } from "../theme/colors";
import { initDB } from "../utils/db";

const { width, height } = Dimensions.get("window");

const StruggleScreen = () => {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const scaleValue = useRef(new Animated.Value(1)).current;
  const isBreathingRef = useRef(false);
  const rampTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- CRITICAL FIX: Mantra Reference ---
  // This ref ensures the animation loop always sees the latest mantra count
  const mantrasRef = useRef<{ id: number; text: string }[]>([]);

  const [isBreathing, setIsBreathing] = useState(false);
  const [groundingModalVisible, setGroundingModalVisible] = useState(false);
  const [contactsModalVisible, setContactsModalVisible] = useState(false);
  const [mantrasModalVisible, setMantrasModalVisible] = useState(false);

  const [groundingStep, setGroundingStep] = useState(0);

  const [contacts, setContacts] = useState<
    { id: number; name: string; phone: string }[]
  >([]);
  const [mantras, setMantras] = useState<{ id: number; text: string }[]>([]);
  const [currentMantraIndex, setCurrentMantraIndex] = useState(0);

  const loadData = async () => {
    const db = await initDB();

    const allContacts = await db.getAllAsync<{
      id: number;
      name: string;
      phone: string;
    }>("SELECT * FROM contacts ORDER BY name ASC");
    setContacts(allContacts);

    const allMantras = await db.getAllAsync<{ id: number; text: string }>(
      "SELECT * FROM mantras",
    );

    if (allMantras.length === 0) {
      const defaultMantra = "This too shall pass";
      await db.runAsync("INSERT INTO mantras (text) VALUES (?)", [
        defaultMantra,
      ]);
      loadData();
    } else {
      setMantras(allMantras);
      mantrasRef.current = allMantras; // Keep the ref in sync with state
    }
  };

  useEffect(() => {
    if (isFocused) loadData();
  }, [isFocused]);

  const stopHaptics = () => {
    if (rampTimer.current) {
      clearTimeout(rampTimer.current);
      rampTimer.current = null;
    }
  };

  const startHapticRamp = (direction: "up" | "down", duration: number) => {
    let elapsed = 0;
    const step = 300;
    const pulse = () => {
      if (!isBreathingRef.current) return;
      const progress = elapsed / duration;
      const intensity = direction === "up" ? progress : 1 - progress;
      if (intensity > 0.8)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else if (intensity > 0.4)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      else if (intensity > 0.1)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      elapsed += step;
      if (elapsed < duration) rampTimer.current = setTimeout(pulse, step);
    };
    pulse();
  };

  const runBreathingCycle = () => {
    if (!isBreathingRef.current) return;

    startHapticRamp("up", 4000);
    Animated.timing(scaleValue, {
      toValue: 1.8,
      duration: 4000,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      stopHaptics();

      Animated.delay(4000).start(({ finished }) => {
        if (!finished) return;

        startHapticRamp("down", 4000);
        Animated.timing(scaleValue, {
          toValue: 1,
          duration: 4000,
          easing: Easing.linear,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (!finished) return;
          stopHaptics();

          Animated.delay(4000).start(() => {
            if (isBreathingRef.current) {
              // --- FIXED CYCLING LOGIC ---
              // We use mantrasRef.current.length to avoid stale closures
              setCurrentMantraIndex(
                (prev) => (prev + 1) % (mantrasRef.current.length || 1),
              );
              runBreathingCycle();
            }
          });
        });
      });
    });
  };

  const toggleBreathing = () => {
    if (isBreathingRef.current) {
      isBreathingRef.current = false;
      setIsBreathing(false);
      stopHaptics();
      scaleValue.stopAnimation();
      Animated.timing(scaleValue, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } else {
      isBreathingRef.current = true;
      setIsBreathing(true);
      runBreathingCycle();
    }
  };

  const groundingSteps = [
    {
      icon: <Eye color={colors.primary} size={40} />,
      label: "5 things you SEE",
      sub: "Look around you. Focus on the details.",
    },
    {
      icon: <Hand color={colors.primary} size={40} />,
      label: "4 things you can TOUCH",
      sub: "Feel the texture of your clothes or chair.",
    },
    {
      icon: <Ear color={colors.primary} size={40} />,
      label: "3 things you HEAR",
      sub: "Listen for distant or quiet sounds.",
    },
    {
      icon: <Pizza color={colors.primary} size={40} />,
      label: "2 things you can SMELL",
      sub: "Breathe in deeply through your nose.",
    },
    {
      icon: <Activity color={colors.primary} size={40} />,
      label: "1 thing you can TASTE",
      sub: "Focus on the inside of your mouth.",
    },
  ];

  const opacityValue = scaleValue.interpolate({
    inputRange: [1, 1.8],
    outputRange: [0.2, 0.8],
  });

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 80 }, // Bumped to 80 for iPhone 17 Pro
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <Text style={styles.title}>Ease</Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate("Settings");
              }}
              style={styles.settingsButton}
            >
              <Settings color={colors.primary} size={28} />
            </Pressable>
          </View>
          <Text style={styles.mantraDisplay}>
            "
            {mantras.length > 0
              ? mantras[currentMantraIndex].text
              : "Focus on your breath"}
            "
          </Text>
        </View>

        <View style={styles.bubbleContainer}>
          <Pressable onPress={toggleBreathing} style={styles.pressableArea}>
            <Animated.View
              style={[
                styles.bubble,
                {
                  transform: [{ scale: scaleValue }],
                  backgroundColor: isBreathing ? colors.primary : colors.muted,
                  opacity: opacityValue,
                },
              ]}
            />
            <View style={styles.iconOverlay}>
              <Wind color="white" size={40} />
              <Text style={styles.tapText}>
                {isBreathing ? "Tap to Stop" : "Tap to Start"}
              </Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.buttonGroup}>
          <Pressable
            onPress={() => navigation.navigate("Mood")}
            style={styles.moodCheckButton}
          >
            <Heart color={colors.secondary} size={20} />
            <Text style={styles.moodCheckText}>Log your mood for today</Text>
          </Pressable>

          <Pressable
            onPress={() => setGroundingModalVisible(true)}
            style={styles.groundingButton}
          >
            <Text style={styles.groundingText}>I need more help grounding</Text>
          </Pressable>

          <View style={styles.quickAccessRow}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setContactsModalVisible(true);
              }}
              style={styles.halfButton}
            >
              <Users color={colors.primary} size={24} />
              <Text style={styles.halfButtonText}>Safe Team</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setMantrasModalVisible(true);
              }}
              style={styles.halfButton}
            >
              <BookOpen color={colors.primary} size={24} />
              <Text style={styles.halfButtonText}>Mantras</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => navigation.navigate("Resources")}
            style={styles.secondaryButton}
          >
            <MapPin color={colors.primary} size={20} />
            <Text style={styles.secondaryButtonText}>Find Nearby Help</Text>
          </Pressable>

          <Pressable
            onPress={() => Linking.openURL("tel:988")}
            style={styles.sosButton}
          >
            <Phone color="white" size={24} />
            <Text style={styles.sosText}>Emergency: Call 988</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* --- MODALS BELOW THIS LINE REMAIN THE SAME --- */}

      {/* Grounding Modal */}
      <Modal animationType="slide" transparent visible={groundingModalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Pressable
              style={styles.closeButton}
              onPress={() => setGroundingModalVisible(false)}
            >
              <X color="white" size={24} />
            </Pressable>
            <View style={styles.stepContent}>
              {groundingSteps[groundingStep].icon}
              <Text style={styles.stepTitle}>
                {groundingSteps[groundingStep].label}
              </Text>
              <Text style={styles.stepSubText}>
                {groundingSteps[groundingStep].sub}
              </Text>
            </View>
            <Pressable
              style={styles.nextButton}
              onPress={() =>
                groundingStep < groundingSteps.length - 1
                  ? setGroundingStep(groundingStep + 1)
                  : (setGroundingModalVisible(false), setGroundingStep(0))
              }
            >
              <Text style={styles.nextButtonText}>
                {groundingStep === groundingSteps.length - 1
                  ? "I feel better"
                  : "Next Step"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Safe Contacts Modal */}
      <Modal animationType="slide" transparent visible={contactsModalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentLarge}>
            <View style={styles.modalHeader}>
              <View style={styles.row}>
                <Shield color="#55E6C1" size={24} />
                <Text style={styles.modalTitle}>Safe Team</Text>
              </View>
              <Pressable onPress={() => setContactsModalVisible(false)}>
                <X color="white" size={24} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              {contacts.map((contact) => (
                <View key={contact.id} style={styles.dataCard}>
                  <View>
                    <Text style={styles.cardMain}>{contact.name}</Text>
                    <Text style={styles.cardSub}>{contact.phone}</Text>
                  </View>
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${contact.phone}`)}
                    style={styles.cardCallButton}
                  >
                    <Phone color="#55E6C1" size={20} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Mantras Modal */}
      <Modal animationType="slide" transparent visible={mantrasModalVisible}>
        <View style={styles.modalOverlay}>
          {/* Removed the duplicate modalContentLarge wrapper here */}
          <View style={styles.modalContentLarge}>
            <View style={styles.modalHeader}>
              <View style={styles.row}>
                <BookOpen color="#55E6C1" size={24} />
                <Text style={styles.modalTitle}>My Mantras</Text>
              </View>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setMantrasModalVisible(false);
                }}
              >
                <X color="white" size={24} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={{ paddingBottom: 20 }} // Ensures the last mantra isn't clipped
              showsVerticalScrollIndicator={false}
            >
              {mantras.length > 0 ? (
                mantras.map((mantra) => (
                  <View key={mantra.id} style={styles.dataCard}>
                    <Text style={styles.cardMain}>{mantra.text}</Text>
                  </View>
                ))
              ) : (
                <Text
                  style={[
                    styles.cardSub,
                    { textAlign: "center", marginTop: 20 },
                  ]}
                >
                  No mantras added yet. Visit Settings to add some.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  header: {
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    position: "relative",
  },
  settingsButton: {
    position: "absolute",
    right: 0,
    padding: 5,
  },
  title: {
    color: "white",
    fontSize: 32,
    fontWeight: "bold",
    fontFamily: "Quicksand-Regular",
  },
  mantraDisplay: {
    color: colors.primary,
    fontSize: 16,
    fontStyle: "italic",
    marginTop: 10,
    textAlign: "center",
    paddingHorizontal: 10,
    fontFamily: "Quicksand-Regular",
  },
  bubbleContainer: {
    marginVertical: 30,
  },
  pressableArea: {
    alignItems: "center",
    justifyContent: "center",
    width: width * 0.6,
    height: width * 0.6,
  },
  bubble: {
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  iconOverlay: {
    position: "absolute",
    alignItems: "center",
  },
  tapText: {
    color: "white",
    marginTop: 12,
    opacity: 0.7,
    fontSize: 14,
    fontFamily: "Quicksand-Regular",
  },
  buttonGroup: {
    width: "100%",
    gap: 16,
  },
  groundingButton: {
    paddingVertical: 15,
    alignItems: "center",
  },
  groundingText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "600",
    textDecorationLine: "underline",
    fontFamily: "Quicksand-Regular",
  },
  quickAccessRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  halfButton: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: 20,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  halfButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
    fontFamily: "Quicksand-Regular",
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Quicksand-Regular",
  },
  sosButton: {
    backgroundColor: colors.danger,
    paddingVertical: 20,
    borderRadius: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  sosText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    marginLeft: 12,
    fontFamily: "Quicksand-Regular",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surface,
    height: height * 0.5,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 30,
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalContentLarge: {
    backgroundColor: colors.dark,
    height: height * 0.7,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
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
  modalScroll: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  closeButton: {
    alignSelf: "flex-end",
  },
  stepContent: {
    alignItems: "center",
    gap: 20,
  },
  stepTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "Quicksand-Regular",
  },
  stepSubText: {
    color: colors.lightGray,
    fontSize: 18,
    textAlign: "center",
    fontFamily: "Quicksand-Regular",
  },
  nextButton: {
    backgroundColor: colors.primary,
    width: "100%",
    paddingVertical: 18,
    borderRadius: 15,
    alignItems: "center",
  },
  nextButtonText: {
    color: colors.dark,
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Quicksand-Regular",
  },
  dataCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 15,
    marginBottom: 12,
  },
  cardMain: {
    color: "white",
    fontWeight: "bold",
    fontSize: 18,
    fontFamily: "Quicksand-Regular",
  },
  cardSub: {
    color: colors.lightGray,
    fontSize: 14,
    marginTop: 4,
  },
  cardCallButton: {
    padding: 12,
    backgroundColor: "#2d3e50",
    borderRadius: 12,
  },
  moodCheckButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 10,
    paddingVertical: 10,
  },
  moodCheckText: {
    color: colors.secondary,
    fontSize: 16,
    fontFamily: "Quicksand-Bold",
    textDecorationLine: "underline",
  },
});

export default StruggleScreen;
