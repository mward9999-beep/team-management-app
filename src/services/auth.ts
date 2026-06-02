export type AuthUser = {
  email?: string;
  id: string;
  name: string;
};

export async function getSignedInUser(): Promise<AuthUser | null> {
  return {
    id: "alex",
    name: "Alex Parker"
  };
}

export async function signOut() {
  return { ok: true };
}
