import type { TeamEvent, TeamFile, TeamMember, TeamMessage } from "@/types/team";

export const currentTeam = {
  id: "team-blue",
  name: "Team Blue",
  season: "Spring 2026",
  record: "8-2-1"
};

export const teamMembers: TeamMember[] = [
  { id: "alex", name: "Alex Parker", role: "Player", position: "Forward" },
  { id: "jordan", name: "Jordan Lee", role: "Player", position: "Defense" },
  { id: "sam", name: "Sam Rivera", role: "Coach", position: "Head Coach" },
  { id: "taylor", name: "Taylor Brooks", role: "Manager", position: "Team Admin" }
];

export const teamEvents: TeamEvent[] = [
  {
    id: "home-game",
    title: "Home Game",
    dateLabel: "Sat, 10:00 AM",
    location: "Arena One",
    type: "Game",
    availability: {
      alex: "yes",
      jordan: "yes",
      sam: "yes",
      taylor: "maybe"
    }
  },
  {
    id: "practice",
    title: "Practice Night",
    dateLabel: "Mon, 6:30 PM",
    location: "North Field",
    type: "Practice",
    availability: {
      alex: "yes",
      jordan: "maybe",
      sam: "yes",
      taylor: "yes"
    }
  }
];

export const teamMessages: TeamMessage[] = [
  {
    id: "jerseys",
    sender: "Coach Sam",
    title: "Saturday gear",
    body: "Bring both jerseys for Saturday's home game.",
    pinned: true,
    unread: true
  },
  {
    id: "snacks",
    sender: "Team Manager",
    title: "Snack rotation",
    body: "Snack rotation has been updated for next week.",
    pinned: false,
    unread: true
  }
];

export const teamFiles: TeamFile[] = [
  { id: "lineup", name: "Starting lineup photo", type: "Picture" },
  { id: "waiver", name: "Tournament waiver.pdf", type: "File" }
];
