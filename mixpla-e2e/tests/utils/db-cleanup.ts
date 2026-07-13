import { Pool } from 'pg';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

let pool: Pool | undefined;

function getPool(): Pool {
  if (!pool) {
    const { DATABASE_USER, DATABASE_RECATIVE_URL, DATABASE_PASSWIRD } = process.env;
    if (!DATABASE_USER || !DATABASE_RECATIVE_URL || !DATABASE_PASSWIRD) {
      throw new Error(
        'DATABASE_USER, DATABASE_RECATIVE_URL and DATABASE_PASSWIRD must be set (expected in repo root .env)',
      );
    }
    const url = new URL(DATABASE_RECATIVE_URL);
    pool = new Pool({
      host: url.hostname,
      port: url.port ? Number(url.port) : 5432,
      database: url.pathname.replace(/^\//, ''),
      user: DATABASE_USER,
      password: DATABASE_PASSWIRD,
    });
  }
  return pool;
}

export async function findSoundFragmentIdByTitle(title: string): Promise<string | undefined> {
  const { rows } = await getPool().query<{ id: string }>(
    'SELECT id FROM mixpla__sound_fragments WHERE title = $1 ORDER BY reg_date DESC LIMIT 1',
    [title],
  );
  return rows[0]?.id;
}

// The upload response returns before the backend finishes writing the
// sound_fragments row, so callers that need the id right after submitting
// should poll briefly instead of querying once.
export async function waitForSoundFragmentIdByTitle(
  title: string,
  { timeoutMs = 5000, intervalMs = 250 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<string | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const id = await findSoundFragmentIdByTitle(title);
    if (id) return id;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return undefined;
}

// mixpla__upload_agreements.contribution_id has no ON DELETE CASCADE, so it
// must be cleared first or the sound_fragments delete will fail with a FK
// violation. Genre/label/reader links do cascade automatically.
export async function deleteSoundFragmentById(id: string): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query('DELETE FROM mixpla__upload_agreements WHERE contribution_id = $1', [id]);
    await client.query('DELETE FROM mixpla__sound_fragments WHERE id = $1', [id]);
  } finally {
    client.release();
  }
}

export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
