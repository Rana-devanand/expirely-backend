import { supabaseAdmin } from "../../common/service/supabase.admin";
import { ICreateUsageEvent, IProductUsageEvent, IUsageSummary } from "./usage.model";

const mapRowToUsageEvent = (row: any): IProductUsageEvent => {
  return {
    id: row.id,
    user_id: row.user_id,
    product_id: row.product_id,
    type: row.type,
    quantity: Number(row.quantity || 0),
    note: row.note || undefined,
    created_at: row.created_at,
  };
};

export const logUsageEvent = async (
  userId: string,
  productId: string,
  data: ICreateUsageEvent
) => {
  // 1. Fetch the product
  const { data: product, error: fetchError } = await supabaseAdmin
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !product) {
    throw new Error("Product not found or access denied");
  }

  const logQty = Number(data.quantity ?? 1);

  // 2. Insert usage event
  const newEvent = {
    user_id: userId,
    product_id: productId,
    type: data.type,
    quantity: logQty,
    note: data.note || null,
  };

  const { data: createdEvent, error: insertError } = await supabaseAdmin
    .from("product_usage_events")
    .insert(newEvent)
    .select()
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  // 3. Update the product status/quantity accordingly
  const updatePayload: any = {
    last_used_at: new Date().toISOString(),
  };

  if (data.type === "USED_FULLY") {
    updatePayload.is_consumed = true;
    updatePayload.quantity = 0;
    updatePayload.remaining_qty = 0;
  } else if (data.type === "WASTED") {
    updatePayload.is_consumed = true;
    updatePayload.quantity = 0;
    updatePayload.remaining_qty = 0;
    updatePayload.status = "expired";
  } else if (data.type === "USED_PARTIALLY") {
    // Determine current remaining quantity
    const currentRemaining = product.remaining_qty !== null ? Number(product.remaining_qty) : Number(product.quantity || 1);
    const newRemaining = Math.max(0, currentRemaining - logQty);

    if (newRemaining <= 0) {
      updatePayload.is_consumed = true;
      updatePayload.quantity = 0;
      updatePayload.remaining_qty = 0;
    } else {
      updatePayload.remaining_qty = newRemaining;
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from("products")
    .update(updatePayload)
    .eq("id", productId)
    .eq("user_id", userId);

  if (updateError) {
    console.warn("Failed to update product state on usage logging:", updateError.message);
  }

  return mapRowToUsageEvent(createdEvent);
};

export const getProductUsageEvents = async (userId: string, productId: string) => {
  const { data, error } = await supabaseAdmin
    .from("product_usage_events")
    .select("*")
    .eq("product_id", productId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    if (error.code === "PGRST116" || error.message.includes("does not exist")) {
      console.warn("product_usage_events table does not exist in Supabase yet. Returning empty list.");
      return [];
    }
    throw new Error(error.message);
  }

  return (data || []).map(mapRowToUsageEvent);
};

export const getUsageSummary = async (userId: string): Promise<IUsageSummary> => {
  const { data, error } = await supabaseAdmin
    .from("product_usage_events")
    .select("*, products(name, category)")
    .eq("user_id", userId);

  if (error) {
    if (error.code === "PGRST116" || error.message.includes("does not exist")) {
      return {
        consumedCount: 0,
        wastedCount: 0,
        totalCount: 0,
        wasteRate: 0,
        outcomeBreakdown: { USED_FULLY: 0, USED_PARTIALLY: 0, WASTED: 0 },
        wastedByCategory: [],
      };
    }
    throw new Error(error.message);
  }

  let consumedCount = 0;
  let wastedCount = 0;
  const outcomeBreakdown = { USED_FULLY: 0, USED_PARTIALLY: 0, WASTED: 0 };
  const wasteCategoryMap: Record<string, number> = {};

  (data || []).forEach((row: any) => {
    if (row.type === "USED_FULLY") {
      consumedCount++;
      outcomeBreakdown.USED_FULLY++;
    } else if (row.type === "USED_PARTIALLY") {
      consumedCount++;
      outcomeBreakdown.USED_PARTIALLY++;
    } else if (row.type === "WASTED") {
      wastedCount++;
      outcomeBreakdown.WASTED++;

      const category = row.products?.category || "Other";
      wasteCategoryMap[category] = (wasteCategoryMap[category] || 0) + 1;
    }
  });

  const totalCount = consumedCount + wastedCount;
  const wasteRate = totalCount > 0 ? Number(((wastedCount / totalCount) * 100).toFixed(1)) : 0;

  const wastedByCategory = Object.entries(wasteCategoryMap).map(([category, count]) => ({
    category,
    count,
  })).sort((a, b) => b.count - a.count);

  return {
    consumedCount,
    wastedCount,
    totalCount,
    wasteRate,
    outcomeBreakdown,
    wastedByCategory,
  };
};
