import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "@/constants/theme";

type SectionHeaderProps = {
  actionLabel?: string;
  onActionPress?: () => void;
  title: string;
};

export function SectionHeader({
  actionLabel,
  onActionPress,
  title
}: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {actionLabel ? (
        <Pressable onPress={onActionPress} hitSlop={spacing.sm}>
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  title: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "800"
  },
  action: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800"
  }
});
