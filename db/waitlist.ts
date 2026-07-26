import { env } from "cloudflare:workers";

type RuntimeEnv = {
  DB: D1Database;
  KAKAO_ALIMTALK_WEBHOOK_URL?: string;
  KAKAO_ALIMTALK_WEBHOOK_SECRET?: string;
};

export type WaitlistRow = {
  id: number;
  ticket_no: string;
  phone: string;
  party_size: number;
  drink: string;
  note: string;
  status: string;
  created_at: string;
  notified_at: string | null;
  admitted_at: string | null;
};

export function getRuntimeEnv() {
  return env as unknown as RuntimeEnv;
}

export async function ensureWaitlistSchema(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS waitlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_no TEXT NOT NULL,
      phone TEXT NOT NULL,
      party_size INTEGER NOT NULL DEFAULT 1,
      drink TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      consent INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'waiting',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      notified_at TEXT,
      admitted_at TEXT
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS waitlist_created_at_idx ON waitlist(created_at DESC)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS notification_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      waitlist_id INTEGER NOT NULL,
      channel TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
  ]);
}

export function toPublicEntry(row: WaitlistRow) {
  const digits = row.phone.replace(/\D/g, "");
  return {
    id: row.id,
    ticketNo: row.ticket_no,
    phoneMasked: digits.length === 11 ? `${digits.slice(0, 3)}-••••-${digits.slice(-4)}` : "연락처 보호",
    partySize: row.party_size,
    drink: row.drink,
    note: row.note,
    status: row.status,
    createdAt: row.created_at.endsWith("Z") ? row.created_at : `${row.created_at.replace(" ", "T")}Z`,
    notifiedAt: row.notified_at ? (row.notified_at.endsWith("Z") ? row.notified_at : `${row.notified_at.replace(" ", "T")}Z`) : null,
    admittedAt: row.admitted_at ? (row.admitted_at.endsWith("Z") ? row.admitted_at : `${row.admitted_at.replace(" ", "T")}Z`) : null,
  };
}
