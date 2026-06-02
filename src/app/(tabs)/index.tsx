import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { ActionButton } from "@/components/ActionButton";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { StatCard } from "@/components/StatCard";
import { StatusPill } from "@/components/StatusPill";
import { TeamLogo } from "@/components/TeamLogo";
import { colors, spacing } from "@/constants/theme";
import { useCurrentTeam } from "@/hooks/useCurrentTeam";
import { getAvailabilityCounts } from "@/utils/availability";

export default function HomeScreen() {
  const { currentTeam, teamEvents, teamMembers, teamMessages } = useCurrentTeam();
  const nextEvent = teamEvents[0];
  const unreadMessages = teamMessages.filter((message) => message.unread).length;
  const pinnedMessages = teamMessages.filter((message) => message.pinned).length;
  const availabilityCounts = getAvailabilityCounts(
    Object.values(nextEvent.availability)
  );

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.brandRow}>
          <TeamLogo size={52} />
          <View style={styles.brandText}>
            <Text style={styles.appName}>Team App MVP</Text>
            <Text style={styles.teamName}>{currentTeam.name}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Record" value={currentTeam.record} />
          <StatCard label="Roster" value={`${teamMembers.length}`} />
          <StatCard label="Unread" value={`${unreadMessages}`} />
        </View>
      </View>

      <SectionHeader title="Next Up" />
      <Card>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>{nextEvent.title}</Text>
            <Text style={styles.cardMeta}>
              {nextEvent.dateLabel} at {nextEvent.location}
            </Text>
          </View>
          <StatusPill label={nextEvent.type} tone="red" />
        </View>
        <View style={styles.availabilityRow}>
          <StatusPill label={`${availabilityCounts.yes} yes`} tone="green" />
          <StatusPill label={`${availabilityCounts.maybe} maybe`} tone="blue" />
          <StatusPill label={`${availabilityCounts.no} no`} tone="red" />
        </View>
      </Card>

      <SectionHeader title="Quick Actions" />
      <View style={styles.actionGrid}>
        <ActionButton
          label="Open Schedule"
          onPress={() => router.push("/schedule")}
        />
        <ActionButton
          label="View Roster"
          onPress={() => router.push("/roster")}
          tone="secondary"
        />
        <ActionButton
          label="Read Messages"
          onPress={() => router.push("/messages")}
          tone="secondary"
        />
      </View>

      <SectionHeader title="Team Pulse" />
      <Card>
        <View style={styles.pulseRow}>
          <Text style={styles.pulseLabel}>Season</Text>
          <Text style={styles.pulseValue}>{currentTeam.season}</Text>
        </View>
        <View style={styles.pulseRow}>
          <Text style={styles.pulseLabel}>Pinned messages</Text>
          <Text style={styles.pulseValue}>{pinnedMessages}</Text>
        </View>
        <View style={styles.pulseRow}>
          <Text style={styles.pulseLabel}>Team files</Text>
          <Text style={styles.pulseValue}>Ready for upload flow</Text>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.lg
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    paddingTop: spacing.sm
  },
  brandText: {
    flex: 1,
    gap: spacing.xs
  },
  appName: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "800"
  },
  teamName: {
    color: colors.white,
    fontSize: 30,
    fontWeight: "900"
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    marginTop: spacing.xs
  },
  availabilityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md
  },
  actionGrid: {
    gap: spacing.sm
  },
  pulseRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm
  },
  pulseLabel: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700"
  },
  pulseValue: {
    color: colors.ink,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "right"
  }
});
