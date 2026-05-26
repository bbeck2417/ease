import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { colors } from "../theme/colors";

type AppHeaderProps = {
  title: string;
  onBackPress?: () => void;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
};

const AppHeader = ({ title, onBackPress, leftSlot, rightSlot }: AppHeaderProps) => {
  const insets = useSafeAreaInsets();

  const leftContent = leftSlot ??
    (onBackPress ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBackPress}
        style={styles.sideButton}
        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
      >
        <ArrowLeft color={colors.primary} size={24} pointerEvents="none" />
      </Pressable>
    ) : (
      <View style={styles.sideSpacer} />
    ));

  return (
    <View style={[styles.headerBar, { paddingTop: insets.top, height: insets.top + 56 }]}>
      {leftContent}
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.rightWrap}>{rightSlot ?? <View style={styles.sideSpacer} />}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerBar: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
    backgroundColor: colors.dark,
    paddingHorizontal: 8,
  },
  sideButton: {
    width: 60,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  sideSpacer: {
    width: 60,
    height: 56,
  },
  rightWrap: {
    minWidth: 60,
    height: 56,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  headerTitle: {
    color: "white",
    fontSize: 28,
    fontFamily: "Quicksand-Bold",
    flexShrink: 1,
    textAlign: "center",
  },
});

export default AppHeader;
