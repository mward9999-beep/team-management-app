import {
  currentTeam,
  teamEvents,
  teamFiles,
  teamMembers,
  teamMessages
} from "@/data/mockTeam";

export function useCurrentTeam() {
  return {
    currentTeam,
    teamEvents,
    teamFiles,
    teamMembers,
    teamMessages
  };
}
