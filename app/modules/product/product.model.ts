export interface IProduct {
  id: string;
  user_id: string;
  category_id?: string;
  name: string;
  barcode?: string;
  expiry_date: Date | string;
  category?: string; // Keeping for backward compatibility
  image_url?: string;
  days_left?: number;
  status?: "good" | "warning" | "expired";
  color?: string;
  quantity: number;
  progress?: number;
  notes?: string;
  ingredients?: string;
  is_consumed: boolean;
  storage_location?: "fridge" | "freezer" | "pantry" | "medicine_box" | "other";
  storageLocation?: "fridge" | "freezer" | "pantry" | "medicine_box" | "other";
  created_at: Date | string;
  updated_at: Date | string;
}

export interface ICreateProduct {
  name: string;
  category_id?: string;
  barcode?: string;
  expiry_date: Date | string;
  category?: string;
  image_url?: string;
  imageUrl?: string;
  days_left?: number;
  status?: "good" | "warning" | "expired";
  color?: string;
  quantity?: number;
  qty?: number;
  progress?: number;
  notes?: string;
  ingredients?: string;
  storage_location?: "fridge" | "freezer" | "pantry" | "medicine_box" | "other";
  storageLocation?: "fridge" | "freezer" | "pantry" | "medicine_box" | "other";
}

export interface IUpdateProduct {
  name?: string;
  category_id?: string;
  barcode?: string;
  expiry_date?: Date | string;
  expiryDate?: Date | string;
  category?: string;
  image_url?: string;
  imageUrl?: string;
  days_left?: number;
  status?: "good" | "warning" | "expired";
  color?: string;
  quantity?: number;
  qty?: number;
  progress?: number;
  notes?: string;
  ingredients?: string;
  is_consumed?: boolean;
  storage_location?: "fridge" | "freezer" | "pantry" | "medicine_box" | "other";
  storageLocation?: "fridge" | "freezer" | "pantry" | "medicine_box" | "other";
}
