import { supabase } from "../../config/supabase";
import { supabaseAdmin } from "../../common/service/supabase.admin";
import { IProduct, ICreateProduct, IUpdateProduct } from "./product.model";
import { groqService } from "../../common/service/groq.service";
import {
  getHouseholdMemberIds,
  getHouseholdIdForUser,
} from "../household/household.service";

interface NormalizedProduct {
  name: string;
  brand: string;
  category: string;
  imageUrl: string | null;
  barcode: string;
  expirationDate: string | null;
  ingredients: string;
  entryDate: string | null;
  rawData?: any;
}


const calculateDaysLeft = (expiryDate: string | Date): number => {
  if (!expiryDate) return 0;
  const expiry = new Date(expiryDate);
  const now = new Date();
  
  // Set both to midnight to get exact calendar days diff
  expiry.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

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
    productWeight: row.product_weight,
    weightUnit: row.weight_unit,
    price: row.price,
    currency: row.currency,
    progress: row.progress,
    notes: row.notes,
    ingredients: row.ingredients,
    is_consumed: row.is_consumed,
    storageLocation: row.storage_location,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

export const createProduct = async (userId: string, data: ICreateProduct) => {
  const expiryVal = data.expiry_date || (data as any).expiryDate;
  const calculatedDaysLeft = expiryVal ? calculateDaysLeft(expiryVal) : null;
  let status = data.status;
  if (!status && calculatedDaysLeft !== null) {
    if (calculatedDaysLeft < 0) {
      status = "expired";
    } else if (calculatedDaysLeft <= 3) {
      status = "warning";
    } else {
      status = "good";
    }
  }

  // Stamp household_id if user belongs to a household
  let householdId: string | null = null;
  try {
    householdId = await getHouseholdIdForUser(userId);
  } catch (_) { /* non-critical */ }

  const newProduct = {
    user_id: userId,
    name: data.name,
    category_id: data.category_id || null,
    barcode: data.barcode || null,
    expiry_date: expiryVal,
    category: data.category || null,
    image_url: data.image_url || (data as any).imageUrl || null,
    days_left: calculatedDaysLeft,
    status: status || "good",
    color: data.color || null,
    quantity: data.quantity || (data as any).qty || 1,
    product_weight: data.product_weight || (data as any).productWeight || null,
    weight_unit: data.weight_unit || (data as any).weightUnit || null,
    price: data.price ?? null,
    currency: data.currency || null,
    progress: data.progress || null,
    notes: data.notes || null,
    ingredients: data.ingredients || null,
    storage_location: data.storageLocation || data.storage_location || "other",
    household_id: householdId,
  };

  const { data: createdProduct, error } = await supabaseAdmin
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
  
  const expiryVal = data.expiry_date || (data as any).expiryDate;
  if (expiryVal !== undefined) {
    const calculatedDaysLeft = calculateDaysLeft(expiryVal);
    dbData.expiry_date = expiryVal;
    dbData.days_left = calculatedDaysLeft;
    
    let status = data.status;
    if (!status) {
      if (calculatedDaysLeft < 0) {
        status = "expired";
      } else if (calculatedDaysLeft <= 3) {
        status = "warning";
      } else {
        status = "good";
      }
    }
    dbData.status = status;
  } else {
    if (data.days_left !== undefined) dbData.days_left = data.days_left;
    if (data.status !== undefined) dbData.status = data.status;
  }

  if (data.category !== undefined) dbData.category = data.category;
  if (data.image_url !== undefined || (data as any).imageUrl !== undefined)
    dbData.image_url = data.image_url || (data as any).imageUrl;
  if (data.color !== undefined) dbData.color = data.color;
  if (data.quantity !== undefined || (data as any).qty !== undefined)
    dbData.quantity = data.quantity || (data as any).qty;
  if(data.product_weight!==undefined||(data as any).productWeight!==undefined)dbData.product_weight=data.product_weight||(data as any).productWeight||null;
  if(data.weight_unit!==undefined||(data as any).weightUnit!==undefined)dbData.weight_unit=data.weight_unit||(data as any).weightUnit||null;
  if(data.price!==undefined)dbData.price=data.price;
  if(data.currency!==undefined)dbData.currency=data.currency;
  if (data.progress !== undefined) dbData.progress = data.progress;
  if (data.notes !== undefined) dbData.notes = data.notes;
  if (data.ingredients !== undefined) dbData.ingredients = data.ingredients;
  if (data.is_consumed !== undefined) dbData.is_consumed = data.is_consumed;
  if (data.storageLocation !== undefined || data.storage_location !== undefined)
    dbData.storage_location = data.storageLocation || data.storage_location;

  // Allow any household member to update a shared product
  let memberIds: string[] = [userId];
  try { memberIds = await getHouseholdMemberIds(userId); } catch (_) {}

  const { data: updatedProduct, error } = await supabaseAdmin
    .from("products")
    .update(dbData)
    .eq("id", productId)
    .in("user_id", memberIds)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapRowToProduct(updatedProduct);
};

export const deleteProduct = async (userId: string, productId: string) => {
  // Allow any household member to delete a shared product
  let memberIds: string[] = [userId];
  try { memberIds = await getHouseholdMemberIds(userId); } catch (_) {}

  const { error } = await supabaseAdmin
    .from("products")
    .delete()
    .eq("id", productId)
    .in("user_id", memberIds);

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
  // Expand query to all household members if user belongs to one
  let memberIds: string[] = [userId];
  try { memberIds = await getHouseholdMemberIds(userId); } catch (_) {}

  const { data, error } = await supabaseAdmin
    .from("products")
    .select("*")
    .in("user_id", memberIds)
    .order("expiry_date", { ascending: true });

  if (error) throw new Error(error.message);
  return data.map(mapRowToProduct);
};

const fetchFromOpenFoodFacts = async (barcode: string): Promise<NormalizedProduct | null> => {
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    const textData = await response.text();
    let data: any;
    try { data = JSON.parse(textData); } catch (e) { return null; }
    if (data.status === 1) {
      const p = data.product;
      const imageUrl = p.image_url || p.image_front_url || p.image_small_url || p.image_front_small_url || p.selected_images?.front?.display?.en || null;
      let engIngredients = p.ingredients_text_en || p.ingredients_text || "";
      if (p.ingredients_tags && p.ingredients_tags.length > 0) {
        engIngredients = p.ingredients_tags.map((t: string) => t.replace('en:', '').replace(/-/g, ' ')).join(', ');
      }
      
      return {
        name: p.product_name || p.generic_name || "Unknown Product",
        brand: p.brands || "",
        category: p.categories?.split(",")[0] || "Other",
        imageUrl,
        barcode,
        expirationDate: p.expiration_date || null,
        ingredients: engIngredients,
        entryDate: p.entry_dates_tags?.[0] || (p.created_t ? new Date(p.created_t * 1000).toISOString().split('T')[0] : null),
        rawData: p
      };
    }
  } catch (error) {
    console.warn("OpenFoodFacts Error:", error);
  }
  return null;
};

const fetchFromUPCitemdb = async (barcode: string): Promise<NormalizedProduct | null> => {
  try {
    const apiKey = process.env.UPCITEMDB_API_KEY;
    const headers: any = { "Content-Type": "application/json" };
    if (apiKey) headers["user_key"] = apiKey;

    const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`, { headers });
    const textData = await response.text();
    let data: any;
    try { data = JSON.parse(textData); } catch (e) { return null; }

    if (data.code === "OK" && data.items?.length > 0) {
      const item = data.items[0];
      return {
        name: item.title || "Unknown Product",
        brand: item.brand || "",
        category: item.category || "Other",
        imageUrl: item.images?.[0] || null,
        barcode,
        expirationDate: null, // UPCitemdb doesn't usually provide expiration
        ingredients: item.description || "",
        entryDate: null,
        rawData: item
      };
    }
  } catch (error) {
    console.warn("UPCitemdb Error:", error);
  }
  return null;
};

export const fetchByBarcode = async (barcode: string) => {
  try {
    // Try Open Food Facts first
    let metadata = await fetchFromOpenFoodFacts(barcode);
    console.log({metadata})
    // If not found, try UPCitemdb
    if (!metadata) {
      metadata = await fetchFromUPCitemdb(barcode);
    }

    if (metadata) {
      // If exact expiration date is missing, let AI estimate it
      if (!metadata.expirationDate || metadata.ingredients !== "Translated") {
        const aiEstimation = await groqService.estimateExpiryFromMetadata({
          name: metadata.name,
          category: metadata.category,
          ingredients: metadata.ingredients,
          entryDate: metadata.entryDate || undefined,
          rawData: metadata.rawData
        });
        
        delete metadata.rawData;
        return {
          ...metadata,
          expirationDate: null,
          estimatedExpiry: null,
          ingredients: (aiEstimation.englishIngredients && aiEstimation.englishIngredients.length > 0) ? aiEstimation.englishIngredients.join(', ') : metadata.ingredients,
          aiVerified: true,
          confidence: aiEstimation.confidence,
          storageTip: aiEstimation.storageTip
        };
      }

      delete metadata.rawData;
      return {
        ...metadata,
        expirationDate: null,
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

export const extractDatesFromImage = async (base64Image: string) => {
  return await groqService.extractDatesFromImage(base64Image);
};

export const getDynamicInventoryInsight = async (userId: string) => {
  const products = await getAllProducts(userId);
  return await groqService.generateDynamicInventorySummary(products);
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

export const getAdminProductById = async (productId: string) => {
  const { data, error } = await supabase
    .from("products")
    .select(`
      *,
      users:user_id (username, email)
    `)
    .eq("id", productId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  
  const product = mapRowToProduct(data);
  return {
    ...product,
    addedBy: data.users?.username || 'Unknown',
    addedByEmail: data.users?.email || 'Unknown'
  };
};
