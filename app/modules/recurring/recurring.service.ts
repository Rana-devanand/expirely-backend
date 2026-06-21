import { supabaseAdmin } from "../../common/service/supabase.admin";
import { IRecurringProduct, ICreateRecurringProduct, IUpdateRecurringProduct } from "./recurring.model";

export const getRecurringProducts = async (userId: string): Promise<IRecurringProduct[]> => {
  const { data, error } = await supabaseAdmin
    .from("recurring_products")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
};

export const createRecurringProduct = async (
  userId: string,
  data: ICreateRecurringProduct
): Promise<IRecurringProduct> => {
  const newTemplate = {
    user_id: userId,
    name: data.name,
    category: data.category,
    default_qty: data.default_qty || 1,
    default_shelf_life_days: data.default_shelf_life_days,
    image_url: data.image_url || null,
  };

  const { data: created, error } = await supabaseAdmin
    .from("recurring_products")
    .insert(newTemplate)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return created;
};

export const updateRecurringProduct = async (
  userId: string,
  id: string,
  data: IUpdateRecurringProduct
): Promise<IRecurringProduct> => {
  const updatePayload: any = {};
  if (data.name !== undefined) updatePayload.name = data.name;
  if (data.category !== undefined) updatePayload.category = data.category;
  if (data.default_qty !== undefined) updatePayload.default_qty = data.default_qty;
  if (data.default_shelf_life_days !== undefined)
    updatePayload.default_shelf_life_days = data.default_shelf_life_days;
  if (data.image_url !== undefined) updatePayload.image_url = data.image_url;
  
  updatePayload.updated_at = new Date().toISOString();

  const { data: updated, error } = await supabaseAdmin
    .from("recurring_products")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return updated;
};

export const deleteRecurringProduct = async (userId: string, id: string): Promise<void> => {
  const { error } = await supabaseAdmin
    .from("recurring_products")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
};

export const logTemplateAdded = async (userId: string, id: string): Promise<void> => {
  const { error } = await supabaseAdmin
    .from("recurring_products")
    .update({ last_added_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
};
