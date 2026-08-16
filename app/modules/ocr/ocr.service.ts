import { geminiService } from "../../common/service/gemini.service";
import { ExtractedProductData, ProductFieldConfidence } from "./ocr.types";
import { productLookupService } from "./product-lookup.service";
import { productEnrichmentService } from "./product-enrichment.service";

const fields = [
  "productName", "brand", "barcode", "manufacturingDate", "packedDate", "expiryDate",
  "bestBeforeText", "quantity", "category",
] as const;
const confidenceFields: (keyof ProductFieldConfidence)[] = [
  "productName", "brand", "manufacturingDate", "expiryDate", "quantity",
];
const allowedCategories = new Set([
  "Dairy", "Food", "Beverage", "Medicine", "Cosmetics", "Personal Care",
  "Household", "Other",
]);

const nullableString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, 300) : null;

export const validateExtractedProduct = (input: unknown): ExtractedProductData => {
  if (!input || typeof input !== "object") throw new Error("AI returned invalid product data");
  const source = input as Record<string, unknown>;
  const data: any = {};
  for (const field of fields) data[field] = nullableString(source[field]);
  if (data.category && !allowedCategories.has(data.category)) data.category = "Other";
  for (const field of ["manufacturingDate", "packedDate", "expiryDate"] as const) {
    if (data[field] && !/^\d{4}-\d{2}-\d{2}$/.test(data[field])) data[field] = null;
  }

  if (data.productName && (data.productName.includes(",") || /^(ingredients?|contains|allergens?)\b/i.test(data.productName))) {
    data.productName = null;
  }

  const rawValidation = source.labelValidation as Record<string, unknown> | undefined;
  data.labelValidation = {
    isProductLabel: rawValidation?.isProductLabel === true,
    hasProductIdentity: rawValidation?.hasProductIdentity === true,
    hasManufacturingEvidence: rawValidation?.hasManufacturingEvidence === true,
    hasExpiryEvidence: rawValidation?.hasExpiryEvidence === true,
    message: nullableString(rawValidation?.message),
  };

  const rawConfidence = source.confidence as Record<string, unknown> | undefined;
  data.confidence = {};
  for (const field of confidenceFields) {
    const value = Number(rawConfidence?.[field]);
    data.confidence[field] = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  }
  return data as ExtractedProductData;
};

class OCRExtractionService {
  async extractProduct(
    ocrText: string,
    timezone: string,
    onEvent?: (event: { type: string; message?: string; data?: unknown }) => void,
  ) {
    const prompt = `You are a product-label information extraction system.
OCR text:\n---\n${ocrText}\n---
Timezone context: ${timezone}.
Extract only information explicitly supported by the text. Never invent or estimate missing values.
Return JSON only with: productName, brand, barcode, manufacturingDate, packedDate, expiryDate,
bestBeforeText, quantity, category, confidence, labelValidation.
Use null when unknown. Exact dates must be YYYY-MM-DD. Do not guess ambiguous numeric dates.
Only return barcode when an 8 to 14 digit barcode is explicitly visible in the OCR text.
The OCR text contains one to three named sections. Product front is required; Manufacturing label and Expiry label are optional.
labelValidation must contain isProductLabel, hasProductIdentity, hasManufacturingEvidence, hasExpiryEvidence, and message.
Set hasProductIdentity only when the Product front section clearly contains a product/brand identity.
Set manufacturing/expiry evidence only when their respective optional sections are present and contain recognizable date labels or dates. Missing optional sections must not make isProductLabel false.
Never use an ingredient list, nutrition paragraph, random document, person, scenery, or unrelated text as productName.
You may calculate expiry only when an explicit best-before duration and its source date are both present.
Categories: Dairy, Food, Beverage, Medicine, Cosmetics, Personal Care, Household, Other.
confidence must contain productName, brand, manufacturingDate, expiryDate, quantity, each from 0 to 1.`;
    onEvent?.({ type: "status", message: "Identifying product from captured labels..." });
    const raw = await geminiService.generateStructuredJson(prompt);
    const extracted = validateExtractedProduct(raw);
    onEvent?.({
      type: "product_identity",
      message: extracted.productName ? `Product identified: ${extracted.productName}` : "Product identity needs confirmation",
      data: {
        productName: extracted.productName,
        brand: extracted.brand,
        barcode: extracted.barcode,
        category: extracted.category,
      },
    });
    onEvent?.({ type: "status", message: "Checking trusted product information..." });
    const verifiedData = await productLookupService.lookup({
      barcode: extracted.barcode,
      productName: extracted.productName,
      brand: extracted.brand,
    });
    const enrichedIdentity = {
      ...extracted,
      productName: verifiedData?.productName || extracted.productName,
      brand: verifiedData?.brand || extracted.brand,
      quantity: verifiedData?.quantity || extracted.quantity,
    };
    onEvent?.({
      type: "ingredients",
      message: verifiedData?.ingredients.length ? "Verified ingredients found" : "Verified ingredients were not available",
      data: {
        ingredients: verifiedData?.ingredients || [],
        allergens: verifiedData?.allergens || [],
        nutrition: verifiedData?.nutrition || null,
      },
    });
    onEvent?.({ type: "status", message: "Preparing product insights..." });
    const enrichment = await productEnrichmentService.enrich(enrichedIdentity, verifiedData);
    onEvent?.({
      type: "product_details",
      message: "Product insights ready",
      data: {
        description: enrichment.description,
        productType: enrichment.productType,
        subcategory: enrichment.subcategory,
        storageInstructions: enrichment.storageInstructions,
      },
    });
    onEvent?.({
      type: "expiry",
      message: extracted.expiryDate ? "Printed expiry date found" : enrichment.estimatedExpiryDate ? "Estimated expiry prepared" : "Expiry needs manual confirmation",
      data: {
        manufacturingDate: extracted.manufacturingDate,
        packedDate: extracted.packedDate,
        expiryDate: extracted.expiryDate,
        estimatedExpiryDate: enrichment.estimatedExpiryDate,
        confidence: enrichment.expiryConfidence,
      },
    });
    return {
      ...enrichedIdentity,
      verifiedData,
      enrichment,
      sources: {
        productName: verifiedData?.productName ? "barcode_database" : "label",
        brand: verifiedData?.brand ? "barcode_database" : "label",
        barcode: "label",
        ingredients: verifiedData ? "barcode_database" : "ai_inference",
        nutrition: verifiedData ? "barcode_database" : "ai_inference",
        expiryDate: "label",
      },
    };
  }
}

export const ocrExtractionService = new OCRExtractionService();
