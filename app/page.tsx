"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Screen = "home" | "order" | "wait" | "board" | "complete";
type WaitStatus = "waiting" | "notified" | "admitted" | "cancelled";
type Temperature = "ICE" | "HOT" | "COLD";

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

type Category = { id: number; name: string; sortOrder: number };
type Product = {
  id: number;
  categoryId: number;
  name: string;
  description: string;
  temperatureOptions: Temperature[];
};
type CartItem = Product & { temperature: Temperature; quantity: number };
type BoardView = "orders" | "waitlist";
type OrderStatus = "received" | "ready" | "cancelled";
type BeverageOrder = {
  id: number;
  orderNo: string;
  customerName: string;
  phoneMasked: string;
  items: Array<{ productId: number; name: string; temperature: string; quantity: number }>;
  totalItems: number;
  status: OrderStatus;
  notificationStatus: string;
  createdAt: string;
};

const statusLabel: Record<WaitStatus, string> = {
  waiting: "대기 중",
  notified: "호출 완료",
  admitted: "입장 완료",
  cancelled: "취소",
};

const fallbackCategories: Category[] = [
  { id: 1, name: "시그니처 커피", sortOrder: 1 },
  { id: 2, name: "시그니처 티", sortOrder: 2 },
  { id: 3, name: "기본 음료", sortOrder: 3 },
];

const fallbackProducts: Product[] = [
  { id: 1, categoryId: 1, name: "블랜디드 플로럴 커피", description: "고품격 아로마와 특별히 각인되는 산미가 있는 커피", temperatureOptions: ["ICE", "HOT"] },
  { id: 2, categoryId: 1, name: "블랜디드 블랙 커피", description: "잔잔한 물결처럼 확산하는 아로마와 중후한 풍미의 편안한 커피", temperatureOptions: ["ICE", "HOT"] },
  { id: 3, categoryId: 1, name: "블랜디드 디카페인 커피", description: "구운 밤의 고소함과 은은한 단향이 조화로운 디카페인 커피", temperatureOptions: ["ICE", "HOT"] },
  { id: 4, categoryId: 2, name: "블랜디드 블랙 티", description: "보성 찻잎과 산화발효 홍차 블렌딩의 은은하고 그윽한 차", temperatureOptions: ["ICE", "HOT"] },
  { id: 5, categoryId: 2, name: "블랜디드 골드 티", description: "꿀·허니부쉬·캐모마일의 편안하고 달콤한 휴식 같은 차", temperatureOptions: ["ICE", "HOT"] },
  { id: 6, categoryId: 3, name: "우유", description: "부드럽고 고소한 우유", temperatureOptions: ["COLD"] },
  { id: 7, categoryId: 3, name: "생수", description: "시원하게 준비된 생수", temperatureOptions: ["COLD"] },
];

const productImageByName: Record<string, string> = {
  "블랜디드 플로럴 커피": "/images/products/floral-coffee.webp",
  "블랜디드 블랙 커피": "/images/products/black-coffee.webp",
  "블랜디드 디카페인 커피": "/images/products/decaf-coffee.webp",
  "블랜디드 블랙 티": "/images/products/black-tea.webp",
  "블랜디드 골드 티": "/images/products/gold-tea.webp",
};

const demoEntries: WaitEntry[] = [
  { id: 101, ticketNo: "T014", phoneMasked: "010-••••-2841", partySize: 2, drink: "블랜디드 블랙 커피 ICE 2잔", note: "유모차 동반", status: "waiting", createdAt: new Date(Date.now() - 18 * 60000).toISOString(), notifiedAt: null, admittedAt: null },
  { id: 102, ticketNo: "T015", phoneMasked: "010-••••-7730", partySize: 4, drink: "블랜디드 골드 티 HOT 2잔", note: "", status: "waiting", createdAt: new Date(Date.now() - 11 * 60000).toISOString(), notifiedAt: null, admittedAt: null },
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
  const [screen, setScreen] = useState<Screen>("home");
  const [notice, setNotice] = useState("");
  const [apiMode, setApiMode] = useState<"live" | "demo">("live");
  const [, setClock] = useState(0);

  const [categories, setCategories] = useState<Category[]>(fallbackCategories);
  const [products, setProducts] = useState<Product[]>(fallbackProducts);
  const [selectedCategory, setSelectedCategory] = useState<number | "all">("all");
  const [temperatureByProduct, setTemperatureByProduct] = useState<Record<number, Temperature>>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [orderPhone, setOrderPhone] = useState("");
  const [orderConsent, setOrderConsent] = useState(false);
  const [orderNotificationMode, setOrderNotificationMode] = useState<"connected" | "not-configured" | "failed" | "">("");
  const [categoryName, setCategoryName] = useState("");
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [orderNo, setOrderNo] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [boardView, setBoardView] = useState<BoardView>("orders");
  const [orders, setOrders] = useState<BeverageOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const [entries, setEntries] = useState<WaitEntry[]>([]);
  const [loadingWaitlist, setLoadingWaitlist] = useState(true);
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [waitDrink, setWaitDrink] = useState("음료 주문 완료");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [submittingWait, setSubmittingWait] = useState(false);

  const loadCatalog = useCallback(async () => {
    try {
      const response = await fetch("/api/catalog", { cache: "no-store" });
      if (!response.ok) throw new Error("catalog unavailable");
      const data = (await response.json()) as { categories: Category[]; products: Product[] };
      setCategories(data.categories);
      setProducts(data.products);
    } catch {
      setApiMode("demo");
    }
  }, []);

  const loadWaitlist = useCallback(async () => {
    try {
      const response = await fetch("/api/waitlist", { cache: "no-store" });
      if (!response.ok) throw new Error("waitlist unavailable");
      const data = (await response.json()) as { entries: WaitEntry[] };
      setEntries(data.entries);
    } catch {
      setEntries(demoEntries);
      setApiMode("demo");
    } finally {
      setLoadingWaitlist(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      if (!response.ok) throw new Error("orders unavailable");
      const data = (await response.json()) as { orders: BeverageOrder[] };
      setOrders(data.orders);
    } catch {
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
    loadWaitlist();
    loadOrders();
    const timer = window.setInterval(() => setClock((value) => value + 1), 30000);
    return () => window.clearInterval(timer);
  }, [loadCatalog, loadOrders, loadWaitlist]);

  const visibleProducts = selectedCategory === "all"
    ? products
    : products.filter((product) => product.categoryId === selectedCategory);
  const activeEntries = useMemo(
    () => entries.filter((entry) => entry.status === "waiting" || entry.status === "notified"),
    [entries],
  );
  const totalDrinks = cart.reduce((sum, item) => sum + item.quantity, 0);
  const activeOrders = orders.filter((order) => order.status === "received");
  const readyOrders = orders.filter((order) => order.status === "ready");
  const todayLabel = new Date().toLocaleDateString("ko-KR");
  const todayOrders = orders.filter((order) => new Date(order.createdAt).toLocaleDateString("ko-KR") === todayLabel);
  const waitingCount = entries.filter((entry) => entry.status === "waiting").length;
  const notifiedCount = entries.filter((entry) => entry.status === "notified").length;
  const averageWait = activeEntries.length
    ? Math.round(activeEntries.reduce((sum, entry) => sum + minutesSince(entry.createdAt), 0) / activeEntries.length)
    : 0;

  function goTo(nextScreen: Screen) {
    setNotice("");
    setScreen(nextScreen);
    if (nextScreen === "board") {
      void loadOrders();
      void loadWaitlist();
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addToCart(product: Product) {
    const temperature = temperatureByProduct[product.id] ?? product.temperatureOptions[0];
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id && item.temperature === temperature);
      if (existing) {
        return current.map((item) =>
          item.id === product.id && item.temperature === temperature
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...current, { ...product, temperature, quantity: 1 }];
    });
    setNotice(`${product.name} ${temperature === "COLD" ? "" : temperature}을 담았습니다.`);
  }

  function changeQuantity(id: number, temperature: Temperature, delta: number) {
    setCart((current) =>
      current
        .map((item) => item.id === id && item.temperature === temperature
          ? { ...item, quantity: item.quantity + delta }
          : item)
        .filter((item) => item.quantity > 0),
    );
  }

  async function placeOrder() {
    const orderPhoneDigits = orderPhone.replace(/\D/g, "");
    if (!cart.length) {
      setNotice("음료를 한 잔 이상 선택해 주세요.");
      return;
    }
    if (orderPhoneDigits.length !== 11) {
      setNotice("카카오 알림을 받을 휴대폰 번호 11자리를 확인해 주세요.");
      return;
    }
    if (!orderConsent) {
      setNotice("카카오 알림 수신 및 개인정보 이용에 동의해 주세요.");
      return;
    }
    setSubmittingOrder(true);
    try {
      if (apiMode === "demo") throw new Error("demo");
      const response = await fetch("/api/catalog", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "place-order",
          customerName,
          phone: orderPhoneDigits,
          consent: orderConsent,
          items: cart.map((item) => ({
            productId: item.id,
            name: item.name,
            temperature: item.temperature,
            quantity: item.quantity,
          })),
        }),
      });
      const data = (await response.json()) as {
        orderNo?: string;
        error?: string;
        notificationMode?: "connected" | "not-configured" | "failed";
      };
      if (!response.ok || !data.orderNo) throw new Error(data.error || "주문을 접수하지 못했습니다.");
      setOrderNo(data.orderNo);
      setOrderNotificationMode(data.notificationMode ?? "not-configured");
    } catch (error) {
      if (apiMode !== "demo" && error instanceof Error && error.message !== "demo") {
        setNotice(error.message);
        setSubmittingOrder(false);
        return;
      }
      setOrderNo(`D${String(Date.now()).slice(-3)}`);
      setOrderNotificationMode("not-configured");
    }
    setCart([]);
    setCustomerName("");
    setOrderPhone("");
    setOrderConsent(false);
    setSubmittingOrder(false);
    goTo("complete");
  }

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) return;
    try {
      if (apiMode === "demo") throw new Error("demo");
      const response = await fetch("/api/catalog", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "add-category", name }),
      });
      const data = (await response.json()) as { categories?: Category[]; products?: Product[]; error?: string };
      if (!response.ok || !data.categories) throw new Error(data.error || "카테고리를 추가하지 못했습니다.");
      setCategories(data.categories);
      setProducts(data.products ?? products);
      const created = data.categories.find((category) => category.name === name);
      if (created) setSelectedCategory(created.id);
    } catch (error) {
      if (apiMode !== "demo" && error instanceof Error && error.message !== "demo") {
        setNotice(error.message);
        return;
      }
      const created = { id: Date.now(), name, sortOrder: categories.length + 1 };
      setCategories((current) => [...current, created]);
      setSelectedCategory(created.id);
    }
    setCategoryName("");
    setShowCategoryForm(false);
    setNotice(`‘${name}’ 카테고리가 추가되었습니다.`);
  }

  async function submitWait(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 11 || !consent) {
      setNotice(digits.length !== 11 ? "휴대폰 번호 11자리를 확인해 주세요." : "알림 수신 및 개인정보 이용 동의가 필요합니다.");
      return;
    }
    setSubmittingWait(true);
    const payload = { phone: digits, partySize, drink: waitDrink, note, consent };
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
      setOrderNo(data.entry.ticketNo);
    } catch (error) {
      if (apiMode !== "demo" && error instanceof Error && error.message !== "demo") {
        setNotice(error.message);
        setSubmittingWait(false);
        return;
      }
      const next = entries.length ? Math.max(...entries.map((entry) => Number(entry.ticketNo.slice(1)) || 0)) + 1 : 1;
      const entry: WaitEntry = {
        id: Date.now(), ticketNo: `T${String(next).padStart(3, "0")}`, phoneMasked: maskPhone(digits),
        partySize, drink: waitDrink, note, status: "waiting", createdAt: new Date().toISOString(), notifiedAt: null, admittedAt: null,
      };
      setEntries((current) => [entry, ...current]);
      setOrderNo(entry.ticketNo);
    }
    setPhone("");
    setNote("");
    setConsent(false);
    setSubmittingWait(false);
    goTo("complete");
  }

  async function updateEntry(id: number, action: "notify" | "admit" | "cancel") {
    const timestamp = new Date().toISOString();
    setEntries((current) => current.map((entry) => entry.id === id ? {
      ...entry,
      status: action === "notify" ? "notified" : action === "admit" ? "admitted" : "cancelled",
      notifiedAt: action === "notify" ? timestamp : entry.notifiedAt,
      admittedAt: action === "admit" ? timestamp : entry.admittedAt,
    } : entry));
    if (apiMode === "demo") return;
    const response = await fetch("/api/waitlist", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    const data = (await response.json()) as { error?: string; notificationMode?: string };
    if (!response.ok) {
      setNotice(data.error || "처리하지 못했습니다.");
      await loadWaitlist();
      return;
    }
    setNotice(action === "notify"
      ? data.notificationMode === "connected" ? "카카오 알림톡을 발송했습니다." : "카카오 호출이 기록되었습니다."
      : "상태가 변경되었습니다.");
  }

  async function updateOrder(id: number, action: "ready" | "cancel") {
    const nextStatus: OrderStatus = action === "ready" ? "ready" : "cancelled";
    setOrders((current) => current.map((order) => order.id === id ? { ...order, status: nextStatus } : order));
    try {
      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "주문 상태를 변경하지 못했습니다.");
      setNotice(action === "ready" ? "음료 준비 완료로 변경했습니다." : "주문을 취소했습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "주문 상태를 변경하지 못했습니다.");
      await loadOrders();
    }
  }

  return (
    <main className={`kioskApp screen-${screen}`}>
      <header className="kioskHeader">
        <button className="brandButton" onClick={() => goTo("home")} aria-label="처음 화면으로">
          <span className="brandSymbol">+</span>
          <span><strong>THE SHARP GALLERY</strong><small>SIGNATURE EXPERIENCE</small></span>
        </button>
        <div className="headerActions">
          {screen !== "home" && <button className="homeButton" onClick={() => goTo("home")}>처음으로</button>}
          <button className="staffButton" onClick={() => goTo("board")}>직원 운영 보드</button>
        </div>
      </header>

      {notice && (
        <div className="kioskToast" role="status">
          <span>✓</span>{notice}<button onClick={() => setNotice("")} aria-label="알림 닫기">×</button>
        </div>
      )}

      {screen === "home" && (
        <section className="choiceScreen">
          <div className="choiceIntro">
            <p>WELCOME TO THE SHARP GALLERY</p>
            <h1>무엇을 도와드릴까요?</h1>
            <span>원하시는 서비스를 선택해 주세요.</span>
          </div>
          <div className="mainChoices">
            <button className="choiceCard drinkChoice" onClick={() => goTo("order")}>
              <span className="choiceNumber">01</span>
              <span className="choiceCopy">
                <small>SIGNATURE DRINK</small>
                <strong>시그니처<br />음료 주문</strong>
                <em>커피 · 티 · 우유 · 생수</em>
              </span>
              <b>주문하기 <i>→</i></b>
            </button>
            <button className="choiceCard waitChoice" onClick={() => goTo("wait")}>
              <span className="choiceNumber">02</span>
              <span className="choiceCopy">
                <small>TERRARIUM WAITING</small>
                <strong>테라리움<br />웨이팅 등록</strong>
                <em>순서가 되면 카카오톡으로 알려드려요</em>
              </span>
              <b>등록하기 <i>→</i></b>
            </button>
          </div>
          <p className="touchGuide"><span>●</span> 화면을 터치해 시작하세요</p>
        </section>
      )}

      {screen === "order" && (
        <section className="orderScreen">
          <div className="screenTitle">
            <div><p>SIGNATURE DRINK</p><h1>음료를 선택해 주세요</h1></div>
            <span>메뉴와 온도를 선택한 뒤 담아주세요.</span>
          </div>
          <div className="orderLayout">
            <div className="menuArea">
              <div className="categoryRow">
                <div className="categoryTabs" role="tablist" aria-label="음료 카테고리">
                  <button role="tab" aria-selected={selectedCategory === "all"}
                    className={selectedCategory === "all" ? "active" : ""}
                    onClick={() => setSelectedCategory("all")}>
                    전체 메뉴 <span>{products.length}</span>
                  </button>
                  {categories.map((category) => (
                    <button key={category.id} role="tab" aria-selected={selectedCategory === category.id}
                      className={selectedCategory === category.id ? "active" : ""}
                      onClick={() => setSelectedCategory(category.id)}>
                      {category.name}
                    </button>
                  ))}
                </div>
                <button className="addCategoryButton" onClick={() => setShowCategoryForm((value) => !value)}>＋ 카테고리 추가</button>
              </div>

              {showCategoryForm && (
                <form className="categoryForm" onSubmit={addCategory}>
                  <label htmlFor="categoryName">새 제품 카테고리</label>
                  <input id="categoryName" value={categoryName} onChange={(event) => setCategoryName(event.target.value)}
                    placeholder="예: 어린이 음료" autoFocus />
                  <button type="submit">추가</button>
                  <button type="button" onClick={() => setShowCategoryForm(false)}>취소</button>
                </form>
              )}

              {visibleProducts.length ? (
                <div className="productGrid">
                  {visibleProducts.map((product, index) => {
                    const temperature = temperatureByProduct[product.id] ?? product.temperatureOptions[0];
                    return (
                      <article className="productCard" key={product.id}>
                        <div
                          className={`productVisual visual-${product.categoryId} ${productImageByName[product.name] ? "hasImage" : ""}`}
                          style={productImageByName[product.name] ? { backgroundImage: `url("${productImageByName[product.name]}")` } : undefined}
                        >
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <b>{product.categoryId === 1 ? "COFFEE" : product.categoryId === 2 ? "TEA" : "BASIC"}</b>
                        </div>
                        <div className="productInfo">
                          <span className="productCategoryLabel">
                            {categories.find((category) => category.id === product.categoryId)?.name}
                          </span>
                          <h2>{product.name}</h2>
                          <p>{product.description}</p>
                          <div className="productBottom">
                            <div className="temperatureGroup" aria-label={`${product.name} 온도`}>
                              {product.temperatureOptions.map((option) => (
                                <button key={option} className={temperature === option ? "active" : ""}
                                  onClick={() => setTemperatureByProduct((current) => ({ ...current, [product.id]: option }))}>
                                  {option === "COLD" ? "차갑게" : option}
                                </button>
                              ))}
                            </div>
                            <button className="addDrinkButton" onClick={() => addToCart(product)}>담기 ＋</button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="emptyCategory">
                  <span>＋</span><h2>{categories.find((category) => category.id === selectedCategory)?.name}</h2>
                  <p>새 카테고리가 추가되었습니다.<br />제품 등록 기능은 직원 운영 설정에서 연결할 수 있어요.</p>
                </div>
              )}
            </div>

            <aside className="cartPanel">
              <div className="cartHead"><div><small>MY ORDER</small><h2>선택한 음료</h2></div><span>{totalDrinks}잔</span></div>
              <div className="cartItems">
                {cart.length === 0 ? (
                  <div className="emptyCart"><span>○</span><p>아직 선택한 음료가 없습니다.</p></div>
                ) : cart.map((item) => (
                  <div className="cartItem" key={`${item.id}-${item.temperature}`}>
                    <div><strong>{item.name}</strong><small>{item.temperature === "COLD" ? "차갑게" : item.temperature}</small></div>
                    <div className="quantity">
                      <button onClick={() => changeQuantity(item.id, item.temperature, -1)}>−</button>
                      <b>{item.quantity}</b>
                      <button onClick={() => changeQuantity(item.id, item.temperature, 1)}>＋</button>
                    </div>
                  </div>
                ))}
              </div>
              <label className="pickupName">
                <span>호출 이름 <small>(선택)</small></span>
                <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="예: 김더샵" />
              </label>
              <label className="pickupName orderPhone">
                <span>카카오 알림 받을 번호 <b>*</b></span>
                <input inputMode="numeric" autoComplete="tel" value={orderPhone}
                  onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, "").slice(0, 11);
                    setOrderPhone(digits.length > 7
                      ? `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
                      : digits.length > 3 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits);
                  }}
                  placeholder="010-0000-0000" />
              </label>
              <label className="orderConsent">
                <input type="checkbox" checked={orderConsent} onChange={(event) => setOrderConsent(event.target.checked)} />
                <i>✓</i>
                <span><strong>카카오 주문 알림 수신에 동의합니다.</strong><small>주문 확인 목적으로만 사용합니다.</small></span>
              </label>
              <button className="orderSubmit" disabled={!cart.length || orderPhone.replace(/\D/g, "").length !== 11 || !orderConsent || submittingOrder} onClick={placeOrder}>
                {submittingOrder ? "접수 중..." : `${totalDrinks}잔 주문하기`} <span>→</span>
              </button>
            </aside>
          </div>
        </section>
      )}

      {screen === "wait" && (
        <section className="waitScreen">
          <div className="waitIntro">
            <p>TERRARIUM WAITING</p>
            <h1>테라리움<br />웨이팅 등록</h1>
            <span>연락처를 남겨주시면 입장 순서에 맞춰<br />카카오톡으로 알려드릴게요.</span>
            <ol>
              <li><b>1</b><span><strong>연락처 등록</strong><small>휴대폰 번호는 안전하게 보호됩니다.</small></span></li>
              <li><b>2</b><span><strong>갤러리 관람</strong><small>기다리는 동안 편안하게 둘러보세요.</small></span></li>
              <li><b>3</b><span><strong>카카오톡 호출</strong><small>순서가 되면 바로 안내해 드립니다.</small></span></li>
            </ol>
          </div>
          <form className="waitForm" onSubmit={submitWait}>
            <div className="waitFormHead"><div className="brandSymbol">+</div><span><small>THE SHARP GALLERY</small><strong>WAITING CARD</strong></span><em>WEEKEND</em></div>
            <label>
              <span>휴대폰 번호 <b>*</b></span>
              <input inputMode="numeric" autoComplete="tel" placeholder="010-0000-0000" value={phone}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, "").slice(0, 11);
                  setPhone(digits.length > 7 ? `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}` : digits.length > 3 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits);
                }} />
            </label>
            <div className="waitTwoColumns">
              <label><span>입장 인원</span><select value={partySize} onChange={(event) => setPartySize(Number(event.target.value))}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((size) => <option key={size} value={size}>{size}명</option>)}
              </select></label>
              <label><span>음료 주문</span><select value={waitDrink} onChange={(event) => setWaitDrink(event.target.value)}>
                <option>음료 주문 완료</option><option>음료 주문 없음</option><option>추후 주문</option>
              </select></label>
            </div>
            <label><span>직원 메모 <small>(선택)</small></span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="예: 유모차 동반, 휠체어 이용" /></label>
            <label className="privacyConsent">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><i>✓</i>
              <span><strong>알림 수신 및 개인정보 이용에 동의합니다.</strong><small>휴대폰 번호는 웨이팅 안내 목적으로만 사용됩니다.</small></span>
            </label>
            <button className="waitSubmit" disabled={submittingWait}>{submittingWait ? "등록 중..." : "웨이팅 등록하기"} <span>→</span></button>
          </form>
        </section>
      )}

      {screen === "complete" && (
        <section className="completeScreen">
          <div className="completeMark">✓</div>
          <p>REGISTRATION COMPLETE</p>
          <h1>{orderNo}</h1>
          <h2>{orderNo.startsWith("D") ? "음료 주문이 접수되었습니다." : "웨이팅 등록이 완료되었습니다."}</h2>
          <span>{orderNo.startsWith("D")
            ? orderNotificationMode === "connected"
              ? "주문 접수 알림톡을 발송했습니다. 음료가 준비되면 이름 또는 주문번호로 불러드릴게요."
              : orderNotificationMode === "failed"
                ? "주문은 접수됐지만 카카오 알림 발송에 실패했습니다. 직원에게 문의해 주세요."
                : "주문은 접수됐습니다. 카카오 알림톡 연동이 완료되면 주문 확인 메시지도 함께 발송됩니다."
            : "입장 순서가 되면 카카오톡으로 알려드릴게요."}</span>
          <button onClick={() => goTo("home")}>처음 화면으로 <i>→</i></button>
        </section>
      )}

      {screen === "board" && (
        <section className="boardScreen">
          <div className="screenTitle boardTitle">
            <div><p>WEEKEND OPERATIONS</p><h1>현장 운영 보드</h1></div>
            <div className="boardQuickActions">
              <button onClick={() => goTo("order")}>＋ 새 음료 주문</button>
              <button onClick={() => goTo("wait")}>＋ 새 웨이팅 등록</button>
            </div>
          </div>
          <div className="boardTabs" role="tablist" aria-label="운영 목록 선택">
            <button role="tab" aria-selected={boardView === "orders"} className={boardView === "orders" ? "active" : ""}
              onClick={() => setBoardView("orders")}>
              음료 주문 <span>{activeOrders.length}</span>
            </button>
            <button role="tab" aria-selected={boardView === "waitlist"} className={boardView === "waitlist" ? "active" : ""}
              onClick={() => setBoardView("waitlist")}>
              테라리움 웨이팅 <span>{activeEntries.length}</span>
            </button>
          </div>
          <div className="boardStats">
            {boardView === "orders" ? (
              <>
                <article><small>준비 중</small><strong>{activeOrders.length}<em>건</em></strong></article>
                <article><small>준비 완료</small><strong>{readyOrders.length}<em>건</em></strong></article>
                <article><small>오늘 주문</small><strong>{todayOrders.length}<em>건</em></strong></article>
              </>
            ) : (
              <>
                <article><small>현재 대기</small><strong>{waitingCount}<em>팀</em></strong></article>
                <article><small>호출 완료</small><strong>{notifiedCount}<em>팀</em></strong></article>
                <article><small>평균 대기</small><strong>{averageWait}<em>분</em></strong></article>
              </>
            )}
          </div>
          {boardView === "orders" ? (
            <div className="waitTable orderTable">
              <div className="tableHead"><h2>음료 주문 내역</h2><span>최근 주문부터 표시됩니다.</span></div>
              {loadingOrders ? <div className="tableEmpty">음료 주문을 불러오는 중입니다.</div>
                : orders.length === 0 ? <div className="tableEmpty">아직 접수된 음료 주문이 없습니다.</div>
                : orders.map((order) => (
                  <article className="orderRow" key={order.id}>
                    <div className="orderIdentity"><strong>{order.orderNo}</strong><small>{formatTime(order.createdAt)} 접수</small></div>
                    <div className="orderCustomer"><strong>{order.customerName || "이름 없음"}</strong><small>{order.phoneMasked}</small></div>
                    <div className="orderMenu">
                      {order.items.map((item, index) => (
                        <span key={`${item.productId}-${item.temperature}-${index}`}>
                          <strong>{item.name}</strong> <small>{item.temperature === "COLD" ? "차갑게" : item.temperature} · {item.quantity}잔</small>
                        </span>
                      ))}
                    </div>
                    <div className="orderTotal"><small>수량</small><strong>{order.totalItems}잔</strong></div>
                    <span className={`orderStatus ${order.status}`}>
                      {order.status === "received" ? "준비 중" : order.status === "ready" ? "준비 완료" : "취소"}
                    </span>
                    <div className="boardActions">
                      {order.status === "received" && <button className="enterButton" onClick={() => updateOrder(order.id, "ready")}>준비 완료</button>}
                      {order.status === "received" && <button className="cancelButton" onClick={() => updateOrder(order.id, "cancel")}>취소</button>}
                    </div>
                  </article>
                ))}
            </div>
          ) : (
            <div className="waitTable">
              <div className="tableHead"><h2>테라리움 웨이팅</h2><span>대기 순서대로 자동 정렬됩니다.</span></div>
              {loadingWaitlist ? <div className="tableEmpty">웨이팅 현황을 불러오는 중입니다.</div>
                : activeEntries.length === 0 ? <div className="tableEmpty">현재 진행 중인 웨이팅이 없습니다.</div>
                : activeEntries.map((entry) => (
                  <article className="waitRow" key={entry.id}>
                    <div><strong>{entry.ticketNo}</strong><small>{formatTime(entry.createdAt)} 등록</small></div>
                    <div><strong>{entry.phoneMasked}</strong><small>{entry.note || "메모 없음"}</small></div>
                    <div><small>인원</small><strong>{entry.partySize}명</strong></div>
                    <div><small>대기</small><strong>{minutesSince(entry.createdAt)}분</strong></div>
                    <span className={`boardStatus ${entry.status}`}>{statusLabel[entry.status]}</span>
                    <div className="boardActions">
                      {entry.status === "waiting" && <button className="callButton" onClick={() => updateEntry(entry.id, "notify")}>카카오 호출</button>}
                      {entry.status === "notified" && <button className="enterButton" onClick={() => updateEntry(entry.id, "admit")}>입장 완료</button>}
                      <button className="cancelButton" onClick={() => updateEntry(entry.id, "cancel")}>취소</button>
                    </div>
                  </article>
                ))}
            </div>
          )}
        </section>
      )}

      <footer className="kioskFooter"><span>THE SHARP GALLERY · SEOUL</span><span>고객의 일상을 더 특별하게</span></footer>
    </main>
  );
}
