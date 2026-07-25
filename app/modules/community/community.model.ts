export interface CreateCommunityListing {
  title: string;
  description: string;
  category?: string;
  price: number;
  currency?: string;
  quantity?: number;
  condition?: "new" | "like_new" | "good" | "fair";
  location?: string;
  imageUrls: string[];
}

export interface SendCommunityMessage {
  body?: string;
  offerAmount?: number;
  mediaUrl?: string;
}
