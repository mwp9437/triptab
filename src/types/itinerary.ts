export type BlockCategory = "transport" | "activity" | "meal" | "free" | "accommodation";

export interface TimeBlock {
  id: string;
  startTime: string;
  endTime: string;
  title: string;
  location?: string;
  cost?: number;
  category: BlockCategory;
  notes?: string;
}

export interface ItineraryDay {
  date: string;
  dayNumber: number;
  title: string;
  blocks: TimeBlock[];
}

export type ActionCategory = "flights" | "hotels" | "restaurants" | "tickets" | "packing";

export interface ActionItem {
  id: string;
  category: ActionCategory;
  text: string;
  completed: boolean;
  cost?: number;
}

export interface BudgetSummary {
  total: number;
  spent: number;
  categories: Record<string, number>;
}

export type PackingCategory = "clothing" | "gear" | "toiletries" | "electronics" | "documents" | "misc";

export interface PackingItem {
  id: string;
  category: PackingCategory;
  text: string;
  checked: boolean;
  reason?: string;
}

export interface LocalTip {
  id: string;
  emoji: string;
  title: string;
  detail: string;
}

export interface TripPlan {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  itinerary: ItineraryDay[];
  actionItems: ActionItem[];
  budget: BudgetSummary;
  packingList?: PackingItem[];
  localTips?: LocalTip[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}
