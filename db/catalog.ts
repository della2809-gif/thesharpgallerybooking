import { env } from "cloudflare:workers";

type CatalogEnv = { DB: D1Database };

export type CatalogCategory = {
  id: number;
  name: string;
  sort_order: number;
};

export type CatalogProduct = {
  id: number;
  category_id: number;
  name: string;
  description: string;
  temperature_options: string;
};

export function getCatalogDb() {
  return (env as unknown as CatalogEnv).DB;
}

export async function ensureCatalogSchema(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS menu_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS menu_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      temperature_options TEXT NOT NULL DEFAULT 'ICE,HOT',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS beverage_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT NOT NULL,
      customer_name TEXT NOT NULL DEFAULT '',
      items_json TEXT NOT NULL,
      total_items INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'received',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS beverage_orders_created_at_idx ON beverage_orders(created_at DESC)"),
  ]);

  const count = await db.prepare("SELECT COUNT(*) AS count FROM menu_categories").first<{ count: number }>();
  if ((count?.count ?? 0) > 0) return;

  await db.batch([
    db.prepare("INSERT INTO menu_categories (name, sort_order) VALUES ('시그니처 커피', 1)"),
    db.prepare("INSERT INTO menu_categories (name, sort_order) VALUES ('시그니처 티', 2)"),
    db.prepare("INSERT INTO menu_categories (name, sort_order) VALUES ('기본 음료', 3)"),
  ]);

  const categories = await db.prepare("SELECT id, name FROM menu_categories").all<{ id: number; name: string }>();
  const idByName = Object.fromEntries(categories.results.map((row) => [row.name, row.id]));
  await db.batch([
    db.prepare("INSERT INTO menu_products (category_id, name, description, temperature_options) VALUES (?, '블랜디드 플로럴 커피', '고품격 아로마와 특별히 각인되는 산미가 있는 커피', 'ICE,HOT')").bind(idByName["시그니처 커피"]),
    db.prepare("INSERT INTO menu_products (category_id, name, description, temperature_options) VALUES (?, '블랜디드 블랙 커피', '잔잔한 물결처럼 확산하는 아로마와 중후한 풍미의 편안한 커피', 'ICE,HOT')").bind(idByName["시그니처 커피"]),
    db.prepare("INSERT INTO menu_products (category_id, name, description, temperature_options) VALUES (?, '블랜디드 디카페인 커피', '구운 밤의 고소함과 은은한 단향이 조화로운 디카페인 커피', 'ICE,HOT')").bind(idByName["시그니처 커피"]),
    db.prepare("INSERT INTO menu_products (category_id, name, description, temperature_options) VALUES (?, '블랜디드 블랙 티', '보성 찻잎과 산화발효 홍차 블렌딩의 은은하고 그윽한 차', 'ICE,HOT')").bind(idByName["시그니처 티"]),
    db.prepare("INSERT INTO menu_products (category_id, name, description, temperature_options) VALUES (?, '블랜디드 골드 티', '꿀·허니부쉬·캐모마일의 편안하고 달콤한 휴식 같은 차', 'ICE,HOT')").bind(idByName["시그니처 티"]),
    db.prepare("INSERT INTO menu_products (category_id, name, description, temperature_options) VALUES (?, '우유', '부드럽고 고소한 우유', 'COLD')").bind(idByName["기본 음료"]),
    db.prepare("INSERT INTO menu_products (category_id, name, description, temperature_options) VALUES (?, '생수', '시원하게 준비된 생수', 'COLD')").bind(idByName["기본 음료"]),
  ]);
}
