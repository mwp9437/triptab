import { useState, useMemo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, MapPin, CalendarDays, Users, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TripIntake, TravelerType } from "@/types/intake";
import { createEmptyIntake } from "@/lib/parse-input";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import luxuryResort from "@/assets/luxury-resort.png";

const POPULAR_DESTINATIONS = [
  "Tokyo, Japan", "Kyoto, Japan", "Osaka, Japan", "Hokkaido, Japan",
  "Paris, France", "Nice, France", "Lyon, France",
  "Rome, Italy", "Florence, Italy", "Venice, Italy", "Amalfi Coast, Italy",
  "Barcelona, Spain", "Madrid, Spain", "Seville, Spain",
  "London, England", "Edinburgh, Scotland",
  "New York, USA", "Los Angeles, USA", "San Francisco, USA", "Miami, USA", "Hawaii, USA",
  "Chicago, USA", "Boston, USA", "Washington DC, USA", "Seattle, USA",
  "Bali, Indonesia", "Bangkok, Thailand",
  "Cancún, Mexico", "Mexico City, Mexico",
  "Sydney, Australia", "Melbourne, Australia",
  "Dubai, UAE", "Istanbul, Turkey", "Santorini, Greece", "Athens, Greece",
  "Lisbon, Portugal", "Amsterdam, Netherlands", "Berlin, Germany",
  "Seoul, South Korea", "Singapore", "Hong Kong",
];

interface QuickCreateWizardProps {
  onComplete: (intake: TripIntake) => void;
  onBack: () => void;
}

export default function QuickCreateWizard({ onComplete, onBack }: QuickCreateWizardProps) {
  const [tripName, setTripName] = useState("");
  const [destQuery, setDestQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [travelerType, setTravelerType] = useState<TravelerType>("couple");
  const [travelerCount, setTravelerCount] = useState(2);
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

  const parsedStart = startDate ? new Date(startDate + "T00:00:00") : undefined;
  const parsedEnd = endDate ? new Date(endDate + "T00:00:00") : undefined;
  const dateRange: DateRange | undefined = parsedStart ? { from: parsedStart, to: parsedEnd } : undefined;

  const handleRangeSelect = (range: DateRange | undefined) => {
    if (range?.from) {
      setStartDate(format(range.from, "yyyy-MM-dd"));
      setEndDate(range.to ? format(range.to, "yyyy-MM-dd") : "");
      if (range.from && range.to) setTimeout(() => setCalendarOpen(false), 300);
    } else {
      setStartDate("");
      setEndDate("");
    }
  };

  const dateLabel = parsedStart
    ? parsedEnd
      ? `${format(parsedStart, "MMM d")} – ${format(parsedEnd, "MMM d, yyyy")}`
      : `${format(parsedStart, "MMM d, yyyy")} – pick end date`
    : "Select trip dates";

  const handleSubmit = () => {
    const intake: TripIntake = {
      ...createEmptyIntake(),
      initialIdea: tripName || destQuery,
      destination: destQuery,
      startDate,
      endDate,
      travelerType,
      travelerCount,
      skipAiGeneration: true,
    };
    onComplete(intake);
  };

  const isValid = destQuery.trim() && startDate && endDate;

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src={luxuryResort} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/15 to-background/40" />
      </div>

      <header className="relative z-10 px-4 sm:px-6 py-4 sm:py-5 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-lg sm:text-xl font-display font-bold text-foreground">Set Up Group Trip</h1>
          <p className="text-[10px] sm:text-xs text-muted-foreground font-body">Quick create — no AI generation</p>
        </div>
      </header>

      <div className="relative z-10 flex-1 flex items-start justify-center px-3 sm:px-4 py-6">
        <motion.div
          className="glass-card rounded-2xl sm:rounded-3xl p-5 sm:p-8 w-full max-w-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground mb-1">Trip basics</h2>
              <p className="text-sm text-muted-foreground font-body">Just the essentials to get started.</p>
            </div>

            {/* Trip name */}
            <div>
              <label className="text-sm font-body font-medium text-foreground mb-1.5 block">Trip Name (optional)</label>
              <Input
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                placeholder="e.g., Spring Break 2026"
                className="rounded-xl border-border/50 bg-white/50 backdrop-blur-sm"
              />
            </div>

            {/* Destination autocomplete */}
            <div ref={wrapperRef} className="relative">
              <label className="text-sm font-body font-medium text-foreground mb-1.5 block">
                <MapPin className="w-4 h-4 inline mr-1.5" />Destination
              </label>
              <Input
                value={destQuery}
                onChange={(e) => { setDestQuery(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="e.g., Cancún, Mexico"
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
                      onClick={() => { setDestQuery(dest); setShowSuggestions(false); }}
                    >
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      {dest}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Date range */}
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
                      !parsedStart && "text-muted-foreground"
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

            {/* Traveler type + count */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-body font-medium text-foreground mb-1.5 block">
                  <Users className="w-4 h-4 inline mr-1.5" />Traveling as
                </label>
                <Select value={travelerType} onValueChange={(v) => {
                  const type = v as TravelerType;
                  const count = type === "solo" ? 1 : type === "couple" ? 2 : travelerCount;
                  setTravelerType(type);
                  setTravelerCount(count);
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
                    onClick={() => setTravelerCount(Math.max(1, travelerCount - 1))}
                  >-</Button>
                  <span className="text-sm font-semibold font-body w-8 text-center">{travelerCount}</span>
                  <Button
                    variant="outline" size="icon" className="rounded-xl h-10 w-10 border-border/50 bg-white/50 backdrop-blur-sm hover:bg-white/80"
                    onClick={() => setTravelerCount(travelerCount + 1)}
                  >+</Button>
                </div>
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!isValid}
              className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-6 h-11 shadow-lg shadow-primary/20 font-display font-semibold"
            >
              Create Trip <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
