export interface VerifiedProductData {
  productName: string | null;
  brand: string | null;
  barcode: string | null;
  ingredients: string[];
  allergens: string[];
  quantity: string | null;
  nutrition: {
    servingSize: string | null;
    calories: number | null;
    protein: string | null;
    carbohydrates: string | null;
    sugar: string | null;
    fat: string | null;
    saturatedFat: string | null;
    sodium: string | null;
  };
  manufacturer: string | null;
  countryOfOrigin: string | null;
}

const cache = new Map<string, { expiresAt: number; value: VerifiedProductData | null }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const nutrient = (value: unknown, unit: unknown): string | null => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const normalizedUnit = typeof unit === "string" ? unit : "";
  return `${value}${normalizedUnit ? ` ${normalizedUnit}` : ""}`;
};

class ProductLookupService {
  async lookup(input: { barcode?: string | null; productName?: string | null; brand?: string | null }) {
    if (input.barcode) {
      const barcodeResult = await this.lookupByBarcode(input.barcode);
      if (barcodeResult) return barcodeResult;
    }
    if (!input.productName) return null;
    const searchKey = `name:${input.productName}:${input.brand || ""}`.toLowerCase();
    const cached = cache.get(searchKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    try {
      const terms = [input.productName, input.brand].filter(Boolean).join(" ");
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(terms)}&search_simple=1&action=process&json=1&page_size=1&fields=code`;
      const response = await fetch(url, { headers: { "User-Agent": "Expirely/1.0 (product-intelligence)" } });
      if (!response.ok) throw new Error(`Product name search HTTP ${response.status}`);
      const body = (await response.json()) as any;
      const code = body?.products?.[0]?.code;
      const value = code ? await this.lookupByBarcode(String(code)) : null;
      cache.set(searchKey, { expiresAt: Date.now() + CACHE_TTL_MS, value });
      return value;
    } catch (error) {
      console.warn("Product name search failed", error instanceof Error ? error.message : error);
      return null;
    }
  }

  async lookupByBarcode(barcode: string): Promise<VerifiedProductData | null> {
    const normalized = barcode.replace(/\D/g, "");
    if (normalized.length < 8 || normalized.length > 14) return null;
    const cached = cache.get(normalized);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    try {
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${normalized}.json`,
        { headers: { "User-Agent": "Expirely/1.0 (product-intelligence)" } },
      );
      if (!response.ok) throw new Error(`Product lookup HTTP ${response.status}`);
      const body = (await response.json()) as any;
      if (body?.status !== 1 || !body.product) {
        cache.set(normalized, { expiresAt: Date.now() + CACHE_TTL_MS, value: null });
        return null;
      }
      const product = body.product;
      const nutriments = product.nutriments || {};
      const value: VerifiedProductData = {
        productName: text(product.product_name),
        brand: text(product.brands),
        barcode: normalized,
        ingredients: Array.isArray(product.ingredients)
          ? product.ingredients.map((item: any) => text(item?.text)).filter(Boolean)
          : [],
        allergens: Array.isArray(product.allergens_tags)
          ? product.allergens_tags.map((item: string) => item.replace(/^[a-z]{2}:/, ""))
          : [],
        quantity: text(product.quantity),
        nutrition: {
          servingSize: text(product.serving_size),
          calories: typeof nutriments["energy-kcal_100g"] === "number"
            ? nutriments["energy-kcal_100g"] : null,
          protein: nutrient(nutriments.proteins_100g, nutriments.proteins_unit),
          carbohydrates: nutrient(nutriments.carbohydrates_100g, nutriments.carbohydrates_unit),
          sugar: nutrient(nutriments.sugars_100g, nutriments.sugars_unit),
          fat: nutrient(nutriments.fat_100g, nutriments.fat_unit),
          saturatedFat: nutrient(nutriments["saturated-fat_100g"], nutriments["saturated-fat_unit"]),
          sodium: nutrient(nutriments.sodium_100g, nutriments.sodium_unit),
        },
        manufacturer: text(product.manufacturing_places),
        countryOfOrigin: text(product.countries),
      };
      cache.set(normalized, { expiresAt: Date.now() + CACHE_TTL_MS, value });
      return value;
    } catch (error) {
      console.warn("Trusted product lookup failed", error instanceof Error ? error.message : error);
      return null;
    }
  }
}

export const productLookupService = new ProductLookupService();
