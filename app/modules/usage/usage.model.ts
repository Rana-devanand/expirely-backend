export interface IProductUsageEvent {
  id: string;
  user_id: string;
  product_id: string;
  type: "USED_FULLY" | "USED_PARTIALLY" | "WASTED";
  quantity: number;
  note?: string;
  created_at: Date | string;
}

export interface ICreateUsageEvent {
  type: "USED_FULLY" | "USED_PARTIALLY" | "WASTED";
  quantity?: number;
  note?: string;
}

export interface IUsageSummary {
  consumedCount: number;
  wastedCount: number;
  totalCount: number;
  wasteRate: number; // percentage of wasted / total consumed + wasted
  outcomeBreakdown: {
    USED_FULLY: number;
    USED_PARTIALLY: number;
    WASTED: number;
  };
  wastedByCategory: Array<{
    category: string;
    count: number;
  }>;
}
