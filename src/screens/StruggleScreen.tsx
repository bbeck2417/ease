import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
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
  Headphones,
} from "lucide-react-native";
import { colors } from "../theme/colors";
import { initDB } from "../utils/db";
import AppHeader from "../components/AppHeader";

const { width, height } = Dimensions.get("window");

const StruggleScreen = () => {
  const isFocused = useIsFocused();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const scaleValue = useRef(new Animated.Value(1)).current;
  const isBreathingRef = useRef(false);
  const insets = useSafeAreaInsets();

  const lastScaleRef = useRef(1);
  const lastHapticScaleRef = useRef(1);

  const [isBreathing, setIsBreathing] = useState(false);
  const [groundingModalVisible, setGroundingModalVisible] = useState(false);
  const [safeTeamModalVisible, setSafeTeamModalVisible] = useState(false);
  const [mantrasModalVisible, setMantrasModalVisible] = useState(false);
  const [groundingStep, setGroundingStep] = useState(0);
  const [contacts, setContacts] = useState<
    { id: number; name: string; phone: string }[]
  >([]);
  const [mantras, setMantras] = useState<{ id: number; text: string }[]>([]);
  const [activeMantraIndex, setActiveMantraIndex] = useState(0);

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
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [isFocused]);

  useEffect(() => {
    const listenerId = scaleValue.addListener(({ value }) => {
      if (!isBreathingRef.current) return;

      const isHolding = value === lastScaleRef.current;
      const isInhaling = value > lastScaleRef.current;
      const isExhaling = value < lastScaleRef.current;

      if (!isHolding) {
        if (Math.abs(value - lastHapticScaleRef.current) >= 0.125) {
          lastHapticScaleRef.current = value;

          let style = Haptics.ImpactFeedbackStyle.Medium;

          if (isInhaling) {
            if (value < 1.33) style = Haptics.ImpactFeedbackStyle.Light;
            else if (value < 1.66) style = Haptics.ImpactFeedbackStyle.Medium;
            else style = Haptics.ImpactFeedbackStyle.Heavy;
          } else if (isExhaling) {
            if (value > 1.66) style = Haptics.ImpactFeedbackStyle.Heavy;
            else if (value > 1.33) style = Haptics.ImpactFeedbackStyle.Medium;
            else style = Haptics.ImpactFeedbackStyle.Light;
          }

          Haptics.impactAsync(style);
        }
      }

      lastScaleRef.current = value;
    });

    return () => {
      scaleValue.removeListener(listenerId);
    };
  }, [scaleValue]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isBreathing && mantras.length > 1) {
      interval = setInterval(() => {
        setActiveMantraIndex((prevIndex) => (prevIndex + 1) % mantras.length);
      }, 12000);
    } else if (!isBreathing) {
      setActiveMantraIndex(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isBreathing, mantras.length]);

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
    lastScaleRef.current = 1;
    lastHapticScaleRef.current = 1;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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

  const hitSlop = { top: 20, bottom: 20, left: 20, right: 20 };

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <AppHeader
        title="Ease"
        leftSlot={(
          <TouchableOpacity
            style={styles.headerSideButton}
            onPress={() => navigation.navigate("Measure")}
            hitSlop={hitSlop}
            activeOpacity={0.75}
          >
            <Heart color={colors.primary} size={28} pointerEvents="none" />
          </TouchableOpacity>
        )}
        rightSlot={(
          <TouchableOpacity
            style={styles.headerSideButton}
            onPress={() => navigation.navigate("Settings")}
            hitSlop={hitSlop}
            activeOpacity={0.75}
          >
            <Settings color={colors.lightGray} size={28} pointerEvents="none" />
          </TouchableOpacity>
        )}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isBreathing}
      >
        <View style={styles.mantraSection}>
          <Text style={styles.subtitle}>
            {!isBreathing
              ? "Breathe with the circle"
              : mantras.length > 0
                ? mantras[activeMantraIndex].text
                : "This too shall pass."}
          </Text>
        </View>

        <Pressable style={styles.bubbleContainer} onPress={toggleBreathing}>
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
            {isBreathing ? "Tap to stop" : "Tap to breathe"}
          </Text>
        </Pressable>

        <Pressable
          style={styles.moodCheckButton}
          onPress={() => navigation.navigate("Mood")}
          hitSlop={hitSlop}
        >
          <Text style={styles.moodCheckText}>Log your mood</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate("Meditation");
          }}
        >
          <Headphones color={colors.primary} size={24} />
          <Text style={styles.buttonTextDark}>Meditation Sounds</Text>
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
            <Text style={styles.buttonTextDark}>Find Local Resources</Text>
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
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              >
                <X color={colors.lightGray} size={24} pointerEvents="none" />
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
                  style={styles.modalCloseButton}
                  hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
                  <X color={colors.lightGray} size={28} pointerEvents="none" />
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
                  style={styles.modalCloseButton}
                  hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
                  <X color={colors.lightGray} size={28} pointerEvents="none" />
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  headerSideButton: {
    width: 60,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
  },
  mantraSection: {
    width: "100%",
    alignItems: "center",
    marginTop: 10,
  },
  subtitle: {
    color: colors.lightGray,
    fontSize: 16,
    fontFamily: "Quicksand-Regular",
    textAlign: "center",
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
    borderWidth: 1,
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
    fontWeight: "400",
    fontFamily: "Quicksand",
  },
  buttonTextDark: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "400",
    fontFamily: "Quicksand",
  },
  sosText: {
    color: "white",
    fontSize: 20,
    fontWeight: "500",
    fontFamily: "Quicksand",
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
  modalCloseButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
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
