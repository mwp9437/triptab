import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Plane, MapPin, CalendarDays, Users, DollarSign, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TripIntake, BudgetTier, TravelerType, VIBE_OPTIONS, DIETARY_OPTIONS, BUDGET_LABELS } from "@/types/intake";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import { useAuth } from "@/contexts/AuthContext";

const POPULAR_DESTINATIONS = [
  "Tokyo, Japan", "Kyoto, Japan", "Osaka, Japan", "Hokkaido, Japan",
  "Paris, France", "Nice, France", "Lyon, France",
  "Rome, Italy", "Florence, Italy", "Venice, Italy", "Amalfi Coast, Italy",
  "Barcelona, Spain", "Madrid, Spain", "Seville, Spain",
  "London, England", "Edinburgh, Scotland",
  "New York, USA", "Los Angeles, USA", "San Francisco, USA", "Miami, USA", "Hawaii, USA",
  "Chicago, USA", "Boston, USA", "Washington DC, USA", "Dallas, USA", "Seattle, USA",
  "Denver, USA", "Atlanta, USA", "Philadelphia, USA", "Houston, USA",
  "Bali, Indonesia", "Bangkok, Thailand", "Phuket, Thailand",
  "Cancún, Mexico", "Mexico City, Mexico",
  "Sydney, Australia", "Melbourne, Australia",
  "Dubai, UAE", "Istanbul, Turkey", "Santorini, Greece", "Athens, Greece",
  "Lisbon, Portugal", "Amsterdam, Netherlands", "Berlin, Germany", "Munich, Germany",
  "Marrakech, Morocco", "Cape Town, South Africa",
  "Rio de Janeiro, Brazil", "Buenos Aires, Argentina",
  "Reykjavik, Iceland", "Zurich, Switzerland",
  "Seoul, South Korea", "Singapore", "Hong Kong",
  "Maldives", "Fiji", "Tulum, Mexico",
  "Prague, Czech Republic", "Vienna, Austria", "Budapest, Hungary",
  "Copenhagen, Denmark", "Stockholm, Sweden",
];

import luxuryBedroom from "@/assets/luxury-bedroom.png";
import luxuryTerrace from "@/assets/luxury-terrace.png";
import luxuryResort from "@/assets/luxury-resort.png";

const STEP_BACKGROUNDS = [luxuryTerrace, luxuryResort];

interface WizardContainerProps {
  intake: TripIntake;
  onUpdate: (intake: TripIntake) => void;
  onComplete: (intake: TripIntake) => void;
  onBack: () => void;
}

const STEPS = ["Destination & Dates", "Preferences"];

export default function WizardContainer({ intake, onUpdate, onComplete, onBack }: WizardContainerProps) {
  const [step, setStep] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();

  const update = (partial: Partial<TripIntake>) => {
    onUpdate({ ...intake, ...partial });
  };

  const canProceed = () => true;

  const next = () => {
    if (step < 1) setStep(step + 1);
    else onComplete(intake);
  };

  const back = () => {
    if (step > 0) setStep(step - 1);
    else onBack();
  };

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Background image */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 z-0"
        >
          <img
            src={STEP_BACKGROUNDS[step]}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-sand/70 via-sand/50 to-sand/80" />
        </motion.div>
      </AnimatePresence>

      {/* Header */}
      <header className="relative z-10 px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl glass flex items-center justify-center">
            <Plane className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-display font-bold text-foreground">TripTab</h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground font-body tracking-luxury uppercase">AI Trip Manager</p>
          </div>
        </div>
        {!user && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full bg-foreground text-background hover:bg-foreground/80 border-0 text-xs sm:text-sm"
            onClick={() => navigate("/auth")}
          >
            <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
            Sign In
          </Button>
        )}
      </header>

      {/* Progress — gold line with diamond markers */}
      <div className="relative z-10 px-4 sm:px-6 py-2 sm:py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-0">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-2.5 h-2.5 sm:w-3 sm:h-3 rotate-45 transition-all duration-300",
                    i <= step ? "bg-primary shadow-lg shadow-primary/30" : "bg-foreground/15 border border-foreground/20"
                  )} />
                  <span className={cn(
                    "text-[9px] sm:text-[10px] font-body mt-1.5 sm:mt-2 whitespace-nowrap tracking-wide",
                    i <= step ? "text-foreground font-medium" : "text-muted-foreground"
                  )}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn(
                    "flex-1 h-[1px] mx-1.5 sm:mx-2",
                    i < step ? "bg-primary" : "bg-foreground/15"
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step Content — glass card */}
      <div className="relative z-10 flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6 flex items-start justify-center">
        <div className="w-full max-w-2xl">
          <motion.div
            className="glass-card rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {step === 0 && <StepDestination intake={intake} onUpdate={update} />}
                {step === 1 && <StepPreferences intake={intake} onUpdate={update} />}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-2xl mx-auto flex justify-between">
          <Button
            variant="ghost"
            onClick={back}
            className="gap-1.5 sm:gap-2 text-foreground hover:bg-foreground/10 hover:text-foreground text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <Button
            onClick={next}
            disabled={!canProceed()}
            className="gap-1.5 sm:gap-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-5 sm:px-6 shadow-lg shadow-primary/20 text-sm"
          >
            {step === 1 ? "Build My Trip" : "Next"} <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Step 1: Destination & Dates ─── */
function StepDestination({ intake, onUpdate }: { intake: TripIntake; onUpdate: (p: Partial<TripIntake>) => void }) {
  const [destQuery, setDestQuery] = useState(intake.destination);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filteredDestinations = useMemo(() => {
    if (!destQuery.trim()) return POPULAR_DESTINATIONS.slice(0, 8);
    const q = destQuery.toLowerCase();
    return POPULAR_DESTINATIONS.filter(d => d.toLowerCase().includes(q)).slice(0, 8);
  }, [destQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectDestination = (dest: string) => {
    setDestQuery(dest);
    onUpdate({ destination: dest });
    setShowSuggestions(false);
  };

  const startDate = intake.startDate ? new Date(intake.startDate + "T00:00:00") : undefined;
  const endDate = intake.endDate ? new Date(intake.endDate + "T00:00:00") : undefined;

  const dateRange: DateRange | undefined = startDate ? { from: startDate, to: endDate } : undefined;

  const handleRangeSelect = (range: DateRange | undefined) => {
    if (range?.from) {
      onUpdate({
        startDate: format(range.from, "yyyy-MM-dd"),
        endDate: range.to ? format(range.to, "yyyy-MM-dd") : "",
      });
      // Auto-close when both dates selected
      if (range.from && range.to) {
        setTimeout(() => setCalendarOpen(false), 300);
      }
    } else {
      onUpdate({ startDate: "", endDate: "" });
    }
  };

  const dateLabel = startDate
    ? endDate
      ? `${format(startDate, "MMM d")} – ${format(endDate, "MMM d, yyyy")}`
      : `${format(startDate, "MMM d, yyyy")} – pick end date`
    : "Select trip dates";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground mb-1">Where are you headed?</h2>
        <p className="text-sm text-muted-foreground font-body">Let's start with the basics.</p>
      </div>

      <div className="space-y-4">
        {/* Destination autocomplete */}
        <div ref={wrapperRef} className="relative">
          <label className="text-sm font-body font-medium text-foreground mb-1.5 block">
            <MapPin className="w-4 h-4 inline mr-1.5" />Destination
          </label>
          <Input
            value={destQuery}
            onChange={(e) => {
              setDestQuery(e.target.value);
              onUpdate({ destination: e.target.value });
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="e.g., Hokkaido, Japan — or leave blank and we'll suggest!"
            className="rounded-xl border-border/50 bg-white/50 backdrop-blur-sm focus:bg-white/80 transition-all"
            autoComplete="off"
          />
          {showSuggestions && filteredDestinations.length > 0 && (
            <div className="absolute z-50 top-full mt-1 w-full rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
              {filteredDestinations.map((dest) => (
                <button
                  key={dest}
                  className="w-full text-left px-3 py-2.5 text-sm font-body text-popover-foreground hover:bg-accent/50 transition-colors flex items-center gap-2"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectDestination(dest)}
                >
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  {dest}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date range picker — single calendar */}
        <div>
          <label className="text-sm font-body font-medium text-foreground mb-1.5 block">
            <CalendarDays className="w-4 h-4 inline mr-1.5" />Trip Dates
          </label>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left rounded-xl border-border/50 bg-white/50 backdrop-blur-sm hover:bg-white/80",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarDays className="w-4 h-4 mr-2 text-muted-foreground" />
                {dateLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={handleRangeSelect}
                numberOfMonths={typeof window !== "undefined" && window.innerWidth < 640 ? 1 : 2}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                className="p-2 sm:p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-body font-medium text-foreground mb-1.5 block">
              <Users className="w-4 h-4 inline mr-1.5" />Traveling as
            </label>
            <Select value={intake.travelerType} onValueChange={(v) => {
              const type = v as TravelerType;
              const count = type === "solo" ? 1 : type === "couple" ? 2 : intake.travelerCount;
              onUpdate({ travelerType: type, travelerCount: count });
            }}>
              <SelectTrigger className="rounded-xl border-border/50 bg-white/50 backdrop-blur-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="solo">Solo</SelectItem>
                <SelectItem value="couple">Couple</SelectItem>
                <SelectItem value="family">Family</SelectItem>
                <SelectItem value="friends">Friend Group</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-body font-medium text-foreground mb-1.5 block">Group Size</label>
            <div className="flex items-center gap-3">
              <Button
                variant="outline" size="icon" className="rounded-xl h-10 w-10 border-border/50 bg-white/50 backdrop-blur-sm hover:bg-white/80"
                onClick={() => onUpdate({ travelerCount: Math.max(1, intake.travelerCount - 1) })}
              >-</Button>
              <span className="text-lg font-semibold font-body w-8 text-center">{intake.travelerCount}</span>
              <Button
                variant="outline" size="icon" className="rounded-xl h-10 w-10 border-border/50 bg-white/50 backdrop-blur-sm hover:bg-white/80"
                onClick={() => onUpdate({ travelerCount: intake.travelerCount + 1 })}
              >+</Button>
            </div>
          </div>
        </div>

        {intake.travelerType === "family" && (
          <div>
            <label className="text-sm font-body font-medium text-foreground mb-1.5 block">Children's ages (comma-separated)</label>
            <Input
              value={intake.childAges.join(", ")}
              onChange={(e) => onUpdate({ childAges: e.target.value.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n)) })}
              placeholder="e.g., 5, 8, 12"
              className="rounded-xl border-border/50 bg-white/50 backdrop-blur-sm"
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Step 2: Preferences (with budget + suggestion bubbles) ─── */
function StepPreferences({ intake, onUpdate }: { intake: TripIntake; onUpdate: (p: Partial<TripIntake>) => void }) {
  const toggleVibe = (v: string) => {
    const vibes = intake.vibes.includes(v) ? intake.vibes.filter(x => x !== v) : [...intake.vibes, v];
    onUpdate({ vibes });
  };

  const toggleDietary = (d: string) => {
    const dietary = intake.dietary.includes(d) ? intake.dietary.filter(x => x !== d) : [...intake.dietary, d];
    onUpdate({ dietary });
  };

  const categories = ["accommodation", "meals", "activities", "transportation"] as const;
  const tierLabels = ["$", "$$", "$$$", "$$$$"];

  const setBudgetTier = (cat: string, tier: BudgetTier) => {
    onUpdate({ budget: { ...intake.budget, [cat]: tier } });
  };

  // Generate contextual suggestions based on destination/vibes
  const mustDoSuggestions = useMemo(() => {
    const dest = intake.destination.toLowerCase();
    const base: string[] = [];
    
    if (dest.includes("japan") || dest.includes("tokyo") || dest.includes("kyoto") || dest.includes("hokkaido")) {
      base.push("🏯 Visit a temple", "🍣 Try authentic sushi", "♨️ Onsen experience", "🌸 See cherry blossoms", "🎌 Explore a night market");
    } else if (dest.includes("italy") || dest.includes("rome") || dest.includes("florence") || dest.includes("venice")) {
      base.push("🍕 Authentic pizza", "🏛️ Visit the Colosseum", "🍷 Wine tasting", "🎨 Uffizi Gallery", "🛶 Gondola ride");
    } else if (dest.includes("paris") || dest.includes("france")) {
      base.push("🗼 Eiffel Tower", "🥐 Bakery tour", "🎨 Louvre Museum", "🍷 Wine & cheese evening", "🌸 Jardins du Luxembourg");
    } else if (dest.includes("beach") || dest.includes("bali") || dest.includes("maldives") || dest.includes("caribbean")) {
      base.push("🏖️ Beach day", "🤿 Snorkeling", "🌅 Sunset cruise", "💆 Spa treatment", "🍹 Beach bar hopping");
    } else if (dest.includes("new york") || dest.includes("nyc")) {
      base.push("🗽 Statue of Liberty", "🎭 Broadway show", "🌳 Central Park", "🍕 NYC pizza", "🌉 Brooklyn Bridge walk");
    } else {
      base.push("🏛️ Local landmarks", "🍽️ Try local cuisine", "🚶 Walking tour", "🛍️ Local markets", "📸 Scenic viewpoints");
    }

    if (intake.vibes.includes("Adventure")) base.push("🧗 Outdoor adventure");
    if (intake.vibes.includes("Foodie")) base.push("👨‍🍳 Cooking class");
    if (intake.vibes.includes("Cultural")) base.push("🎭 Cultural show");
    if (intake.vibes.includes("Nightlife")) base.push("🍸 Rooftop bar");
    if (intake.vibes.includes("Romance")) base.push("🌹 Romantic dinner");

    return [...new Set(base)].slice(0, 8);
  }, [intake.destination, intake.vibes]);

  const avoidSuggestions = useMemo(() => {
    const suggestions = [
      "🚫 Tourist traps", "🚌 Long bus rides", "👥 Crowded places",
      "🍔 Chain restaurants", "🏨 Generic hotels", "⏰ Early mornings",
      "🛍️ Shopping malls", "🎪 Overly touristy spots",
    ];
    return suggestions;
  }, []);

  const toggleMustDo = (suggestion: string) => {
    const clean = suggestion.replace(/^[^\w]*\s/, ""); // Remove emoji prefix
    const current = intake.mustDos;
    if (current.includes(clean)) {
      onUpdate({ mustDos: current.replace(clean, "").replace(/,\s*,/g, ",").replace(/^,\s*|,\s*$/g, "").trim() });
    } else {
      onUpdate({ mustDos: current ? `${current}, ${clean}` : clean });
    }
  };

  const toggleAvoid = (suggestion: string) => {
    const clean = suggestion.replace(/^[^\w]*\s/, "");
    const current = intake.avoids;
    if (current.includes(clean)) {
      onUpdate({ avoids: current.replace(clean, "").replace(/,\s*,/g, ",").replace(/^,\s*|,\s*$/g, "").trim() });
    } else {
      onUpdate({ avoids: current ? `${current}, ${clean}` : clean });
    }
  };

  const isMustDoSelected = (suggestion: string) => {
    const clean = suggestion.replace(/^[^\w]*\s/, "");
    return intake.mustDos.includes(clean);
  };

  const isAvoidSelected = (suggestion: string) => {
    const clean = suggestion.replace(/^[^\w]*\s/, "");
    return intake.avoids.includes(clean);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground mb-1">Preferences & Budget</h2>
        <p className="text-sm text-muted-foreground font-body">Tailor the experience to your style.</p>
      </div>

      {/* Trip Vibe */}
      <div>
        <label className="text-sm font-body font-semibold text-foreground mb-2 block">Trip Vibe</label>
        <div className="flex flex-wrap gap-2">
          {VIBE_OPTIONS.map((v) => (
            <button
              key={v}
              onClick={() => toggleVibe(v)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-body border transition-all",
                intake.vibes.includes(v)
                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                  : "bg-white/50 border-white/30 text-muted-foreground hover:border-primary/50 hover:bg-white/70 backdrop-blur-sm"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Dietary */}
      <div>
        <label className="text-sm font-body font-semibold text-foreground mb-2 block">Dietary Restrictions</label>
        <div className="flex flex-wrap gap-2">
          {DIETARY_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => toggleDietary(d)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-body border transition-all",
                intake.dietary.includes(d)
                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                  : "bg-white/50 border-white/30 text-muted-foreground hover:border-primary/50 hover:bg-white/70 backdrop-blur-sm"
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Must-Dos with suggestion bubbles */}
      <div>
        <label className="text-sm font-body font-semibold text-foreground mb-1.5 block">
          Must-do activities <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {mustDoSuggestions.map((s) => (
            <button
              key={s}
              onClick={() => toggleMustDo(s)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-body border transition-all",
                isMustDoSelected(s)
                  ? "bg-primary/15 text-primary border-primary/40"
                  : "bg-white/40 border-white/30 text-muted-foreground hover:border-primary/30 hover:bg-white/60 backdrop-blur-sm"
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <Textarea
          value={intake.mustDos}
          onChange={(e) => onUpdate({ mustDos: e.target.value })}
          placeholder="Or type your own..."
          className="rounded-xl resize-none border-border/50 bg-white/50 backdrop-blur-sm text-sm"
          rows={2}
        />
      </div>

      {/* Avoids with suggestion bubbles */}
      <div>
        <label className="text-sm font-body font-semibold text-foreground mb-1.5 block">
          Things to avoid <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {avoidSuggestions.map((s) => (
            <button
              key={s}
              onClick={() => toggleAvoid(s)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-body border transition-all",
                isAvoidSelected(s)
                  ? "bg-destructive/15 text-destructive border-destructive/40"
                  : "bg-white/40 border-white/30 text-muted-foreground hover:border-destructive/30 hover:bg-white/60 backdrop-blur-sm"
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <Textarea
          value={intake.avoids}
          onChange={(e) => onUpdate({ avoids: e.target.value })}
          placeholder="Or type your own..."
          className="rounded-xl resize-none border-border/50 bg-white/50 backdrop-blur-sm text-sm"
          rows={2}
        />
      </div>

      {/* Compact Budget Section */}
      <div className="rounded-2xl bg-white/40 backdrop-blur-sm border border-white/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-body font-semibold text-foreground flex items-center gap-1.5">
            <DollarSign className="w-4 h-4" /> Budget
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-body">Per person cap:</span>
            <Input
              type="number"
              value={intake.budget.totalBudget || ""}
              onChange={(e) => onUpdate({ budget: { ...intake.budget, totalBudget: e.target.value ? Number(e.target.value) : undefined } })}
              placeholder="Optional"
              className="rounded-lg w-24 h-8 text-xs border-border/50 bg-white/50 backdrop-blur-sm"
              min={0}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {categories.map((cat) => (
            <div key={cat}>
              <span className="text-xs font-body font-medium text-foreground capitalize mb-1.5 block">{cat}</span>
              <div className="grid grid-cols-4 gap-1">
                {([1, 2, 3, 4] as BudgetTier[]).map((tier) => {
                  const isSelected = intake.budget[cat] === tier;
                  return (
                    <button
                      key={tier}
                      onClick={() => setBudgetTier(cat, tier)}
                      className={cn(
                        "rounded-lg py-1.5 text-center transition-all border font-body text-xs",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-white/50 border-white/30 text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      {tierLabels[tier - 1]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
