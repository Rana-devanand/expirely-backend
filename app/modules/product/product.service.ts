import { supabase } from "../../config/supabase";
import { IProduct, ICreateProduct, IUpdateProduct } from "./product.model";

const mapRowToProduct = (row: any): any => {
  if (!row) return row;
  return {
    id: row.id,
    user_id: row.user_id,
    category_id: row.category_id,
    name: row.name,
    barcode: row.barcode,
    expiryDate: row.expiry_date,
    category: row.category,
    imageUrl: row.image_url,
    daysLeft: row.days_left,
    status: row.status,
    color: row.color,
    qty: row.quantity,
    progress: row.progress,
    notes: row.notes,
    is_consumed: row.is_consumed,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

export const createProduct = async (userId: string, data: ICreateProduct) => {
  const newProduct = {
    user_id: userId,
    name: data.name,
    category_id: data.category_id || null,
    barcode: data.barcode || null,
    expiry_date: data.expiry_date || (data as any).expiryDate,
    category: data.category || null,
    image_url: data.image_url || (data as any).imageUrl || null,
    days_left: data.days_left || null,
    status: data.status || "good",
    color: data.color || null,
    quantity: data.quantity || (data as any).qty || 1,
    progress: data.progress || null,
    notes: data.notes || null,
  };

  const { data: createdProduct, error } = await supabase
    .from("products")
    .insert(newProduct)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRowToProduct(createdProduct);
};

export const updateProduct = async (
  userId: string,
  productId: string,
  data: IUpdateProduct,
) => {
  const dbData: any = {};

  if (data.name !== undefined) dbData.name = data.name;
  if (data.category_id !== undefined) dbData.category_id = data.category_id;
  if (data.barcode !== undefined) dbData.barcode = data.barcode;
  if (data.expiry_date !== undefined || (data as any).expiryDate !== undefined)
    dbData.expiry_date = data.expiry_date || (data as any).expiryDate;
  if (data.category !== undefined) dbData.category = data.category;
  if (data.image_url !== undefined || (data as any).imageUrl !== undefined)
    dbData.image_url = data.image_url || (data as any).imageUrl;
  if (data.days_left !== undefined) dbData.days_left = data.days_left;
  if (data.status !== undefined) dbData.status = data.status;
  if (data.color !== undefined) dbData.color = data.color;
  if (data.quantity !== undefined || (data as any).qty !== undefined)
    dbData.quantity = data.quantity || (data as any).qty;
  if (data.progress !== undefined) dbData.progress = data.progress;
  if (data.notes !== undefined) dbData.notes = data.notes;
  if (data.is_consumed !== undefined) dbData.is_consumed = data.is_consumed;

  const { data: updatedProduct, error } = await supabase
    .from("products")
    .update(dbData)
    .eq("id", productId)
    .eq("user_id", userId) // Ensure user owns the product
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapRowToProduct(updatedProduct);
};

export const deleteProduct = async (userId: string, productId: string) => {
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  return { deleted_count: 1 };
};

export const getProductById = async (userId: string, productId: string) => {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") throw new Error(error.message);
  return data ? mapRowToProduct(data) : null;
};

export const getAllProducts = async (userId: string) => {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("user_id", userId)
    .order("expiry_date", { ascending: true });

  if (error) throw new Error(error.message);
  return data.map(mapRowToProduct);
};

export const fetchByBarcode = async (barcode: string) => {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
    );
    const data: any = await response.json();
    
    if (data.status === 1) {
      const p = data.product;
      
      // Robust Image Extraction
      const imageUrl = 
        p.image_url || 
        p.image_front_url || 
        p.image_small_url || 
        p.image_front_small_url ||
        p.selected_images?.front?.display?.en ||
        p.selected_images?.front?.display?.fr ||
        (p.images && (Object.values(p.images) as any[]).find((img: any) => img.sizes?.full?.url)?.sizes?.full?.url) ||
        null;

      const metadata = {
        name: p.product_name || p.generic_name || "Unknown Product",
        brand: p.brands || "",
        category: p.categories?.split(",")[0] || "Other",
        imageUrl: imageUrl,
        barcode: barcode,
        expirationDate: p.expiration_date || null,
        ingredients: p.ingredients_text || "",
        entryDate: p.entry_dates_tags?.[0] || null
      };

      // If exact expiration date is missing, let AI estimate it
      if (!metadata.expirationDate) {
        const aiEstimation = await groqService.estimateExpiryFromMetadata({
          name: metadata.name,
          category: metadata.category,
          ingredients: metadata.ingredients,
          entryDate: metadata.entryDate
        });
        
        return {
          ...metadata,
          estimatedExpiry: aiEstimation.estimatedExpiryDate,
          aiVerified: true,
          confidence: aiEstimation.confidence,
          storageTip: aiEstimation.storageTip
        };
      }

      return {
        ...metadata,
        aiVerified: false,
        confidence: 1.0
      };
    }
    return null;
  } catch (error) {
    console.error("Barcode Fetch Error:", error);
    return null;
  }
};

import { groqService } from "../../common/service/groq.service";

export const extractDatesFromImage = async (base64Image: string) => {
  return await groqService.extractDatesFromImage(base64Image);
};
export const getAllAdminProducts = async () => {
  const { data, error } = await supabase
    .from("products")
    .select(`
      *,
      users:user_id (username)
    `)
    .order("expiry_date", { ascending: true });

  if (error) throw new Error(error.message);
  
  return data.map(row => {
    const product = mapRowToProduct(row);
    return {
      ...product,
      addedBy: row.users?.username || 'Unknown'
    };
  });
};
