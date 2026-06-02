import { StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing } from "@/constants/theme";

type StatusPillProps = {
  label: string;
  tone?: "blue" | "red" | "green" | "neutral";
};

export function StatusPill({ label, tone = "neutral" }: StatusPillProps) {
  return (
    <View style={[styles.pill, containerStyles[tone]]}>
      <Text style={[styles.label, labelStyles[tone]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  label: {
    fontSize: 12,
    fontWeight: "800"
  },
  blue: {
    backgroundColor: colors.blue100
  },
  blueText: {
    color: colors.blue800
  },
  red: {
    backgroundColor: colors.red100
  },
  redText: {
    color: colors.red600
  },
  green: {
    backgroundColor: "#E5F6ED"
  },
  greenText: {
    color: colors.success
  },
  neutral: {
    backgroundColor: colors.surface
  },
  neutralText: {
    color: colors.muted
  }
});

const containerStyles = {
  blue: styles.blue,
  green: styles.green,
  neutral: styles.neutral,
  red: styles.red
};

const labelStyles = {
  blue: styles.blueText,
  green: styles.greenText,
  neutral: styles.neutralText,
  red: styles.redText
};
