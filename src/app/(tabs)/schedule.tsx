import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { StatusPill } from "@/components/StatusPill";
import { colors, radii, spacing } from "@/constants/theme";
import { useCurrentTeam } from "@/hooks/useCurrentTeam";
import type { Availability, TeamEvent } from "@/types/team";
import { formatAvailability, getAvailabilityCounts } from "@/utils/availability";

const currentUserId = "alex";
const choices: Availability[] = ["yes", "no", "maybe"];

export default function ScheduleScreen() {
  const { teamEvents, teamMembers } = useCurrentTeam();
  const [expandedEventId, setExpandedEventId] = useState(teamEvents[0]?.id);
  const [myAvailability, setMyAvailability] = useState<Record<string, Availability>>(
    {}
  );

  return (
    <Screen>
      <SectionHeader title="Schedule" />
      <Text style={styles.intro}>
        Mark your availability and tap an event to see the whole team's status.
      </Text>

      {teamEvents.map((event) => {
        const availability = {
          ...event.availability,
          [currentUserId]: myAvailability[event.id] ?? event.availability[currentUserId]
        };
        const counts = getAvailabilityCounts(Object.values(availability));
        const isExpanded = expandedEventId === event.id;

        return (
          <Card key={event.id}>
            <Pressable
              onPress={() => setExpandedEventId(isExpanded ? undefined : event.id)}
              style={styles.eventHeader}
            >
              <View style={styles.eventTitleGroup}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Text style={styles.eventMeta}>
                  {event.dateLabel} at {event.location}
                </Text>
              </View>
              <StatusPill label={event.type} tone={event.type === "Game" ? "red" : "blue"} />
            </Pressable>

            <View style={styles.countRow}>
              <StatusPill label={`${counts.yes} yes`} tone="green" />
              <StatusPill label={`${counts.maybe} maybe`} tone="blue" />
              <StatusPill label={`${counts.no} no`} tone="red" />
            </View>

            <AvailabilityPicker
              event={event}
              selected={availability[currentUserId]}
              onSelect={(value) =>
                setMyAvailability((current) => ({
                  ...current,
                  [event.id]: value
                }))
              }
            />

            {isExpanded ? (
              <View style={styles.availabilityList}>
                {teamMembers.map((member) => (
                  <View key={member.id} style={styles.memberRow}>
                    <View>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <Text style={styles.memberRole}>{member.position}</Text>
                    </View>
                    <StatusPill
                      label={formatAvailability(availability[member.id])}
                      tone={getAvailabilityTone(availability[member.id])}
                    />
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}

type AvailabilityPickerProps = {
  event: TeamEvent;
  onSelect: (value: Availability) => void;
  selected: Availability;
};

function AvailabilityPicker({
  event,
  onSelect,
  selected
}: AvailabilityPickerProps) {
  const label = useMemo(() => `Availability for ${event.title}`, [event.title]);

  return (
    <View accessibilityLabel={label} style={styles.picker}>
      {choices.map((choice) => {
        const isSelected = selected === choice;

        return (
          <Pressable
            key={choice}
            onPress={() => onSelect(choice)}
            style={[
              styles.choice,
              isSelected && styles.choiceSelected,
              choice === "no" && isSelected && styles.choiceNo,
              choice === "maybe" && isSelected && styles.choiceMaybe
            ]}
          >
            <Text style={[styles.choiceText, isSelected && styles.choiceTextSelected]}>
              {formatAvailability(choice)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function getAvailabilityTone(value: Availability) {
  if (value === "yes") {
    return "green";
  }

  if (value === "no") {
    return "red";
  }

  return "blue";
}

const styles = StyleSheet.create({
  intro: {
    color: colors.blue100,
    fontSize: 14,
    fontWeight: "600"
  },
  eventHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  eventTitleGroup: {
    flex: 1,
    gap: spacing.xs
  },
  eventTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  eventMeta: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600"
  },
  countRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md
  },
  picker: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md
  },
  choice: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.sm,
    borderWidth: 1,
    flex: 1,
    minHeight: 44,
    justifyContent: "center"
  },
  choiceSelected: {
    backgroundColor: colors.success,
    borderColor: colors.success
  },
  choiceNo: {
    backgroundColor: colors.red600,
    borderColor: colors.red600
  },
  choiceMaybe: {
    backgroundColor: colors.blue700,
    borderColor: colors.blue700
  },
  choiceText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900"
  },
  choiceTextSelected: {
    color: colors.white
  },
  availabilityList: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm
  },
  memberRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md
  },
  memberName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800"
  },
  memberRole: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2
  }
});
