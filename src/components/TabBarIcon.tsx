import { StyleSheet, Text, View } from "react-native";

import { colors, radii } from "@/constants/theme";

type TabBarIconProps = {
  color: string;
  focused: boolean;
  label: string;
};

export function TabBarIcon({ color, focused, label }: TabBarIconProps) {
  return (
    <View
      style={[
        styles.icon,
        focused && { backgroundColor: colors.red100, borderColor: color }
      ]}
    >
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: radii.sm,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  label: {
    fontSize: 13,
    fontWeight: "900"
  }
});
