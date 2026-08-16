export type NearbyStoreQuery = {
  latitude: number;
  longitude: number;
  radiusKm: 5 | 10;
  limit: number;
  category?: string;
};

export type StoreDto = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  phone?: string | null;
  email?: string | null;
  websiteUrl?: string | null;
  openingHours?: string | null;
  brand?: string | null;
  rawCategories: string[];
  dataSource?: string | null;
  addressText?: string | null;
  locality?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  latitude: number;
  longitude: number;
  claimStatus: string;
  verificationStatus: string;
  canChat: boolean;
  distanceM: number;
};
