import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { colors } from "@/constants/theme";

export default function RootLayout() {
  return (
    <>
      <StatusBar backgroundColor={colors.blue900} style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.blue900 }
        }}
      />
    </>
  );
}
