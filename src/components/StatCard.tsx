import { StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing } from "@/constants/theme";

type StatCardProps = {
  label: string;
  value: string;
};

export function StatCard({ label, value }: StatCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    flex: 1,
    gap: spacing.xs,
    minHeight: 78,
    padding: spacing.md
  },
  value: {
    color: colors.blue900,
    fontSize: 22,
    fontWeight: "900"
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  }
});
