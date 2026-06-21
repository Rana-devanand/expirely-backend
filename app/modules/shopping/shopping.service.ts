import { supabaseAdmin } from "../../common/service/supabase.admin";
import { ICreateShoppingListItem, IUpdateShoppingListItem } from "./shopping.model";

const mapRowToShoppingItem = (row: any): any => {
  if (!row) return row;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    category: row.category || null,
    qty: row.quantity,
    isChecked: row.is_checked,
    sourceProductId: row.source_product_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const getAllShoppingList = async (userId: string) => {
  const { data, error } = await supabaseAdmin
    .from("shopping_list")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    // If table doesn't exist yet, we catch the error gracefully and return an empty array
    if (error.code === "PGRST116" || error.message.includes("does not exist")) {
      console.warn("shopping_list table does not exist in Supabase yet. Returning empty list.");
      return [];
    }
    throw new Error(error.message);
  }

  return (data || []).map(mapRowToShoppingItem);
};

export const createShoppingListItem = async (userId: string, data: ICreateShoppingListItem) => {
  const newItem = {
    user_id: userId,
    name: data.name,
    category: data.category || null,
    quantity: data.quantity || data.qty || 1,
    is_checked: data.is_checked ?? data.isChecked ?? false,
    source_product_id: data.source_product_id || data.sourceProductId || null,
  };

  const { data: createdItem, error } = await supabaseAdmin
    .from("shopping_list")
    .insert(newItem)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRowToShoppingItem(createdItem);
};

export const updateShoppingListItem = async (
  userId: string,
  itemId: string,
  data: IUpdateShoppingListItem
) => {
  const dbData: any = {};

  if (data.name !== undefined) dbData.name = data.name;
  if (data.category !== undefined) dbData.category = data.category;
  if (data.quantity !== undefined || data.qty !== undefined)
    dbData.quantity = data.quantity ?? data.qty;
  if (data.is_checked !== undefined || data.isChecked !== undefined)
    dbData.is_checked = data.is_checked ?? data.isChecked;

  const { data: updatedItem, error } = await supabaseAdmin
    .from("shopping_list")
    .update(dbData)
    .eq("id", itemId)
    .eq("user_id", userId) // Safety: ensure user owns the item
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapRowToShoppingItem(updatedItem);
};

export const deleteShoppingListItem = async (userId: string, itemId: string) => {
  const { error } = await supabaseAdmin
    .from("shopping_list")
    .delete()
    .eq("id", itemId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  return { deleted_count: 1 };
};

export const clearCheckedShoppingItems = async (userId: string) => {
  const { error } = await supabaseAdmin
    .from("shopping_list")
    .delete()
    .eq("user_id", userId)
    .eq("is_checked", true);

  if (error) throw new Error(error.message);
  return { cleared: true };
};
