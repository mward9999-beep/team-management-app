import { StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { StatusPill } from "@/components/StatusPill";
import { colors, spacing } from "@/constants/theme";
import { useCurrentTeam } from "@/hooks/useCurrentTeam";

export default function RosterScreen() {
  const { currentTeam, teamMembers } = useCurrentTeam();

  return (
    <Screen>
      <SectionHeader title="Roster" />
      <Text style={styles.intro}>{currentTeam.name} members and staff.</Text>

      {teamMembers.map((member) => (
        <Card key={member.id}>
          <View style={styles.memberRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{member.name.charAt(0)}</Text>
            </View>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{member.name}</Text>
              <Text style={styles.position}>{member.position}</Text>
            </View>
            <StatusPill
              label={member.role}
              tone={member.role === "Player" ? "blue" : "red"}
            />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    color: colors.blue100,
    fontSize: 14,
    fontWeight: "600"
  },
  memberRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.blue100,
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  avatarText: {
    color: colors.blue800,
    fontSize: 18,
    fontWeight: "900"
  },
  memberInfo: {
    flex: 1,
    gap: 2
  },
  memberName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  position: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600"
  }
});
