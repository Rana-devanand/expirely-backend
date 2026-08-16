import { Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import createHttpError from "http-errors";
import { createResponse } from "../../common/helper/response.helper";
import { completeVendorOnboarding, getMyStoreProducts, getNearbyStores, getPinnedStoreIds, getPinnedStores, getStore, setProductPublication, setStorePinned, startStoreConversation } from "./vendor.service";
import { publicVendorFlags } from "./vendor.flags";

const finite = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const flags = expressAsyncHandler(async (_req: Request, res: Response) => {
  res.send(createResponse(publicVendorFlags()));
});

export const startConversation = expressAsyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createHttpError(400, "Invalid store id");
  res.status(201).send(createResponse(await startStoreConversation((req.user as any).id, id)));
});

export const onboard = expressAsyncHandler(async (req: Request, res: Response) => {
  const text = (key: string, max = 200) => typeof req.body?.[key] === "string" ? req.body[key].trim().slice(0, max) : "";
  const latitude = finite(req.body?.latitude); const longitude = finite(req.body?.longitude);
  const input = {
    displayName: text("displayName",100), businessPhone: text("businessPhone",30), storeName: text("storeName",200),
    category: text("category",80), addressText: text("addressText",500), locality: text("locality",120),
    city: text("city",120), state: text("state",120), country: text("country",120), postalCode: text("postalCode",20),
    latitude: latitude as number, longitude: longitude as number,
  };
  if (!input.displayName || !input.storeName || !input.category || !input.addressText || !input.city || !input.country) throw createHttpError(400, "Complete the required business details");
  if (latitude === null || latitude < -90 || latitude > 90 || longitude === null || longitude < -180 || longitude > 180) throw createHttpError(400, "A valid store location is required");
  res.status(201).send(createResponse(await completeVendorOnboarding((req.user as any).id, input)));
});

export const nearby = expressAsyncHandler(async (req: Request, res: Response) => {
  const latitude = finite(req.query.lat);
  const longitude = finite(req.query.lng);
  const radiusKm = finite(req.query.radiusKm ?? 5);
  const limit = finite(req.query.limit ?? 50);
  if (latitude === null || latitude < -90 || latitude > 90) throw createHttpError(400, "Invalid latitude");
  if (longitude === null || longitude < -180 || longitude > 180) throw createHttpError(400, "Invalid longitude");
  if (radiusKm !== 5 && radiusKm !== 10) throw createHttpError(400, "radiusKm must be 5 or 10");
  if (limit === null || !Number.isInteger(limit) || limit < 1 || limit > 100) throw createHttpError(400, "limit must be between 1 and 100");
  const category = typeof req.query.category === "string" ? req.query.category.trim().slice(0, 80) : undefined;
  const data = await getNearbyStores({ latitude, longitude, radiusKm, limit, category: category || undefined });
  const pinned = await getPinnedStoreIds((req.user as any).id);
  data.stores = data.stores.map((item:any)=>({...item,isPinned:pinned.has(item.id)}));
  res.send(createResponse(data));
});

export const pinnedStores = expressAsyncHandler(async(req:Request,res:Response)=>{res.send(createResponse(await getPinnedStores((req.user as any).id)));});
export const pinStore = expressAsyncHandler(async(req:Request,res:Response)=>{res.send(createResponse(await setStorePinned((req.user as any).id,String(req.params.id),true)));});
export const unpinStore = expressAsyncHandler(async(req:Request,res:Response)=>{res.send(createResponse(await setStorePinned((req.user as any).id,String(req.params.id),false)));});
export const myStoreProducts=expressAsyncHandler(async(req:Request,res:Response)=>{res.send(createResponse(await getMyStoreProducts((req.user as any).id)));});
export const publishProduct=expressAsyncHandler(async(req:Request,res:Response)=>{if(typeof req.body?.published!=="boolean")throw createHttpError(400,"published must be boolean");res.send(createResponse(await setProductPublication((req.user as any).id,String(req.params.id),req.body.published)));});

export const store = expressAsyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw createHttpError(400, "Invalid store id");
  }
  res.send(createResponse(await getStore(id)));
});
