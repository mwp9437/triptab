export type SplitMethod = "equal" | "custom_amount" | "custom_percent";

export interface ExpenseParticipant {
  travelerId: string;
  share: number;
}

export interface Expense {
  id: string;
  tripId: string;
  blockId?: string | null;
  description: string;
  amount: number;
  currency: string;
  category: "flights" | "accommodation" | "food" | "activities" | "transport" | "other";
  date: string;
  paidBy: string;
  participants: ExpenseParticipant[];
  splitMethod: SplitMethod;
  createdAt: string;
}

export interface Traveler {
  id: string;
  name: string;
  email?: string;
  isCurrentUser?: boolean;
}

export interface SettlementTransaction {
  from: string;
  to: string;
  amount: number;
}
