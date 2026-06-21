export interface IShoppingListItem {
  id: string;
  user_id: string;
  name: string;
  category?: string;
  quantity: number;
  is_checked: boolean;
  source_product_id?: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface ICreateShoppingListItem {
  name: string;
  category?: string;
  quantity?: number;
  qty?: number;
  is_checked?: boolean;
  isChecked?: boolean;
  source_product_id?: string;
  sourceProductId?: string;
}

export interface IUpdateShoppingListItem {
  name?: string;
  category?: string;
  quantity?: number;
  qty?: number;
  is_checked?: boolean;
  isChecked?: boolean;
}
