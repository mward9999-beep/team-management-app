import { StyleSheet, Text, View } from "react-native";

import { colors, radii } from "@/constants/theme";

type TeamLogoProps = {
  size?: number;
};

export function TeamLogo({ size = 44 }: TeamLogoProps) {
  return (
    <View
      style={[
        styles.logo,
        {
          borderRadius: Math.min(radii.md, size / 4),
          height: size,
          width: size
        }
      ]}
    >
      <Text style={[styles.logoText, { fontSize: size * 0.48 }]}>T</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    alignItems: "center",
    backgroundColor: colors.blue700,
    borderColor: colors.white,
    borderWidth: 2,
    justifyContent: "center"
  },
  logoText: {
    color: colors.white,
    fontWeight: "900"
  }
});
