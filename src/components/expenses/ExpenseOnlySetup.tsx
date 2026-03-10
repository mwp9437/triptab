import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CalendarDays, Users, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TripIntake, TravelerType } from "@/types/intake";
import { createEmptyIntake } from "@/lib/parse-input";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import luxuryResort from "@/assets/luxury-resort.png";

interface ExpenseOnlySetupProps {
  onComplete: (intake: TripIntake) => void;
  onBack: () => void;
}

export default function ExpenseOnlySetup({ onComplete, onBack }: ExpenseOnlySetupProps) {
  const [tripName, setTripName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [travelerCount, setTravelerCount] = useState(2);

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
    : "Select dates";

  const handleSubmit = () => {
    const intake: TripIntake = {
      ...createEmptyIntake(),
      initialIdea: tripName || "Expense Tracker",
      destination: tripName || "Expense Tracker",
      startDate,
      endDate,
      travelerCount,
      skipAiGeneration: true,
      expensesOnly: true,
    };
    onComplete(intake);
  };

  const isValid = tripName.trim() && startDate && endDate;

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src={luxuryResort} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background/80" />
      </div>

      <header className="relative z-10 px-4 sm:px-6 py-4 sm:py-5 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-lg sm:text-xl font-display font-bold text-foreground">Split Expenses</h1>
          <p className="text-[10px] sm:text-xs text-muted-foreground font-body">Track and settle group expenses</p>
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
              <h2 className="text-2xl font-display font-bold text-foreground mb-1">What are you splitting?</h2>
              <p className="text-sm text-muted-foreground font-body">Name your trip or event and add participants.</p>
            </div>

            {/* Trip/event name */}
            <div>
              <label className="text-sm font-body font-medium text-foreground mb-1.5 block">
                <DollarSign className="w-4 h-4 inline mr-1.5" />Trip or Event Name
              </label>
              <Input
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                placeholder="e.g., Ski Weekend, Dinner Group"
                className="rounded-xl border-border/50 bg-white/50 backdrop-blur-sm"
              />
            </div>

            {/* Date range */}
            <div>
              <label className="text-sm font-body font-medium text-foreground mb-1.5 block">
                <CalendarDays className="w-4 h-4 inline mr-1.5" />Dates
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
                    className="p-2 sm:p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Traveler count */}
            <div>
              <label className="text-sm font-body font-medium text-foreground mb-1.5 block">
                <Users className="w-4 h-4 inline mr-1.5" />How many people?
              </label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline" size="icon" className="rounded-xl h-10 w-10 border-border/50 bg-white/50 backdrop-blur-sm hover:bg-white/80"
                  onClick={() => setTravelerCount(Math.max(2, travelerCount - 1))}
                >-</Button>
                <span className="text-sm font-semibold font-body w-8 text-center">{travelerCount}</span>
                <Button
                  variant="outline" size="icon" className="rounded-xl h-10 w-10 border-border/50 bg-white/50 backdrop-blur-sm hover:bg-white/80"
                  onClick={() => setTravelerCount(travelerCount + 1)}
                >+</Button>
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!isValid}
              className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-6 h-11 shadow-lg shadow-primary/20 font-display font-semibold"
            >
              Start Tracking <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
