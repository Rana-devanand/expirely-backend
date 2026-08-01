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
  mediaSizeBytes?: number;
  mediaMimeType?: string;
  mediaFileName?: string;
  replyToMessageId?: string;
  clientMessageId?: string;
}

export type CommunityAutoDeleteMode =
  | "one_hour"
  | "twenty_four_hours"
  | "custom";

export interface UpdateCommunityChatSettings {
  autoDeleteMode: CommunityAutoDeleteMode;
  customDuration?: number;
  customUnit?: "hours" | "days";
}
