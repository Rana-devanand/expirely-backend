import { supabase } from "../../config/supabase";
import { ICategory, ICreateCategory, IUpdateCategory } from "./category.model";

const mapRowToCategory = (row: any): ICategory => {
  if (!row) return row;
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

export const createCategory = async (userId: string, data: ICreateCategory) => {
  const newCategory = {
    user_id: userId,
    name: data.name,
    color: data.color || null,
    icon: data.icon || null,
  };

  const { data: createdCategory, error } = await supabase
    .from("categories")
    .insert(newCategory)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRowToCategory(createdCategory);
};

export const updateCategory = async (
  userId: string,
  categoryId: string,
  data: IUpdateCategory,
) => {
  const dbData: any = {};
  if (data.name !== undefined) dbData.name = data.name;
  if (data.color !== undefined) dbData.color = data.color;
  if (data.icon !== undefined) dbData.icon = data.icon;

  const { data: updatedCategory, error } = await supabase
    .from("categories")
    .update(dbData)
    .eq("id", categoryId)
    .eq("user_id", userId) // Ensure user owns category
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapRowToCategory(updatedCategory);
};

export const deleteCategory = async (userId: string, categoryId: string) => {
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", categoryId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  return { deleted_count: 1 };
};

export const getCategoryById = async (userId: string, categoryId: string) => {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("id", categoryId)
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") throw new Error(error.message);
  return data ? mapRowToCategory(data) : null;
};

export const getAllCategories = async (userId: string) => {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data.map(mapRowToCategory);
};
