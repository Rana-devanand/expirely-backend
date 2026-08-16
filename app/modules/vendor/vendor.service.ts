import createHttpError from "http-errors";
import { supabaseAdmin } from "../../common/service/supabase.admin";
import { NearbyStoreQuery, StoreDto } from "./vendor.model";
import { vendorFlags } from "./vendor.flags";
import { randomUUID } from "crypto";
import { searchGeoapifyStores } from "./geoapify.provider";
import { loggerService } from "../../common/service/logger.service";

const mapStore = (row: any): StoreDto => ({
  id: row.id,
  name: row.name,
  description: row.description,
  category: row.category,
  phone: row.phone,
  email: row.email,
  websiteUrl: row.website_url,
  openingHours: row.opening_hours,
  brand: row.brand,
  rawCategories: Array.isArray(row.raw_categories) ? row.raw_categories : [],
  dataSource: row.data_source,
  addressText: row.address_text,
  locality: row.locality,
  city: row.city,
  state: row.state,
  country: row.country,
  postalCode: row.postal_code,
  latitude: Number(row.latitude),
  longitude: Number(row.longitude),
  claimStatus: row.claim_status,
  verificationStatus: row.verification_status,
  canChat: Boolean(row.can_chat),
  distanceM: Math.round(Number(row.distance_m)),
});

export const makeAreaKey = (latitude: number, longitude: number, radiusKm: 5 | 10) => {
  // Approximately 2.5 km grid cells; exact user coordinates never become cache keys.
  const cellSize = 0.025;
  return `grid-v2:${Math.floor(latitude / cellSize)}:${Math.floor(longitude / cellSize)}:${radiusKm}`;
};

const queryNearby = async (query: NearbyStoreQuery) => {
  const { data, error } = await supabaseAdmin.rpc("nearby_vendor_stores", {
    search_lat: query.latitude, search_lng: query.longitude,
    search_radius_m: query.radiusKm * 1000, result_limit: query.limit,
    category_filter: query.category || null,
  });
  if (error) throw createHttpError(500, "Unable to query nearby stores");
  return (data || []).map(mapStore);
};

const refreshExternalStores = async (query: NearbyStoreQuery, areaKey: string) => {
  const apiKey = process.env.GEOAPIFY_API_KEY?.trim();
  if (!vendorFlags.externalDiscovery() || !apiKey) return { attempted: false, imported: 0 };
  const owner = randomUUID();
  const { data: acquired, error: lockError } = await supabaseAdmin.rpc("claim_vendor_area_refresh", {
    requested_area_key: areaKey, requested_center_lat: query.latitude,
    requested_center_lng: query.longitude, requested_radius_m: query.radiusKm * 1000,
    requested_provider: "geoapify", requested_owner: owner,
  });
  if (lockError || !acquired) return { attempted: false, imported: 0 };
  try {
    const places = await searchGeoapifyStores(query.latitude, query.longitude, query.radiusKm * 1000, apiKey);
    const ids = places.map((place) => place.externalPlaceId);
    const { data: existing } = ids.length ? await supabaseAdmin.from("vendor_stores")
      .select("external_place_id,claim_status").eq("external_provider", "geoapify").in("external_place_id", ids) : { data: [] as any[] };
    const protectedIds = new Set((existing || []).filter((row: any) => row.claim_status !== "unclaimed").map((row: any) => row.external_place_id));
    const now = new Date().toISOString();
    const rows = places.filter((place) => !protectedIds.has(place.externalPlaceId)).map((place) => ({
      name: place.name, category: place.category, phone: place.phone, email: place.email,
      website_url: place.websiteUrl, opening_hours: place.openingHours, brand: place.brand,
      raw_categories: place.rawCategories, data_source: "geoapify_openstreetmap",
      address_text: place.addressText, locality: place.locality, city: place.city, state: place.state,
      country: place.country, postal_code: place.postalCode, latitude: place.latitude, longitude: place.longitude,
      source: "external", external_provider: "geoapify", external_place_id: place.externalPlaceId,
      provider_data: place.providerData, claim_status: "unclaimed", verification_status: "unverified",
      is_active: true, last_external_sync_at: now, updated_at: now,
    }));
    if (rows.length) {
      const { error } = await supabaseAdmin.from("vendor_stores").upsert(rows, { onConflict: "external_provider,external_place_id" });
      if (error) throw error;
    }
    const ttlHours = Math.min(Math.max(Number(process.env.VENDOR_DISCOVERY_CACHE_HOURS || 72), 1), 720);
    await supabaseAdmin.from("place_area_cache").update({
      fetched_at: now, expires_at: new Date(Date.now() + ttlHours * 3600000).toISOString(),
      result_count: places.length, refresh_status: "idle", refresh_started_at: null,
      refresh_owner: null, last_success_at: now, consecutive_failures: 0,
      next_retry_at: null, last_error: null, updated_at: now,
    }).eq("area_key", areaKey).eq("refresh_owner", owner);
    await loggerService.log("external_place_import", { provider: "geoapify", areaKey, resultCount: places.length, importedCount: rows.length });
    return { attempted: true, imported: rows.length };
  } catch (error: any) {
    const message = String(error?.message || "External discovery failed").slice(0, 500);
    const { data: cache } = await supabaseAdmin.from("place_area_cache").select("consecutive_failures").eq("area_key", areaKey).maybeSingle();
    const failures = Math.min(Number(cache?.consecutive_failures || 0) + 1, 10);
    const retryMinutes = Math.min(15 * (2 ** (failures - 1)), 1440);
    await supabaseAdmin.from("place_area_cache").update({
      refresh_status: "failed", refresh_started_at: null, refresh_owner: null,
      consecutive_failures: failures, next_retry_at: new Date(Date.now() + retryMinutes * 60000).toISOString(),
      last_error: message, updated_at: new Date().toISOString(),
    }).eq("area_key", areaKey).eq("refresh_owner", owner);
    await loggerService.log("external_place_import_failed", { provider: "geoapify", areaKey, message });
    return { attempted: true, imported: 0 };
  }
};

export const getNearbyStores = async (query: NearbyStoreQuery) => {
  if (!vendorFlags.marketplace() || !vendorFlags.discovery()) {
    throw createHttpError(503, "Nearby vendor discovery is not currently available");
  }
  const areaKey = makeAreaKey(query.latitude, query.longitude, query.radiusKm);
  const { data: cache } = await supabaseAdmin
    .from("place_area_cache")
    .select("expires_at,last_success_at,refresh_status")
    .eq("area_key", areaKey)
    .maybeSingle();

  let stores = await queryNearby(query);
  const fresh = Boolean(cache?.expires_at && new Date(cache.expires_at).getTime() > Date.now());
  const refresh = fresh ? { attempted: false, imported: 0 } : await refreshExternalStores(query, areaKey);
  if (refresh.attempted) stores = await queryNearby(query);
  const { data: currentCache } = await supabaseAdmin.from("place_area_cache")
    .select("expires_at,last_success_at,refresh_status").eq("area_key", areaKey).maybeSingle();
  return {
    stores,
    radiusKm: query.radiusKm,
    cache: {
      fresh: Boolean(currentCache?.expires_at && new Date(currentCache.expires_at).getTime() > Date.now()),
      lastUpdatedAt: currentCache?.last_success_at || null,
      refreshStatus: currentCache?.refresh_status || (vendorFlags.externalDiscovery() ? "not_fetched" : "disabled"),
    },
    externalRefreshAttempted: refresh.attempted,
    attribution: "Powered by Geoapify · © OpenStreetMap contributors",
  };
};

export const getStore = async (storeId: string) => {
  if (!vendorFlags.marketplace()) throw createHttpError(404, "Store not found");
  const { data, error } = await supabaseAdmin.from("vendor_stores")
    .select("id,name,description,category,phone,email,website_url,opening_hours,brand,raw_categories,data_source,address_text,locality,city,state,country,postal_code,latitude,longitude,claim_status,verification_status")
    .eq("id", storeId).eq("is_active", true).maybeSingle();
  if (error) throw createHttpError(500, "Unable to load store");
  if (!data) throw createHttpError(404, "Store not found");
  return {
    id: data.id, name: data.name, description: data.description, category: data.category,
    phone: data.phone, email: data.email, websiteUrl: data.website_url,
    openingHours: data.opening_hours, brand: data.brand,
    rawCategories: data.raw_categories || [], dataSource: data.data_source,
    addressText: data.address_text,
    locality: data.locality, city: data.city, state: data.state, country: data.country,
    postalCode: data.postal_code, latitude: data.latitude, longitude: data.longitude,
    claimStatus: data.claim_status, verificationStatus: data.verification_status,
    canChat: data.claim_status === "claimed",
  };
};

export const startStoreConversation = async (userId: string, storeId: string) => {
  if (!vendorFlags.marketplace()) throw createHttpError(404, "Store not found");
  const { data: store, error } = await supabaseAdmin.from("vendor_stores").select("id,name,owner_user_id,claim_status,is_active").eq("id", storeId).maybeSingle();
  if (error) throw createHttpError(500, "Unable to start store chat");
  if (!store || !store.is_active) throw createHttpError(404, "Store not found");
  if (store.claim_status !== "claimed" || !store.owner_user_id) throw createHttpError(409, "This store has not enabled chat yet");
  if (store.owner_user_id === userId) throw createHttpError(400, "You cannot start a customer chat with your own store");
  const findExisting = () => supabaseAdmin.from("community_conversations").select("id").eq("context_type", "vendor_store").eq("store_id", storeId).eq("buyer_id", userId).eq("seller_id", store.owner_user_id).maybeSingle();
  const { data: existing } = await findExisting();
  if (existing) return { id: existing.id, storeName: store.name };
  const { data, error: insertError } = await supabaseAdmin.from("community_conversations").insert({ context_type: "vendor_store", store_id: storeId, listing_id: null, buyer_id: userId, seller_id: store.owner_user_id }).select("id").single();
  if (insertError?.code === "23505") { const { data: raced } = await findExisting(); if (raced) return { id: raced.id, storeName: store.name }; }
  if (insertError || !data) throw createHttpError(500, "Unable to start store chat");
  return { id: data.id, storeName: store.name };
};

export const setStorePinned = async (userId: string, storeId: string, pinned: boolean) => {
  const { data: store } = await supabaseAdmin.from("vendor_stores").select("id,is_active").eq("id",storeId).maybeSingle();
  if(!store?.is_active) throw createHttpError(404,"Store not found");
  const query = pinned ? supabaseAdmin.from("vendor_store_pins").upsert({user_id:userId,store_id:storeId}) : supabaseAdmin.from("vendor_store_pins").delete().eq("user_id",userId).eq("store_id",storeId);
  const { error } = await query; if(error) throw createHttpError(500,"Unable to update pinned store");
  return {storeId,pinned};
};

export const getPinnedStores = async (userId: string) => {
  const { data:pins,error } = await supabaseAdmin.from("vendor_store_pins").select("store_id,created_at,vendor_stores(id,name,category,claim_status,verification_status,is_active,owner_user_id)").eq("user_id",userId).order("created_at",{ascending:false});
  if(error) throw createHttpError(500,"Unable to load pinned stores");
  const active=(pins||[]).filter((p:any)=>p.vendor_stores?.is_active); const ids=active.map((p:any)=>p.store_id);
  const { data:inventory,error:inventoryError }=ids.length?await supabaseAdmin.from("vendor_inventory").select("id,store_id,price,currency,quantity,unit,availability_status,catalog_products(id,name,category,unit,image_url)").in("store_id",ids).eq("is_active",true).neq("availability_status","out_of_stock"):{data:[],error:null};
  if(inventoryError) throw createHttpError(500,"Unable to load store products");
  const ownerIds=[...new Set(active.map((pin:any)=>pin.vendor_stores.owner_user_id).filter(Boolean))];
  const {data:published,error:publishedError}=ownerIds.length?await supabaseAdmin.from("products").select("id,user_id,name,category,image_url,quantity,expiry_date,product_weight,weight_unit,price,currency").in("user_id",ownerIds).eq("is_store_published",true).eq("is_consumed",false).neq("status","expired").order("created_at",{ascending:false}):{data:[],error:null};
  if(publishedError) throw createHttpError(500,"Unable to load published products");
  return active.map((pin:any)=>{const catalog=(inventory||[]).filter((item:any)=>item.store_id===pin.store_id).map((item:any)=>({id:item.id,...item.catalog_products,price:item.price,currency:item.currency,quantity:item.quantity,unit:item.unit||item.catalog_products?.unit,availabilityStatus:item.availability_status}));const added=(published||[]).filter((item:any)=>item.user_id===pin.vendor_stores.owner_user_id).map((item:any)=>({id:item.id,name:item.name,category:item.category,image_url:item.image_url,price:item.price,currency:item.currency||"INR",quantity:item.quantity,expiryDate:item.expiry_date,productWeight:item.product_weight,weightUnit:item.weight_unit,availabilityStatus:"available"}));return {...pin.vendor_stores,owner_user_id:undefined,pinnedAt:pin.created_at,products:[...catalog,...added]};});
};

const ownedStore = async(userId:string)=>{const {data}=await supabaseAdmin.from("vendor_stores").select("id,name").eq("owner_user_id",userId).eq("claim_status","claimed").eq("is_active",true).maybeSingle();if(!data)throw createHttpError(403,"Complete vendor store setup first");return data;};
export const getMyStoreProducts=async(userId:string)=>{const store=await ownedStore(userId);const {data,error}=await supabaseAdmin.from("products").select("id,name,category,image_url,quantity,status,is_consumed,is_store_published,created_at").eq("user_id",userId).order("created_at",{ascending:false});if(error)throw createHttpError(500,"Unable to load your products");return {store,products:(data||[]).map((item:any)=>({id:item.id,name:item.name,category:item.category,imageUrl:item.image_url,quantity:item.quantity,status:item.status,isConsumed:item.is_consumed,isPublished:item.is_store_published}))};};
export const setProductPublication=async(userId:string,productId:string,published:boolean)=>{await ownedStore(userId);const {data,error}=await supabaseAdmin.from("products").update({is_store_published:published}).eq("id",productId).eq("user_id",userId).select("id,is_store_published").maybeSingle();if(error)throw createHttpError(500,"Unable to update product publication");if(!data)throw createHttpError(404,"Product not found");return {id:data.id,isPublished:data.is_store_published};};

export const getPinnedStoreIds = async(userId:string)=>{const {data}=await supabaseAdmin.from("vendor_store_pins").select("store_id").eq("user_id",userId);return new Set((data||[]).map(row=>row.store_id));};

export type VendorOnboardingInput = {
  displayName: string; businessPhone: string; storeName: string; category: string;
  addressText: string; locality: string; city: string; state: string; country: string;
  postalCode: string; latitude: number; longitude: number;
};

export const completeVendorOnboarding = async (userId: string, input: VendorOnboardingInput) => {
  if (!vendorFlags.marketplace()) throw createHttpError(503, "Vendor onboarding is not currently available");
  const { data, error } = await supabaseAdmin.rpc("complete_vendor_onboarding", {
    onboarding_user_id: userId, onboarding_display_name: input.displayName,
    onboarding_phone: input.businessPhone, onboarding_store_name: input.storeName,
    onboarding_category: input.category, onboarding_address: input.addressText,
    onboarding_locality: input.locality, onboarding_city: input.city,
    onboarding_state: input.state, onboarding_country: input.country,
    onboarding_postal_code: input.postalCode, onboarding_latitude: input.latitude,
    onboarding_longitude: input.longitude,
  });
  if (error) throw createHttpError(500, "Unable to complete vendor setup");
  return { id: data.id, name: data.name, verificationStatus: data.verification_status };
};
