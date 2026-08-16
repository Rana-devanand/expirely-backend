export interface ProductFieldConfidence {
  productName: number;
  brand: number;
  manufacturingDate: number;
  expiryDate: number;
  quantity: number;
}

export interface ExtractedProductData {
  productName: string | null;
  brand: string | null;
  barcode: string | null;
  manufacturingDate: string | null;
  packedDate: string | null;
  expiryDate: string | null;
  bestBeforeText: string | null;
  quantity: string | null;
  category: string | null;
  confidence: ProductFieldConfidence;
  labelValidation: {
    isProductLabel: boolean;
    hasProductIdentity: boolean;
    hasManufacturingEvidence: boolean;
    hasExpiryEvidence: boolean;
    message: string | null;
  };
  verifiedData?: import("./product-lookup.service").VerifiedProductData | null;
  enrichment?: import("./product-enrichment.service").ProductEnrichment | null;
  sources?: Record<string, "label" | "barcode_database" | "ai_inference">;
}
