import { ensureWaitlistSchema, getRuntimeEnv, toPublicEntry, type WaitlistRow } from "../../../db/waitlist";

export const dynamic = "force-dynamic";

function cleanPhone(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

async function listRows(db: D1Database) {
  const result = await db
    .prepare("SELECT * FROM waitlist ORDER BY datetime(created_at) DESC, id DESC LIMIT 200")
    .all<WaitlistRow>();
  return result.results.map(toPublicEntry);
}

export async function GET() {
  try {
    const { DB } = getRuntimeEnv();
    await ensureWaitlistSchema(DB);
    return Response.json({ entries: await listRows(DB) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "웨이팅 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      phone?: string;
      partySize?: number;
      drink?: string;
      note?: string;
      consent?: boolean;
    };
    const phone = cleanPhone(payload.phone);
    const partySize = Math.min(20, Math.max(1, Number(payload.partySize) || 1));
    const drink = String(payload.drink ?? "").trim().slice(0, 200);
    const note = String(payload.note ?? "").trim().slice(0, 200);

    if (phone.length !== 11) return Response.json({ error: "휴대폰 번호 11자리를 확인해 주세요." }, { status: 400 });
    if (!payload.consent) return Response.json({ error: "알림 수신 및 개인정보 이용 동의가 필요합니다." }, { status: 400 });
    if (!drink) return Response.json({ error: "음료 주문을 선택해 주세요." }, { status: 400 });

    const { DB } = getRuntimeEnv();
    await ensureWaitlistSchema(DB);
    const todayCount = await DB.prepare("SELECT COUNT(*) AS count FROM waitlist WHERE date(created_at) = date('now')")
      .first<{ count: number }>();
    const ticketNo = `T${String((todayCount?.count ?? 0) + 1).padStart(3, "0")}`;
    const result = await DB.prepare(
      "INSERT INTO waitlist (ticket_no, phone, party_size, drink, note, consent) VALUES (?, ?, ?, ?, ?, 1) RETURNING *",
    )
      .bind(ticketNo, phone, partySize, drink, note)
      .first<WaitlistRow>();

    if (!result) throw new Error("등록 결과를 확인하지 못했습니다.");
    return Response.json({ entry: toPublicEntry(result) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "웨이팅을 등록하지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as { id?: number; action?: "notify" | "admit" | "cancel" };
    const id = Number(payload.id);
    if (!Number.isInteger(id) || !payload.action) return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });

    const runtime = getRuntimeEnv();
    await ensureWaitlistSchema(runtime.DB);
    const row = await runtime.DB.prepare("SELECT * FROM waitlist WHERE id = ?").bind(id).first<WaitlistRow>();
    if (!row) return Response.json({ error: "웨이팅 정보를 찾지 못했습니다." }, { status: 404 });

    let notificationMode = "not-configured";
    if (payload.action === "notify") {
      if (runtime.KAKAO_ALIMTALK_WEBHOOK_URL) {
        const response = await fetch(runtime.KAKAO_ALIMTALK_WEBHOOK_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(runtime.KAKAO_ALIMTALK_WEBHOOK_SECRET ? { authorization: `Bearer ${runtime.KAKAO_ALIMTALK_WEBHOOK_SECRET}` } : {}),
          },
          body: JSON.stringify({
            phone: row.phone,
            template: "TERRARIUM_READY",
            variables: { ticketNo: row.ticket_no, gallery: "더샵갤러리", arrivalMinutes: "10" },
          }),
        });
        if (!response.ok) return Response.json({ error: "카카오 알림 발송사에서 전송을 거절했습니다." }, { status: 502 });
        notificationMode = "connected";
      }
      await runtime.DB.batch([
        runtime.DB.prepare("UPDATE waitlist SET status = 'notified', notified_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id),
        runtime.DB.prepare("INSERT INTO notification_log (waitlist_id, channel, status) VALUES (?, 'kakao_alimtalk', ?)").bind(id, notificationMode),
      ]);
    } else if (payload.action === "admit") {
      await runtime.DB.prepare("UPDATE waitlist SET status = 'admitted', admitted_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
    } else {
      await runtime.DB.prepare("UPDATE waitlist SET status = 'cancelled' WHERE id = ?").bind(id).run();
    }

    return Response.json({ ok: true, notificationMode });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "상태를 변경하지 못했습니다." }, { status: 500 });
  }
}
