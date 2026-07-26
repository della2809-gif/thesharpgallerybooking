"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type WaitStatus = "waiting" | "notified" | "admitted" | "cancelled";

type WaitEntry = {
  id: number;
  ticketNo: string;
  phoneMasked: string;
  partySize: number;
  drink: string;
  note: string;
  status: WaitStatus;
  createdAt: string;
  notifiedAt: string | null;
  admittedAt: string | null;
};

const statusLabel: Record<WaitStatus, string> = {
  waiting: "대기 중",
  notified: "호출 완료",
  admitted: "입장 완료",
  cancelled: "취소",
};

const drinkOptions = [
  "아메리카노 (HOT)",
  "아메리카노 (ICE)",
  "카페라떼 (HOT)",
  "카페라떼 (ICE)",
  "오렌지 주스",
  "생수",
];

const demoEntries: WaitEntry[] = [
  { id: 101, ticketNo: "T014", phoneMasked: "010-••••-2841", partySize: 2, drink: "아메리카노 (ICE) 2", note: "유모차 동반", status: "waiting", createdAt: new Date(Date.now() - 18 * 60000).toISOString(), notifiedAt: null, admittedAt: null },
  { id: 102, ticketNo: "T015", phoneMasked: "010-••••-7730", partySize: 4, drink: "아메리카노 (HOT) 2, 오렌지 주스 2", note: "", status: "waiting", createdAt: new Date(Date.now() - 11 * 60000).toISOString(), notifiedAt: null, admittedAt: null },
  { id: 103, ticketNo: "T016", phoneMasked: "010-••••-0612", partySize: 2, drink: "카페라떼 (ICE) 1, 생수 1", note: "", status: "notified", createdAt: new Date(Date.now() - 7 * 60000).toISOString(), notifiedAt: new Date(Date.now() - 2 * 60000).toISOString(), admittedAt: null },
];

function minutesSince(value: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
}

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 11 ? `${digits.slice(0, 3)}-••••-${digits.slice(-4)}` : phone;
}

export default function Home() {
  const [entries, setEntries] = useState<WaitEntry[]>([]);
  const [activeView, setActiveView] = useState<"board" | "register">("board");
  const [filter, setFilter] = useState<"active" | "all">("active");
  const [loading, setLoading] = useState(true);
  const [apiMode, setApiMode] = useState<"live" | "demo">("live");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [drink, setDrink] = useState(drinkOptions[1]);
  const [drinkCount, setDrinkCount] = useState(2);
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);

  const loadEntries = useCallback(async () => {
    try {
      const response = await fetch("/api/waitlist", { cache: "no-store" });
      if (!response.ok) throw new Error("API unavailable");
      const data = (await response.json()) as { entries: WaitEntry[] };
      setEntries(data.entries);
      setApiMode("live");
    } catch {
      setEntries(demoEntries);
      setApiMode("demo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
    const clock = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(clock);
  }, [loadEntries]);

  const activeEntries = useMemo(
    () => entries.filter((entry) => entry.status === "waiting" || entry.status === "notified"),
    [entries],
  );
  const visibleEntries = filter === "active" ? activeEntries : entries;
  const waitingCount = entries.filter((entry) => entry.status === "waiting").length;
  const notifiedCount = entries.filter((entry) => entry.status === "notified").length;
  const averageWait = activeEntries.length
    ? Math.round(activeEntries.reduce((sum, entry) => sum + minutesSince(entry.createdAt), 0) / activeEntries.length)
    : 0;

  async function updateEntry(id: number, action: "notify" | "admit" | "cancel") {
    const original = entries;
    const timestamp = new Date().toISOString();
    setEntries((current) =>
      current.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              status: action === "notify" ? "notified" : action === "admit" ? "admitted" : "cancelled",
              notifiedAt: action === "notify" ? timestamp : entry.notifiedAt,
              admittedAt: action === "admit" ? timestamp : entry.admittedAt,
            }
          : entry,
      ),
    );

    if (apiMode === "demo") {
      setNotice(action === "notify" ? "테스트 알림을 발송했습니다." : "상태가 변경되었습니다.");
      return;
    }

    try {
      const response = await fetch("/api/waitlist", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const result = (await response.json()) as { notificationMode?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "처리하지 못했습니다.");
      setNotice(
        action === "notify"
          ? result.notificationMode === "connected"
            ? "카카오 알림톡을 발송했습니다."
            : "호출 처리되었습니다. 알림톡 연동 전이라 테스트로 기록했어요."
          : "상태가 변경되었습니다.",
      );
      await loadEntries();
    } catch (error) {
      setEntries(original);
      setNotice(error instanceof Error ? error.message : "다시 시도해 주세요.");
    }
  }

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 11 || !consent) {
      setNotice(digits.length !== 11 ? "휴대폰 번호 11자리를 확인해 주세요." : "알림 수신 및 개인정보 이용 동의가 필요합니다.");
      return;
    }

    setSubmitting(true);
    const payload = {
      phone: digits,
      partySize,
      drink: `${drink} ${drinkCount}잔`,
      note,
      consent,
    };

    try {
      if (apiMode === "demo") throw new Error("demo");
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { entry?: WaitEntry; error?: string };
      if (!response.ok || !data.entry) throw new Error(data.error || "등록하지 못했습니다.");
      setEntries((current) => [data.entry!, ...current]);
      setNotice(`${data.entry.ticketNo}번으로 웨이팅이 등록되었습니다.`);
    } catch (error) {
      if (apiMode !== "demo" && error instanceof Error && error.message !== "demo") {
        setNotice(error.message);
        setSubmitting(false);
        return;
      }
      const next = entries.length ? Math.max(...entries.map((entry) => Number(entry.ticketNo.slice(1)) || 0)) + 1 : 1;
      const demoEntry: WaitEntry = {
        id: Date.now(),
        ticketNo: `T${String(next).padStart(3, "0")}`,
        phoneMasked: maskPhone(digits),
        partySize,
        drink: payload.drink,
        note,
        status: "waiting",
        createdAt: new Date().toISOString(),
        notifiedAt: null,
        admittedAt: null,
      };
      setEntries((current) => [demoEntry, ...current]);
      setNotice(`${demoEntry.ticketNo}번으로 테스트 등록되었습니다.`);
    }

    setPhone("");
    setNote("");
    setConsent(false);
    setActiveView("board");
    setSubmitting(false);
  }

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brandMark"><span>+</span></div>
          <div>
            <strong>THE SHARP GALLERY</strong>
            <small>TERRARIUM WAITING</small>
          </div>
        </div>
        <nav className="nav" aria-label="주요 메뉴">
          <button className={activeView === "board" ? "active" : ""} onClick={() => setActiveView("board")}>운영 보드</button>
          <button className={activeView === "register" ? "active" : ""} onClick={() => setActiveView("register")}>현장 등록</button>
        </nav>
        <div className="connection">
          <i />
          {apiMode === "live" ? "운영 중" : "테스트 모드"}
        </div>
      </header>

      {notice && (
        <div className="toast" role="status">
          <span>✓</span>{notice}
          <button onClick={() => setNotice("")} aria-label="알림 닫기">×</button>
        </div>
      )}

      {activeView === "board" ? (
        <div className="page">
          <section className="hero">
            <div>
              <p className="eyebrow">WEEKEND OPERATIONS</p>
              <h1>테라리움 웨이팅</h1>
              <p>대기 등록부터 카카오 호출, 입장 완료까지 한 화면에서 관리하세요.</p>
            </div>
            <button className="primaryButton" onClick={() => setActiveView("register")}>
              <span>＋</span> 새 웨이팅 등록
            </button>
          </section>

          <section className="stats" aria-label="오늘의 운영 현황">
            <article>
              <span className="statIcon green">⌛</span>
              <div><small>현재 대기</small><strong>{waitingCount}<em>팀</em></strong></div>
              <b>지금</b>
            </article>
            <article>
              <span className="statIcon amber">↗</span>
              <div><small>호출 완료</small><strong>{notifiedCount}<em>팀</em></strong></div>
              <b className="neutral">오늘</b>
            </article>
            <article>
              <span className="statIcon sage">◷</span>
              <div><small>평균 대기</small><strong>{averageWait}<em>분</em></strong></div>
              <b className="neutral">예상</b>
            </article>
          </section>

          <section className="queueSection">
            <div className="sectionHead">
              <div>
                <h2>웨이팅 리스트</h2>
                <p>대기 순서대로 자동 정렬됩니다.</p>
              </div>
              <div className="segmented">
                <button className={filter === "active" ? "active" : ""} onClick={() => setFilter("active")}>진행 중 {activeEntries.length}</button>
                <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>전체 {entries.length}</button>
              </div>
            </div>

            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>대기번호</th><th>연락처</th><th>인원</th><th>음료 주문</th><th>대기시간</th><th>상태</th><th><span className="srOnly">관리</span></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="empty">웨이팅 현황을 불러오는 중입니다.</td></tr>
                  ) : visibleEntries.length === 0 ? (
                    <tr><td colSpan={7} className="empty">현재 등록된 웨이팅이 없습니다.</td></tr>
                  ) : visibleEntries.map((entry) => (
                    <tr key={entry.id} className={entry.status === "notified" ? "highlight" : ""}>
                      <td><strong className="ticket">{entry.ticketNo}</strong><small>{formatTime(entry.createdAt)} 등록</small></td>
                      <td><strong>{entry.phoneMasked}</strong>{entry.note && <small>{entry.note}</small>}</td>
                      <td><span className="people">♙</span> {entry.partySize}명</td>
                      <td><span className="drink">◉</span> {entry.drink}</td>
                      <td><strong>{minutesSince(entry.createdAt)}분</strong></td>
                      <td><span className={`status ${entry.status}`}>{statusLabel[entry.status]}</span></td>
                      <td className="actions">
                        {entry.status === "waiting" && <button className="notifyButton" onClick={() => updateEntry(entry.id, "notify")}>카카오 호출</button>}
                        {entry.status === "notified" && <button className="admitButton" onClick={() => updateEntry(entry.id, "admit")}>입장 완료</button>}
                        {(entry.status === "waiting" || entry.status === "notified") && <button className="moreButton" onClick={() => updateEntry(entry.id, "cancel")} aria-label={`${entry.ticketNo} 웨이팅 취소`}>×</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="messagePreview">
            <div className="kakaoIcon">💬</div>
            <div>
              <small>카카오 알림톡 미리보기</small>
              <p><strong>[더샵갤러리]</strong> 고객님의 테라리움 입장 순서가 되었습니다. 10분 이내에 입구로 와주세요.</p>
            </div>
            <span>승인 템플릿 연결 예정</span>
          </aside>
        </div>
      ) : (
        <div className="registrationPage">
          <section className="registrationIntro">
            <p className="eyebrow">ON-SITE REGISTRATION</p>
            <h1>테라리움<br />웨이팅 등록</h1>
            <p>연락처와 음료 주문을 남겨주시면<br />입장 순서에 맞춰 카카오톡으로 알려드릴게요.</p>
            <div className="steps">
              <div><b>1</b><span><strong>연락처 등록</strong><small>휴대폰 번호를 안전하게 보관합니다.</small></span></div>
              <div><b>2</b><span><strong>편안하게 갤러리 관람</strong><small>예상 대기 시간은 현장에서 안내합니다.</small></span></div>
              <div><b>3</b><span><strong>카카오톡 호출</strong><small>순서가 되면 바로 알려드립니다.</small></span></div>
            </div>
          </section>

          <form className="registrationCard" onSubmit={submitRegistration}>
            <div className="formHead">
              <div><span>+</span></div>
              <section><small>THE SHARP GALLERY</small><strong>WAITING CARD</strong></section>
              <em>WEEKEND</em>
            </div>

            <label>
              <span>휴대폰 번호 <b>*</b></span>
              <input
                inputMode="numeric"
                autoComplete="tel"
                placeholder="010-0000-0000"
                value={phone}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, "").slice(0, 11);
                  const formatted = digits.length > 7 ? `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}` : digits.length > 3 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits;
                  setPhone(formatted);
                }}
              />
            </label>

            <div className="twoColumns">
              <label>
                <span>입장 인원</span>
                <select value={partySize} onChange={(event) => setPartySize(Number(event.target.value))}>
                  {[1, 2, 3, 4, 5, 6].map((size) => <option key={size} value={size}>{size}명</option>)}
                </select>
              </label>
              <label>
                <span>음료 수량</span>
                <select value={drinkCount} onChange={(event) => setDrinkCount(Number(event.target.value))}>
                  {[1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}잔</option>)}
                </select>
              </label>
            </div>

            <label>
              <span>음료 주문</span>
              <select value={drink} onChange={(event) => setDrink(event.target.value)}>
                {drinkOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>

            <label>
              <span>직원 메모 <small>(선택)</small></span>
              <input placeholder="예: 유모차 동반, 휠체어 이용" value={note} onChange={(event) => setNote(event.target.value)} />
            </label>

            <label className="consent">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
              <i>✓</i>
              <span><strong>알림 수신 및 개인정보 이용에 동의합니다.</strong><small>휴대폰 번호는 웨이팅 안내 목적으로만 사용되며, 운영 종료 후 파기됩니다.</small></span>
            </label>

            <button className="submitButton" disabled={submitting}>{submitting ? "등록 중..." : "웨이팅 등록하기"} <span>→</span></button>
            <button type="button" className="backButton" onClick={() => setActiveView("board")}>운영 보드로 돌아가기</button>
          </form>
        </div>
      )}
      <footer><span>THE SHARP GALLERY · SEOUL</span><span>고객의 일상을 더 특별하게</span></footer>
      <span className="srOnly" aria-live="polite">현재 시각 {new Date(now).toLocaleTimeString("ko-KR")}</span>
    </main>
  );
}
