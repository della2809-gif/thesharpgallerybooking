import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const waitlist = sqliteTable("waitlist", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticketNo: text("ticket_no").notNull(),
  phone: text("phone").notNull(),
  partySize: integer("party_size").notNull().default(1),
  drink: text("drink").notNull(),
  note: text("note").notNull().default(""),
  consent: integer("consent", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("waiting"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  notifiedAt: text("notified_at"),
  admittedAt: text("admitted_at"),
});
