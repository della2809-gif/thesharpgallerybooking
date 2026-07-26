import {
  ensureCatalogSchema,
  getCatalogDb,
  type CatalogCategory,
  type CatalogProduct,
} from "../../../db/catalog";

export const dynamic = "force-dynamic";

async function getCatalog() {
  const db = getCatalogDb();
  await ensureCatalogSchema(db);
  const [categories, products] = await Promise.all([
    db.prepare("SELECT id, name, sort_order FROM menu_categories ORDER BY sort_order, id").all<CatalogCategory>(),
    db.prepare("SELECT id, category_id, name, description, temperature_options FROM menu_products ORDER BY id").all<CatalogProduct>(),
  ]);
  return {
    categories: categories.results.map((category) => ({
      id: category.id,
      name: category.name,
      sortOrder: category.sort_order,
    })),
    products: products.results.map((product) => ({
      id: product.id,
      categoryId: product.category_id,
      name: product.name,
      description: product.description,
      temperatureOptions: product.temperature_options.split(","),
    })),
  };
}

export async function GET() {
  try {
    return Response.json(await getCatalog());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "메뉴를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      action?: "add-category" | "place-order";
      name?: string;
      customerName?: string;
      items?: Array<{ productId: number; name: string; temperature: string; quantity: number }>;
    };
    const db = getCatalogDb();
    await ensureCatalogSchema(db);

    if (payload.action === "add-category") {
      const name = String(payload.name ?? "").trim().slice(0, 30);
      if (!name) return Response.json({ error: "카테고리 이름을 입력해 주세요." }, { status: 400 });
      const max = await db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS value FROM menu_categories").first<{ value: number }>();
      await db.prepare("INSERT INTO menu_categories (name, sort_order) VALUES (?, ?)").bind(name, (max?.value ?? 0) + 1).run();
      return Response.json(await getCatalog(), { status: 201 });
    }

    if (payload.action === "place-order") {
      const items = (payload.items ?? [])
        .filter((item) => Number(item.quantity) > 0)
        .map((item) => ({
          productId: Number(item.productId),
          name: String(item.name).slice(0, 80),
          temperature: String(item.temperature).slice(0, 10),
          quantity: Math.min(20, Math.max(1, Number(item.quantity))),
        }));
      if (!items.length) return Response.json({ error: "음료를 한 잔 이상 선택해 주세요." }, { status: 400 });
      const todayCount = await db.prepare("SELECT COUNT(*) AS count FROM beverage_orders WHERE date(created_at) = date('now')").first<{ count: number }>();
      const orderNo = `D${String((todayCount?.count ?? 0) + 1).padStart(3, "0")}`;
      const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
      await db.prepare(
        "INSERT INTO beverage_orders (order_no, customer_name, items_json, total_items) VALUES (?, ?, ?, ?)",
      ).bind(orderNo, String(payload.customerName ?? "").trim().slice(0, 30), JSON.stringify(items), totalItems).run();
      return Response.json({ orderNo, totalItems }, { status: 201 });
    }

    return Response.json({ error: "지원하지 않는 요청입니다." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("UNIQUE")
      ? "이미 같은 이름의 카테고리가 있습니다."
      : error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}
