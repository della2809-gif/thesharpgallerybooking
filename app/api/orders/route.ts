import { ensureCatalogSchema, getCatalogDb } from "../../../db/catalog";

export const dynamic = "force-dynamic";

type OrderItem = {
  productId: number;
  name: string;
  temperature: string;
  quantity: number;
};

type OrderRow = {
  id: number;
  order_no: string;
  customer_name: string;
  phone: string;
  items_json: string;
  total_items: number;
  status: string;
  notification_status: string;
  created_at: string;
};

function toPublicOrder(row: OrderRow) {
  const digits = row.phone.replace(/\D/g, "");
  let items: OrderItem[] = [];
  try {
    const parsed = JSON.parse(row.items_json);
    if (Array.isArray(parsed)) items = parsed as OrderItem[];
  } catch {
    items = [];
  }
  return {
    id: row.id,
    orderNo: row.order_no,
    customerName: row.customer_name,
    phoneMasked: digits.length === 11 ? `${digits.slice(0, 3)}-••••-${digits.slice(-4)}` : "연락처 없음",
    items,
    totalItems: row.total_items,
    status: row.status,
    notificationStatus: row.notification_status,
    createdAt: row.created_at.endsWith("Z") ? row.created_at : `${row.created_at.replace(" ", "T")}Z`,
  };
}

export async function GET() {
  try {
    const db = getCatalogDb();
    await ensureCatalogSchema(db);
    const result = await db.prepare(
      "SELECT id, order_no, customer_name, phone, items_json, total_items, status, notification_status, created_at FROM beverage_orders ORDER BY datetime(created_at) DESC, id DESC LIMIT 200",
    ).all<OrderRow>();
    return Response.json({ orders: result.results.map(toPublicOrder) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "음료 주문을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as { id?: number; action?: "ready" | "cancel" };
    const id = Number(payload.id);
    if (!Number.isInteger(id) || !payload.action) {
      return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    const db = getCatalogDb();
    await ensureCatalogSchema(db);
    const status = payload.action === "ready" ? "ready" : "cancelled";
    const result = await db.prepare("UPDATE beverage_orders SET status = ? WHERE id = ? RETURNING id")
      .bind(status, id)
      .first<{ id: number }>();
    if (!result) return Response.json({ error: "주문을 찾지 못했습니다." }, { status: 404 });
    return Response.json({ ok: true, status });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "주문 상태를 변경하지 못했습니다." }, { status: 500 });
  }
}
