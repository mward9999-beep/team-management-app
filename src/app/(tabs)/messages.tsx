import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { StatusPill } from "@/components/StatusPill";
import { colors, radii, spacing } from "@/constants/theme";
import { useCurrentTeam } from "@/hooks/useCurrentTeam";

export default function MessagesScreen() {
  const { teamMessages } = useCurrentTeam();
  const [query, setQuery] = useState("");
  const [pinnedIds, setPinnedIds] = useState(
    () => new Set(teamMessages.filter((message) => message.pinned).map((message) => message.id))
  );

  const filteredMessages = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return teamMessages
      .filter((message) => {
        if (!normalizedQuery) {
          return true;
        }

        return [message.sender, message.title, message.body]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((a, b) => Number(pinnedIds.has(b.id)) - Number(pinnedIds.has(a.id)));
  }, [pinnedIds, query, teamMessages]);

  function togglePinned(messageId: string) {
    setPinnedIds((current) => {
      const next = new Set(current);

      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }

      return next;
    });
  }

  return (
    <Screen>
      <SectionHeader title="Messages" />
      <TextInput
        autoCapitalize="none"
        clearButtonMode="while-editing"
        onChangeText={setQuery}
        placeholder="Search messages"
        placeholderTextColor={colors.muted}
        style={styles.search}
        value={query}
      />

      {filteredMessages.map((message) => {
        const isPinned = pinnedIds.has(message.id);

        return (
          <Card key={message.id}>
            <View style={styles.messageHeader}>
              <View style={styles.messageTitleGroup}>
                <Text style={styles.sender}>{message.sender}</Text>
                <Text style={styles.title}>{message.title}</Text>
              </View>
              {isPinned ? <StatusPill label="Pinned" tone="red" /> : null}
            </View>

            <Text style={styles.body}>{message.body}</Text>

            <View style={styles.messageFooter}>
              {message.unread ? <StatusPill label="Unread" tone="blue" /> : <View />}
              <Pressable
                onPress={() => togglePinned(message.id)}
                style={({ pressed }) => [styles.pinButton, pressed && styles.pressed]}
              >
                <Text style={styles.pinButtonText}>
                  {isPinned ? "Unpin" : "Pin"}
                </Text>
              </Pressable>
            </View>
          </Card>
        );
      })}

      {filteredMessages.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>No messages found</Text>
          <Text style={styles.emptyBody}>Try a different keyword.</Text>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
    minHeight: 52,
    paddingHorizontal: spacing.md
  },
  messageHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  messageTitleGroup: {
    flex: 1,
    gap: spacing.xs
  },
  sender: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  title: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  body: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
    marginTop: spacing.sm
  },
  messageFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md
  },
  pinButton: {
    backgroundColor: colors.red600,
    borderRadius: radii.sm,
    minHeight: 38,
    minWidth: 82,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  pressed: {
    opacity: 0.86
  },
  pinButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "900"
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  emptyBody: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    marginTop: spacing.xs
  }
});
