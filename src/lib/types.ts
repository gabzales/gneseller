export type Product = {
  id: string;
  name: string;
  category: string;
  durations: { id: string; label: string; days: number; price: number }[];
};

export type AdminDuration = {
  id: string;
  label: string;
  days: number;
  price: number;
  stockMode: "manual" | "auto";
  providerItemId: string | null;
  manualStock: number; // count of unused key_stock rows
};

export type AdminProduct = {
  id: string;
  name: string;
  category: string;
  active: boolean;
  sortOrder: number;
  durations: AdminDuration[];
};

export type GeneratedKey = {
  id: string;
  productName: string;
  duration: string;
  keyString: string;
  createdAt: string; // ISO date
};

export type TopupTx = {
  id: string;
  nominal: number;
  bonus: number;
  total: number;
  method: "QRIS";
  status: "success" | "pending" | "failed";
  createdAt: string; // ISO date
};

export type ResellerUser = {
  id: string;
  name: string;
  email: string;
  avatarSeed: string;
  balance: number;
  role: "user" | "admin";
  verified: boolean;
  theme: string;
};
