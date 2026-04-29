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
} from "lucide-react-native";
import { colors } from "../theme/colors";
import { initDB } from "../utils/db";

const { width, height } = Dimensions.get("window");

const StruggleScreen = () => {
  const isFocused = useIsFocused();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const scaleValue = useRef(new Animated.Value(1)).current;
  const isBreathingRef = useRef(false);
  const rampTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const insets = useSafeAreaInsets();

  const mantrasRef = useRef<{ id: number; text: string }[]>([]);

  const [isBreathing, setIsBreathing] = useState(false);
  const [groundingModalVisible, setGroundingModalVisible] = useState(false);
  const [safeTeamModalVisible, setSafeTeamModalVisible] = useState(false);
  const [mantrasModalVisible, setMantrasModalVisible] = useState(false);
  const [groundingStep, setGroundingStep] = useState(0);
  const [contacts, setContacts] = useState<
    { id: number; name: string; phone: string }[]
  >([]);
  const [mantras, setMantras] = useState<{ id: number; text: string }[]>([]);

  // Cleanup timer if component unmounts while breathing
  useEffect(() => {
    return () => {
      if (rampTimer.current) clearInterval(rampTimer.current);
    };
  }, []);

  const loadData = async () => {
    try {
      const db = await initDB();
      const allContacts = await db.getAllAsync<{
        id: number;
        name: string;
        phone: string;
      }>("SELECT * FROM contacts");
      setContacts(allContacts);

      const allMantras = await db.getAllAsync<{ id: number; text: string }>(
        "SELECT * FROM mantras",
      );
      setMantras(allMantras);
      mantrasRef.current = allMantras;
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [isFocused]);

  const groundingExercises = [
    {
      icon: <Eye color={colors.primary} size={40} />,
      title: "5 Things You Can See",
      desc: "Look around and notice five things you hadn't noticed before.",
    },
    {
      icon: <Hand color={colors.primary} size={40} />,
      title: "4 Things You Can Feel",
      desc: "Notice the texture of your clothes, the surface you are touching.",
    },
    {
      icon: <Ear color={colors.primary} size={40} />,
      title: "3 Things You Can Hear",
      desc: "Listen closely. Can you hear the hum of a fridge? The wind?",
    },
    {
      icon: <Activity color={colors.primary} size={40} />,
      title: "2 Things You Can Smell",
      desc: "Breathe in. What scents are in the air around you?",
    },
    {
      icon: <Pizza color={colors.primary} size={40} />,
      title: "1 Thing You Can Taste",
      desc: "Take a sip of water or notice the current taste in your mouth.",
    },
  ];

  const toggleBreathing = () => {
    if (isBreathingRef.current) {
      stopBreathing();
    } else {
      startBreathing();
    }
  };

  const startBreathing = () => {
    isBreathingRef.current = true;
    setIsBreathing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Visual Animation (4s Inhale -> 2s Pause -> 4s Exhale -> 2s Pause)
    const inhale = Animated.timing(scaleValue, {
      toValue: 2,
      duration: 4000,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    });
    const holdFull = Animated.timing(scaleValue, {
      toValue: 2,
      duration: 2000,
      useNativeDriver: true,
    });
    const exhale = Animated.timing(scaleValue, {
      toValue: 1,
      duration: 4000,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    });
    const holdEmpty = Animated.timing(scaleValue, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: true,
    });

    Animated.loop(
      Animated.sequence([inhale, holdFull, exhale, holdEmpty]),
    ).start();

    // Haptics Orchestration Loop
    let timeElapsed = 0;
    rampTimer.current = setInterval(() => {
      const cycleTime = timeElapsed % 12000; // Total 12s cycle

      if (cycleTime < 4000) {
        // INHALE PHASE: Intensity ramps up
        if (cycleTime < 1500) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else if (cycleTime < 3000) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }
      } else if (cycleTime >= 6000 && cycleTime < 10000) {
        // EXHALE PHASE: Intensity winds down
        const exhaleTime = cycleTime - 6000;
        if (exhaleTime < 1500) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } else if (exhaleTime < 3000) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
      // Times between 4000-6000 and 10000-12000 are the PAUSE phases (No haptics)

      timeElapsed += 500;
    }, 500); // Check and thump every half second
  };

  const stopBreathing = () => {
    isBreathingRef.current = false;
    setIsBreathing(false);
    scaleValue.stopAnimation();
    Animated.timing(scaleValue, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    if (rampTimer.current) {
      clearInterval(rampTimer.current);
      rampTimer.current = null;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const nextGroundingStep = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (groundingStep < groundingExercises.length - 1) {
      setGroundingStep(groundingStep + 1);
    } else {
      setGroundingModalVisible(false);
      setGroundingStep(0);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.headerRightButton, { top: insets.top + 10, right: 16 }]}
        onPress={() => navigation.navigate("Settings")}
        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
      >
        <Settings color={colors.lightGray} size={24} />
      </Pressable>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10 },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isBreathing} // Lock scroll while breathing
      >
        <View style={styles.header}>
          <Text style={styles.title}>Ease</Text>
          <Text style={styles.subtitle}>Breathe with the circle</Text>
        </View>

        <Pressable
          style={styles.bubbleContainer}
          onPress={toggleBreathing} // Changed to Tap Toggle
          delayPressIn={0}
        >
          <Animated.View
            style={[
              styles.breathingCircle,
              { transform: [{ scale: scaleValue }] },
            ]}
            pointerEvents="none"
          >
            <Wind color={colors.primary} size={40} />
          </Animated.View>
          <Text style={styles.instructionText}>
            {/* Updated Instruction Text */}
            {isBreathing ? "Tap to stop" : "Tap to breathe"}
          </Text>
        </Pressable>

        <Pressable
          style={styles.moodCheckButton}
          onPress={() => navigation.navigate("Mood")}
          hitSlop={{ top: 15, bottom: 15, left: 20, right: 20 }}
        >
          <Text style={styles.moodCheckText}>Log your mood</Text>
        </Pressable>

        <View style={styles.buttonGroup}>
          <View style={styles.row}>
            <Pressable
              style={styles.halfButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSafeTeamModalVisible(true);
              }}
            >
              <Users color={colors.primary} size={24} />
              <Text style={styles.buttonText}>Safe Team</Text>
            </Pressable>

            <Pressable
              style={styles.halfButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMantrasModalVisible(true);
              }}
            >
              <Quote color={colors.primary} size={24} />
              <Text style={styles.buttonText}>Mantras</Text>
            </Pressable>
          </View>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setGroundingModalVisible(true);
            }}
          >
            <Eye color={colors.primary} size={24} />
            <Text style={styles.buttonTextDark}>5-4-3-2-1 Grounding</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("Resources");
            }}
          >
            <MapPin color={colors.primary} size={24} />
            <Text style={styles.buttonTextDark}>Local Safe Spaces</Text>
          </Pressable>

          <Pressable
            style={styles.sosButton}
            onPress={() => {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning,
              );
              Linking.openURL("tel:988");
            }}
          >
            <Phone color="white" size={24} />
            <Text style={styles.sosText}>Call 988 Lifeline</Text>
          </Pressable>
        </View>

        {/* --- GROUNDING MODAL --- */}
        <Modal
          visible={groundingModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setGroundingModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Pressable
                style={styles.closeButton}
                onPress={() => setGroundingModalVisible(false)}
              >
                <X color={colors.lightGray} size={24} />
              </Pressable>
              <View style={styles.stepContent}>
                {groundingExercises[groundingStep].icon}
                <Text style={styles.stepTitle}>
                  {groundingExercises[groundingStep].title}
                </Text>
                <Text style={styles.stepSubText}>
                  {groundingExercises[groundingStep].desc}
                </Text>
                <Pressable
                  style={styles.nextButton}
                  onPress={nextGroundingStep}
                >
                  <Text style={styles.nextButtonText}>
                    {groundingStep < groundingExercises.length - 1
                      ? "Next Step"
                      : "Finish"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* --- SAFE TEAM MODAL --- */}
        <Modal
          visible={safeTeamModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSafeTeamModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainerLarge}>
              <View style={styles.modalHeader}>
                <View style={styles.row}>
                  <Shield color={colors.primary} size={28} />
                  <Text style={styles.modalTitle}>Safe Team</Text>
                </View>
                <Pressable
                  onPress={() => setSafeTeamModalVisible(false)}
                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                >
                  <X color={colors.lightGray} size={28} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalScroll}
                showsVerticalScrollIndicator={false}
              >
                {contacts.length === 0 ? (
                  <View style={styles.emptyStateContainer}>
                    <Users color={colors.lightGray} size={48} />
                    <Text style={styles.emptyStateText}>
                      No safe contacts added yet.
                    </Text>
                    <Pressable
                      style={styles.modalAddButton}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSafeTeamModalVisible(false);
                        navigation.navigate("Settings");
                      }}
                    >
                      <Text style={styles.modalAddButtonText}>
                        Add a Contact
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    {contacts.map((contact) => (
                      <View key={contact.id} style={styles.dataCard}>
                        <View>
                          <Text style={styles.cardMain}>{contact.name}</Text>
                          <Text style={styles.cardSub}>{contact.phone}</Text>
                        </View>
                        <Pressable
                          style={styles.cardCallButton}
                          onPress={() => {
                            Haptics.impactAsync(
                              Haptics.ImpactFeedbackStyle.Medium,
                            );
                            Linking.openURL(`tel:${contact.phone}`);
                          }}
                        >
                          <Phone color={colors.secondary} size={20} />
                        </Pressable>
                      </View>
                    ))}
                    <Pressable
                      style={styles.modalAddButtonSecondary}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSafeTeamModalVisible(false);
                        navigation.navigate("Settings");
                      }}
                    >
                      <Text style={styles.modalAddButtonTextSecondary}>
                        + Add Another Contact
                      </Text>
                    </Pressable>
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* --- MANTRAS MODAL --- */}
        <Modal
          visible={mantrasModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setMantrasModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainerLarge}>
              <View style={styles.modalHeader}>
                <View style={styles.row}>
                  <BookOpen color={colors.primary} size={28} />
                  <Text style={styles.modalTitle}>My Mantras</Text>
                </View>
                <Pressable
                  onPress={() => setMantrasModalVisible(false)}
                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                >
                  <X color={colors.lightGray} size={28} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalScroll}
                showsVerticalScrollIndicator={false}
              >
                {mantras.length === 0 ? (
                  <View style={styles.emptyStateContainer}>
                    <Quote color={colors.lightGray} size={48} />
                    <Text style={styles.emptyStateText}>
                      No mantras added yet.
                    </Text>
                    <Pressable
                      style={styles.modalAddButton}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setMantrasModalVisible(false);
                        navigation.navigate("Settings");
                      }}
                    >
                      <Text style={styles.modalAddButtonText}>
                        Add a Mantra
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    {mantras.map((mantra) => (
                      <View key={mantra.id} style={styles.dataCard}>
                        <Text style={styles.cardMain}>{mantra.text}</Text>
                      </View>
                    ))}
                    <Pressable
                      style={styles.modalAddButtonSecondary}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setMantrasModalVisible(false);
                        navigation.navigate("Settings");
                      }}
                    >
                      <Text style={styles.modalAddButtonTextSecondary}>
                        + Add Another Mantra
                      </Text>
                    </Pressable>
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </ScrollView>
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
    justifyContent: "space-between",
    paddingHorizontal: 24,
  },
  headerLeftButton: {
    position: "absolute",
    left: 0,
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    elevation: 10,
  },
  headerRightButton: {
    position: "absolute",
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    elevation: 10,
  },
  header: {
    width: "100%",
    alignItems: "center",
  },
  title: {
    color: "white",
    fontSize: 28,
    fontWeight: "bold",
    fontFamily: "Quicksand-Bold",
  },
  subtitle: {
    color: colors.lightGray,
    fontSize: 16,
    fontFamily: "Quicksand-Regular",
    marginTop: 4,
  },
  bubbleContainer: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 180,
  },
  breathingCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(85, 230, 193, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  instructionText: {
    color: colors.primary,
    marginTop: 30,
    fontSize: 16,
    fontFamily: "Quicksand-Regular",
  },
  buttonGroup: {
    width: "100%",
    gap: 12,
  },
  halfButton: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  sosButton: {
    backgroundColor: colors.danger,
    paddingVertical: 16,
    borderRadius: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Quicksand-Bold",
  },
  buttonTextDark: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Quicksand-Bold",
  },
  sosText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Quicksand-Bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surface,
    padding: 30,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingBottom: Platform.OS === "ios" ? 50 : 30,
  },
  modalContainerLarge: {
    backgroundColor: colors.dark,
    height: height * 0.85,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    color: "white",
    fontSize: 26,
    fontWeight: "bold",
    fontFamily: "Quicksand-Bold",
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
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 15,
  },
  emptyStateText: {
    color: colors.lightGray,
    fontSize: 16,
    textAlign: "center",
    fontFamily: "Quicksand-Regular",
  },
  modalAddButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginTop: 10,
  },
  modalAddButtonText: {
    color: colors.dark,
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Quicksand-Bold",
  },
  modalAddButtonSecondary: {
    borderWidth: 2,
    borderColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: "center",
    marginTop: 5,
    marginBottom: 20,
  },
  modalAddButtonTextSecondary: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Quicksand-Bold",
  },
});

export default StruggleScreen;
