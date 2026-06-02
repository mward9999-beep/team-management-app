export type ApiResult<T> = Promise<T>;

export async function getCurrentUser() {
  return {
    id: "alex",
    name: "Alex Parker",
    role: "Player"
  };
}

export async function saveAvailability(eventId: string, availability: string) {
  return {
    availability,
    eventId,
    ok: true
  };
}
