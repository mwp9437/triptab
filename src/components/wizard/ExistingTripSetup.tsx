import { useState, useMemo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, MapPin, CalendarDays, Users, Plus, X, Plane, Car, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TripIntake } from "@/types/intake";
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
  "Chicago, USA", "Boston, USA", "Washington DC, USA", "Dallas, USA", "Seattle, USA",
  "Denver, USA", "Atlanta, USA", "Philadelphia, USA", "Houston, USA",
  "Bali, Indonesia", "Bangkok, Thailand", "Phuket, Thailand",
  "Cancún, Mexico", "Mexico City, Mexico",
  "Sydney, Australia", "Melbourne, Australia",
  "Dubai, UAE", "Istanbul, Turkey", "Santorini, Greece", "Athens, Greece",
  "Lisbon, Portugal", "Amsterdam, Netherlands", "Berlin, Germany", "Munich, Germany",
  "Seoul, South Korea", "Singapore", "Hong Kong",
];

interface ExistingTripSetupProps {
  onComplete: (intake: TripIntake) => void;
  onBack: () => void;
}

export default function ExistingTripSetup({ onComplete, onBack }: ExistingTripSetupProps) {
  // Trip basics
  const [destinations, setDestinations] = useState<string[]>([""]);
  const [destQueries, setDestQueries] = useState<string[]>([""]);
  const [showSuggestions, setShowSuggestions] = useState<number | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [travelerCount, setTravelerCount] = useState(2);

  // Transportation
  const [needsFlights, setNeedsFlights] = useState(false);
  const [homeCity, setHomeCity] = useState("");
  const [homeCityQuery, setHomeCityQuery] = useState("");
  const [showHomeSuggestions, setShowHomeSuggestions] = useState(false);
  const [departureTime, setDepartureTime] = useState<"morning" | "afternoon" | "evening" | "no_preference">("no_preference");
  const [returnTime, setReturnTime] = useState<"morning" | "afternoon" | "evening" | "no_preference">("no_preference");
  const [maxConnections, setMaxConnections] = useState<0 | 1 | 2>(1);
  const [preferredAirline, setPreferredAirline] = useState("");
  const [needsCarRental, setNeedsCarRental] = useState(false);
  const homeWrapperRef = useRef<HTMLDivElement>(null);

  // What's already booked
  const [accommodationName, setAccommodationName] = useState("");
  const [accommodationAddress, setAccommodationAddress] = useState("");
  const [plannedActivities, setPlannedActivities] = useState("");
  const [additionalDetails, setAdditionalDetails] = useState("");

  const wrapperRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showSuggestions !== null) {
        const ref = wrapperRefs.current[showSuggestions];
        if (ref && !ref.contains(e.target as Node)) {
          setShowSuggestions(null);
        }
      }
      if (showHomeSuggestions && homeWrapperRef.current && !homeWrapperRef.current.contains(e.target as Node)) {
        setShowHomeSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSuggestions, showHomeSuggestions]);

  const getFiltered = (query: string) => {
    if (!query.trim()) return POPULAR_DESTINATIONS.slice(0, 8);
    const q = query.toLowerCase();
    return POPULAR_DESTINATIONS.filter(d => d.toLowerCase().includes(q)).slice(0, 8);
  };

  const updateDestination = (idx: number, value: string) => {
    const next = [...destQueries];
    next[idx] = value;
    setDestQueries(next);
    const d = [...destinations];
    d[idx] = value;
    setDestinations(d);
  };

  const pickDestination = (idx: number, value: string) => {
    updateDestination(idx, value);
    setShowSuggestions(null);
  };

  const addDestination = () => {
    if (destinations.length >= 5) return;
    setDestinations([...destinations, ""]);
    setDestQueries([...destQueries, ""]);
  };

  const removeDestination = (idx: number) => {
    if (destinations.length <= 1) return;
    setDestinations(destinations.filter((_, i) => i !== idx));
    setDestQueries(destQueries.filter((_, i) => i !== idx));
  };

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
    const validDests = destinations.filter(d => d.trim());
    const preExisting = [
      accommodationName && `Accommodation: ${accommodationName}${accommodationAddress ? ` at ${accommodationAddress}` : ""}`,
      plannedActivities && `Already planned: ${plannedActivities}`,
      additionalDetails && `Additional context: ${additionalDetails}`,
    ].filter(Boolean).join("\n");

    const intake: TripIntake = {
      ...createEmptyIntake(),
      initialIdea: validDests.join(", "),
      destination: validDests[0] || "",
      destinations: validDests.length > 1 ? validDests : undefined,
      homeCity: needsFlights ? homeCity : "",
      startDate,
      endDate,
      travelerCount,
      preExistingDetails: preExisting || undefined,
      needsFlights,
      flightPreferences: needsFlights ? { departureTime, returnTime, maxConnections, preferredAirline: preferredAirline || undefined } : undefined,
      needsCarRental,
    };
    onComplete(intake);
  };

  const isValid = destinations.some(d => d.trim()) && startDate && endDate;

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
          <h1 className="text-lg sm:text-xl font-display font-bold text-foreground">Set Up My Trip</h1>
          <p className="text-[10px] sm:text-xs text-muted-foreground font-body">AI fills in the gaps around your plans</p>
        </div>
      </header>

      <div className="relative z-10 flex-1 flex items-start justify-center px-3 sm:px-4 py-4 overflow-y-auto">
        <motion.div
          className="glass-card rounded-2xl sm:rounded-3xl p-5 sm:p-8 w-full max-w-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="space-y-5">
            {/* Section: Trip Basics */}
            <div>
              <h2 className="text-xl font-display font-bold text-foreground mb-1">Trip Basics</h2>
              <p className="text-sm text-muted-foreground font-body">Where are you going?</p>
            </div>

            {/* Multi-city destinations */}
            <div className="space-y-2">
              <label className="text-sm font-body font-medium text-foreground block">
                <MapPin className="w-4 h-4 inline mr-1.5" />Destination{destinations.length > 1 ? "s" : ""}
              </label>
              {destinations.map((_, idx) => (
                <div key={idx} ref={(el) => { wrapperRefs.current[idx] = el; }} className="relative">
                  <div className="flex gap-2">
                    <Input
                      value={destQueries[idx] || ""}
                      onChange={(e) => { updateDestination(idx, e.target.value); setShowSuggestions(idx); }}
                      onFocus={() => setShowSuggestions(idx)}
                      placeholder={idx === 0 ? "e.g., Tokyo, Japan" : "Add another city"}
                      className="rounded-xl border-border/50 bg-white/50 backdrop-blur-sm focus:bg-white/80 transition-all"
                      autoComplete="off"
                    />
                    {destinations.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => removeDestination(idx)}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  {showSuggestions === idx && getFiltered(destQueries[idx] || "").length > 0 && (
                    <div className="absolute z-50 top-full mt-1 w-full rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
                      {getFiltered(destQueries[idx] || "").map((dest) => (
                        <button
                          key={dest}
                          className="w-full text-left px-3 py-2.5 text-sm font-body text-popover-foreground hover:bg-accent/50 transition-colors flex items-center gap-2"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickDestination(idx, dest)}
                        >
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          {dest}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {destinations.length < 5 && (
                <button
                  onClick={addDestination}
                  className="text-xs text-primary hover:text-primary/80 font-body flex items-center gap-1 ml-1"
                >
                  <Plus className="w-3 h-3" /> Add another city
                </button>
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

            {/* Traveler count */}
            <div>
              <label className="text-sm font-body font-medium text-foreground mb-1.5 block">
                <Users className="w-4 h-4 inline mr-1.5" />How many travelers?
              </label>
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

            {/* Section: Transportation */}
            <div className="pt-2 border-t border-border/30">
              <h2 className="text-lg font-display font-bold text-foreground mb-1">Transportation</h2>
              <p className="text-xs text-muted-foreground font-body mb-3">Skip if you've already booked or are driving</p>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox checked={needsFlights} onCheckedChange={(v) => setNeedsFlights(!!v)} />
                <span className="text-sm font-body font-medium text-foreground flex items-center gap-1.5">
                  <Plane className="w-4 h-4" /> I need help with flights
                </span>
              </label>

              {needsFlights && (
                <div className="ml-7 space-y-3 pl-1 border-l-2 border-primary/20">
                  <div ref={homeWrapperRef} className="relative">
                    <label className="text-xs font-body font-medium text-muted-foreground mb-1 block">Departing from</label>
                    <Input
                      value={homeCityQuery}
                      onChange={(e) => { setHomeCityQuery(e.target.value); setHomeCity(e.target.value); setShowHomeSuggestions(true); }}
                      onFocus={() => setShowHomeSuggestions(true)}
                      placeholder="Your home city"
                      className="rounded-xl border-border/50 bg-white/50 backdrop-blur-sm focus:bg-white/80 transition-all"
                      autoComplete="off"
                    />
                    {showHomeSuggestions && getFiltered(homeCityQuery).length > 0 && (
                      <div className="absolute z-50 top-full mt-1 w-full rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
                        {getFiltered(homeCityQuery).map((city) => (
                          <button
                            key={city}
                            className="w-full text-left px-3 py-2.5 text-sm font-body text-popover-foreground hover:bg-accent/50 transition-colors flex items-center gap-2"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { setHomeCityQuery(city); setHomeCity(city); setShowHomeSuggestions(false); }}
                          >
                            <Plane className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            {city}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-body font-medium text-muted-foreground mb-1 block">Departure time</label>
                      <Select value={departureTime} onValueChange={(v) => setDepartureTime(v as any)}>
                        <SelectTrigger className="rounded-xl border-border/50 bg-white/50 backdrop-blur-sm h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no_preference">No preference</SelectItem>
                          <SelectItem value="morning">Morning</SelectItem>
                          <SelectItem value="afternoon">Afternoon</SelectItem>
                          <SelectItem value="evening">Evening</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-body font-medium text-muted-foreground mb-1 block">Return time</label>
                      <Select value={returnTime} onValueChange={(v) => setReturnTime(v as any)}>
                        <SelectTrigger className="rounded-xl border-border/50 bg-white/50 backdrop-blur-sm h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no_preference">No preference</SelectItem>
                          <SelectItem value="morning">Morning</SelectItem>
                          <SelectItem value="afternoon">Afternoon</SelectItem>
                          <SelectItem value="evening">Evening</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-body font-medium text-muted-foreground mb-1 block">Max connections</label>
                      <Select value={String(maxConnections)} onValueChange={(v) => setMaxConnections(Number(v) as 0 | 1 | 2)}>
                        <SelectTrigger className="rounded-xl border-border/50 bg-white/50 backdrop-blur-sm h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Nonstop only</SelectItem>
                          <SelectItem value="1">1 stop</SelectItem>
                          <SelectItem value="2">2+ stops OK</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-body font-medium text-muted-foreground mb-1 block">Preferred airline</label>
                      <Input
                        value={preferredAirline}
                        onChange={(e) => setPreferredAirline(e.target.value)}
                        placeholder="Optional"
                        className="rounded-xl border-border/50 bg-white/50 backdrop-blur-sm h-9 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox checked={needsCarRental} onCheckedChange={(v) => setNeedsCarRental(!!v)} />
                <span className="text-sm font-body font-medium text-foreground flex items-center gap-1.5">
                  <Car className="w-4 h-4" /> I need a rental car
                </span>
              </label>
            </div>

            {/* Section: What's already booked */}
            <div className="pt-2 border-t border-border/30">
              <h2 className="text-lg font-display font-bold text-foreground mb-1">What's already booked?</h2>
              <p className="text-xs text-muted-foreground font-body mb-3">All optional — AI will fill in the rest</p>
            </div>

            <div>
              <label className="text-sm font-body font-medium text-foreground mb-1.5 block">Accommodation</label>
              <Input
                value={accommodationName}
                onChange={(e) => setAccommodationName(e.target.value)}
                placeholder='e.g., "Airbnb in Shibuya" or "Hilton Downtown"'
                className="rounded-xl border-border/50 bg-white/50 backdrop-blur-sm mb-2"
              />
              <Input
                value={accommodationAddress}
                onChange={(e) => setAccommodationAddress(e.target.value)}
                placeholder="Address (optional)"
                className="rounded-xl border-border/50 bg-white/50 backdrop-blur-sm"
              />
            </div>

            <div>
              <label className="text-sm font-body font-medium text-foreground mb-1.5 block">Activities already planned</label>
              <Textarea
                value={plannedActivities}
                onChange={(e) => setPlannedActivities(e.target.value)}
                placeholder='e.g., "Ski passes for Tues-Thurs, dinner reservation Friday at 8pm at Nobu"'
                className="rounded-xl border-border/50 bg-white/50 backdrop-blur-sm min-h-[70px] resize-none"
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-body font-medium text-foreground mb-1.5 block">Anything else AI should know?</label>
              <Textarea
                value={additionalDetails}
                onChange={(e) => setAdditionalDetails(e.target.value)}
                placeholder='e.g., "Bachelor party, we like craft beer and outdoor activities, one person is vegetarian"'
                className="rounded-xl border-border/50 bg-white/50 backdrop-blur-sm min-h-[70px] resize-none"
                rows={3}
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!isValid}
              className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-6 h-11 shadow-lg shadow-primary/20 font-display font-semibold"
            >
              Set Up My Trip <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
