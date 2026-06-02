import type { Availability } from "@/types/team";

export function formatAvailability(value: Availability) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function getAvailabilityCounts(values: Availability[]) {
  return values.reduce(
    (counts, value) => {
      counts[value] += 1;
      return counts;
    },
    { yes: 0, no: 0, maybe: 0 }
  );
}
