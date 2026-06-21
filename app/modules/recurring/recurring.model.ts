export interface IRecurringProduct {
  id: string;
  user_id: string;
  name: string;
  category: string;
  default_qty: number;
  default_shelf_life_days: number;
  image_url?: string;
  last_added_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ICreateRecurringProduct {
  name: string;
  category: string;
  default_qty?: number;
  default_shelf_life_days: number;
  image_url?: string;
}

export interface IUpdateRecurringProduct {
  name?: string;
  category?: string;
  default_qty?: number;
  default_shelf_life_days?: number;
  image_url?: string;
}
