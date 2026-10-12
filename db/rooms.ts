/** Netlify Database storage adapter.  Room serialization and gameplay stay unchanged. */
import { getDatabase } from "@netlify/database";

export type StoredRoom = { data: string; revision: number };

export async function findRoom(id: string): Promise<StoredRoom | null> {
  const records = await getDatabase().sql<StoredRoom>`
    SELECT data, revision FROM rooms WHERE id = ${id}
  `;
  return records[0] ?? null;
}

export async function createRoom(data: string): Promise<string> {
  // 8 hex digits, same as the original. Retry the rare collision rather than fail.
  for (let attempt = 0; attempt < 8; attempt++) {
    const id = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
    const inserted = await getDatabase().sql<{ id: string }>`
      INSERT INTO rooms (id, data, revision, created_at)
      VALUES (${id}, ${data}, 0, ${Date.now()})
      ON CONFLICT (id) DO NOTHING RETURNING id
    `;
    if (inserted.length === 1) return id;
  }
  throw new Error("无法生成房间码，请稍后重试");
}

export async function saveRoom(id: string, expectedRevision: number, data: string): Promise<boolean> {
  // The WHERE clause is the original optimistic concurrency guard.
  // RETURNING distinguishes a committed update from a competing action.
  const updated = await getDatabase().sql<{ revision: number }>`
    UPDATE rooms
    SET data = ${data}, revision = revision + 1
    WHERE id = ${id} AND revision = ${expectedRevision}
    RETURNING revision
  `;
  return updated.length === 1;
}
