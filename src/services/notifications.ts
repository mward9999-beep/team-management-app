export async function registerForPushNotifications() {
  return {
    ok: true,
    token: undefined as string | undefined
  };
}

export async function scheduleLocalReminder(title: string, body: string) {
  return {
    body,
    ok: true,
    title
  };
}
