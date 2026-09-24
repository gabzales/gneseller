import { GeneratedKey, Product, ResellerUser, TopupTx } from "./types";

// NOTE: everything in this file stands in for a Supabase query.
// Each export documents the table + query it should be replaced with
// once `src/lib/supabase.ts` is wired to a real project (see PRD 3.1–3.6).

// Table: products (shared with ghostnewera.web.id) — SELECT * FROM products WHERE active = true
export const PRODUCTS: Product[] = [
  {
    id: "hg-apkmod-ff",
    name: "HG APKMOD FF",
    category: "Free Fire",
    durations: [
      { id: "1d", label: "1 Day", days: 1, price: 8000 },
      { id: "7d", label: "7 Days", days: 7, price: 45000 },
      { id: "10d", label: "10 Days", days: 10, price: 60000 },
      { id: "30d", label: "30 Days", days: 30, price: 150000 },
    ],
  },
  {
    id: "drip-client-root",
    name: "Drip Client Root",
    category: "Free Fire",
    durations: [
      { id: "1d", label: "1 Day", days: 1, price: 10000 },
      { id: "7d", label: "7 Days", days: 7, price: 55000 },
      { id: "30d", label: "30 Days", days: 30, price: 180000 },
    ],
  },
  {
    id: "fluorite-ios-mlbb",
    name: "Fluorite iOS MLBB",
    category: "Mobile Legends",
    durations: [
      { id: "1d", label: "1 Day", days: 1, price: 12000 },
      { id: "7d", label: "7 Days", days: 7, price: 65000 },
      { id: "30d", label: "30 Days", days: 30, price: 210000 },
    ],
  },
  {
    id: "aurora-vn-pc",
    name: "Aurora VN PC",
    category: "PC",
    durations: [
      { id: "1d", label: "1 Day", days: 1, price: 15000 },
      { id: "30d", label: "30 Days", days: 30, price: 250000 },
    ],
  },
];

// Table: reseller_keys — SELECT * FROM reseller_keys WHERE user_id = auth.uid() ORDER BY created_at DESC
export const KEY_HISTORY: GeneratedKey[] = [
  {
    id: "k1",
    productName: "HG APKMOD FF",
    duration: "7 Days",
    keyString: "HG7D-9X2K-QRZ1-88LM",
    createdAt: "2026-08-12T09:14:00+07:00",
  },
  {
    id: "k2",
    productName: "Fluorite iOS MLBB",
    duration: "1 Day",
    keyString: "FLR1-AA30-KZ91-PPXM",
    createdAt: "2026-08-10T18:41:00+07:00",
  },
  {
    id: "k3",
    productName: "Drip Client Root",
    duration: "30 Days",
    keyString: "DRP30-77CX-MM2Q-VVBB",
    createdAt: "2026-08-03T11:02:00+07:00",
  },
];

// Table: topups — SELECT * FROM topups WHERE user_id = auth.uid() ORDER BY created_at DESC
export const TOPUP_HISTORY: TopupTx[] = [
  {
    id: "t1",
    nominal: 500000,
    bonus: 50000,
    total: 550000,
    method: "QRIS",
    status: "success",
    createdAt: "2026-08-11T08:20:00+07:00",
  },
  {
    id: "t2",
    nominal: 1000000,
    bonus: 150000,
    total: 1150000,
    method: "QRIS",
    status: "success",
    createdAt: "2026-08-05T14:55:00+07:00",
  },
  {
    id: "t3",
    nominal: 200000,
    bonus: 0,
    total: 200000,
    method: "QRIS",
    status: "pending",
    createdAt: "2026-08-14T13:02:00+07:00",
  },
];

// Table: users — the signed-in reseller (SELECT * FROM users WHERE id = auth.uid())
export const CURRENT_USER: ResellerUser = {
  id: "35",
  name: "Ghost Reseller",
  email: "kefongcak@gmail.com",
  avatarSeed: "ghost-reseller-35",
  balance: 725000,
  role: "user",
  verified: true,
  theme: "ghost",
};

export const TOPUP_PACKAGES = [
  { nominal: 500000, bonus: 50000 },
  { nominal: 1000000, bonus: 150000 },
  { nominal: 1500000, bonus: 350000 },
  { nominal: 2000000, bonus: 500000 },
  { nominal: 3000000, bonus: 700000 },
  { nominal: 5000000, bonus: 1300000 },
  { nominal: 10000000, bonus: 2300000 },
  { nominal: 15000000, bonus: 4000000 },
  { nominal: 20000000, bonus: 7000000 },
];

// Days in the current month that have activity — for the calendar dot markers.
// Query: SELECT DISTINCT date_trunc('day', created_at) FROM (reseller_keys UNION topups) WHERE user_id = ...
export const ACTIVITY_DAYS = [3, 5, 10, 11, 12, 14];
