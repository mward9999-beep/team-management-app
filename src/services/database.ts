type CollectionName = "teams" | "users" | "events" | "messages";

export async function getCollection<T>(_collectionName: CollectionName): Promise<T[]> {
  return [];
}

export async function saveDocument<T>(
  _collectionName: CollectionName,
  documentId: string,
  data: T
) {
  return {
    data,
    documentId,
    ok: true
  };
}
