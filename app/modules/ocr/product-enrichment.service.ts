import { geminiService } from "../../common/service/gemini.service";
import { ExtractedProductData } from "./ocr.types";
import { VerifiedProductData } from "./product-lookup.service";

export interface ProductEnrichment {
  description: string | null;
  subcategory: string | null;
  productType: string | null;
  ingredientInsights: string[];
  allergenSummary: string | null;
  nutritionSummary: string | null;
  storageInstructions: string | null;
  afterOpeningInstructions: string | null;
  usageIdeas: string[];
  shelfLifeEstimateDays: number | null;
  estimatedExpiryDate: string | null;
  expiryBasis: string | null;
  expiryConfidence: number;
  safetyDisclaimer: string;
}

const safeText = (value: unknown, max = 500) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
const safeList = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
        .map((item) => item.trim().slice(0, 240)).slice(0, 8)
    : [];

const addDays = (date: string, days: number) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};

class ProductEnrichmentService {
  async enrich(extracted: ExtractedProductData, verified: VerifiedProductData | null): Promise<ProductEnrichment> {
    const prompt = `You are Expirely's product education and shelf-life analysis engine.
Identity and label facts: ${JSON.stringify({
      productName: extracted.productName,
      brand: extracted.brand,
      category: extracted.category,
      manufacturingDate: extracted.manufacturingDate,
      packedDate: extracted.packedDate,
      printedExpiryDate: extracted.expiryDate,
      bestBeforeText: extracted.bestBeforeText,
      quantity: extracted.quantity,
    })}
Verified product database data: ${JSON.stringify(verified)}

Return JSON only with description, subcategory, productType, ingredientInsights,
allergenSummary, nutritionSummary, storageInstructions, afterOpeningInstructions,
usageIdeas, shelfLifeEstimateDays, expiryBasis, expiryConfidence.

Rules:
- Never invent factual ingredients, allergens, nutrition, manufacturer, dates, or instructions.
- Ingredient insights may explain only ingredients present in verified data.
- If storage instructions are not supplied, phrase general guidance as "Typical guidance".
- Printed expiry/best-before always overrides an estimate.
- shelfLifeEstimateDays is allowed only as a conservative unopened shelf-life estimate when product type,
  verified ingredients and packaging context provide enough support. Otherwise return null.
- Never estimate shelf life for medicine, infant formula, baby food, or an unidentified product.
- expiryConfidence must be 0 to 1 and must remain below 0.75 for an inferred shelf life.
- Do not make medical or guaranteed food-safety claims.`;

    const raw = await geminiService.generateStructuredJson<Record<string, unknown>>(prompt);
    const rawDays = Number(raw.shelfLifeEstimateDays);
    const forbiddenEstimate = /medicine|infant|baby/i.test(
      `${extracted.category || ""} ${extracted.productName || ""}`,
    );
    const shelfLifeEstimateDays = !forbiddenEstimate && Number.isInteger(rawDays) && rawDays > 0 && rawDays <= 3650
      ? rawDays
      : null;
    const sourceDate = extracted.manufacturingDate || extracted.packedDate;
    const estimatedExpiryDate = !extracted.expiryDate && sourceDate && shelfLifeEstimateDays
      ? addDays(sourceDate, shelfLifeEstimateDays)
      : null;
    const confidence = Number(raw.expiryConfidence);

    return {
      description: safeText(raw.description),
      subcategory: safeText(raw.subcategory, 120),
      productType: safeText(raw.productType, 120),
      ingredientInsights: safeList(raw.ingredientInsights),
      allergenSummary: safeText(raw.allergenSummary),
      nutritionSummary: safeText(raw.nutritionSummary),
      storageInstructions: safeText(raw.storageInstructions),
      afterOpeningInstructions: safeText(raw.afterOpeningInstructions),
      usageIdeas: safeList(raw.usageIdeas),
      shelfLifeEstimateDays,
      estimatedExpiryDate,
      expiryBasis: estimatedExpiryDate ? safeText(raw.expiryBasis) : null,
      expiryConfidence: estimatedExpiryDate && Number.isFinite(confidence)
        ? Math.min(0.75, Math.max(0, confidence)) : 0,
      safetyDisclaimer: estimatedExpiryDate
        ? "This is an AI-assisted estimate, not the manufacturer's expiry date. Check the package and product condition before use."
        : "Use the manufacturer's printed expiry and storage instructions whenever available.",
    };
  }
}

export const productEnrichmentService = new ProductEnrichmentService();
