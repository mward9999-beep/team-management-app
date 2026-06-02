import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing } from "@/constants/theme";

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  tone?: "primary" | "secondary";
};

export function ActionButton({
  label,
  onPress,
  tone = "primary"
}: ActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === "secondary" && styles.secondary,
        pressed && styles.pressed
      ]}
    >
      <Text
        style={[
          styles.label,
          tone === "secondary" && styles.secondaryLabel
        ]}
      >
        {label}
      </Text>
      <View style={[styles.dot, tone === "secondary" && styles.secondaryDot]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.red600,
    borderRadius: radii.md,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 50,
    paddingHorizontal: spacing.md
  },
  secondary: {
    backgroundColor: colors.blue100
  },
  pressed: {
    opacity: 0.86
  },
  label: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "900"
  },
  secondaryLabel: {
    color: colors.blue800
  },
  dot: {
    backgroundColor: colors.white,
    borderRadius: 5,
    height: 10,
    width: 10
  },
  secondaryDot: {
    backgroundColor: colors.blue700
  }
});
