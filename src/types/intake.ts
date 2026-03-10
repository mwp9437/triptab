import { BlockCategory } from "./itinerary";

export type BudgetTier = 1 | 2 | 3 | 4;
export type TravelerType = "solo" | "couple" | "family" | "friends";
export type MobilityLevel = "none" | "limited" | "wheelchair";

export interface TripIntake {
  initialIdea: string;
  homeCity: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelerType: TravelerType;
  travelerCount: number;
  childAges: number[];
  budget: {
    accommodation: BudgetTier;
    meals: BudgetTier;
    activities: BudgetTier;
    transportation: BudgetTier;
    totalBudget?: number;
  };
  vibes: string[];
  dietary: string[];
  mobility: MobilityLevel;
  mustDos: string;
  avoids: string;
  skipAiGeneration?: boolean;
  expensesOnly?: boolean;
}

export interface ActivityOption {
  id: string;
  title: string;
  category: BlockCategory;
  description: string;
  rating?: number;
  priceTier: BudgetTier;
  estimatedCost: number;
  startTime: string;
  endTime: string;
  location: string;
  duration?: string;
  distance?: string;
}

export const DEFAULT_INTAKE: TripIntake = {
  initialIdea: "",
  homeCity: "",
  destination: "",
  startDate: "",
  endDate: "",
  travelerType: "couple",
  travelerCount: 2,
  childAges: [],
  budget: {
    accommodation: 2,
    meals: 2,
    activities: 2,
    transportation: 2,
  },
  vibes: [],
  dietary: [],
  mobility: "none",
  mustDos: "",
  avoids: "",
};

export const VIBE_OPTIONS = [
  "Relaxation", "Adventure", "Cultural", "Foodie", "Nightlife",
  "Romance", "Family-Friendly", "Off the Beaten Path", "Luxury", "Budget-Conscious",
];

export const DIETARY_OPTIONS = [
  "Vegetarian", "Vegan", "Gluten-free", "Halal", "Kosher", "No restrictions",
];

export const BUDGET_LABELS: Record<BudgetTier, Record<string, string>> = {
  1: { accommodation: "Hostel/budget", meals: "Street food/casual", activities: "Free/cheap", transportation: "Public transit" },
  2: { accommodation: "Mid-range", meals: "Sit-down casual", activities: "Moderate", transportation: "Rideshare" },
  3: { accommodation: "Boutique/4-star", meals: "Upscale", activities: "Premium", transportation: "Private car" },
  4: { accommodation: "Luxury/5-star", meals: "Fine dining", activities: "VIP/private", transportation: "Luxury/charter" },
};
