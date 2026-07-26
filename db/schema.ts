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

export const menuCategories = sqliteTable("menu_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const menuProducts = sqliteTable("menu_products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  categoryId: integer("category_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  temperatureOptions: text("temperature_options").notNull().default("ICE,HOT"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const beverageOrders = sqliteTable("beverage_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderNo: text("order_no").notNull(),
  customerName: text("customer_name").notNull().default(""),
  itemsJson: text("items_json").notNull(),
  totalItems: integer("total_items").notNull().default(1),
  status: text("status").notNull().default("received"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
