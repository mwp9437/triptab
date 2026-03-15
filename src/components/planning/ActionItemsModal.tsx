import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ClipboardList, Plane, Hotel, UtensilsCrossed, Ticket, Backpack } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { ActionItem, ActionCategory } from "@/types/itinerary";
import { useIsMobile } from "@/hooks/use-mobile";

const ACTION_ICONS: Record<ActionCategory, typeof Plane> = {
  flights: Plane,
  hotels: Hotel,
  restaurants: UtensilsCrossed,
  tickets: Ticket,
  packing: Backpack,
};

interface ActionItemsModalProps {
  items: ActionItem[];
  onToggle: (id: string) => void;
}

export default function ActionItemsModal({ items, onToggle }: ActionItemsModalProps) {
  const isMobile = useIsMobile();
  const completedCount = items.filter((i) => i.completed).length;
  const totalCount = items.length;

  const grouped = items.reduce<Record<string, ActionItem[]>>((acc, item) => {
    (acc[item.category] ||= []).push(item);
    return acc;
  }, {});

  const fabButton = (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="w-12 h-12 rounded-full bg-primary/90 backdrop-blur-sm text-primary-foreground shadow-lg shadow-primary/20 flex items-center justify-center hover:shadow-xl transition-all border border-primary/30 relative"
    >
      <ClipboardList className="w-5 h-5" />
      {totalCount > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center">
          {completedCount}/{totalCount}
        </span>
      )}
    </motion.button>
  );

  const listContent = (
    <div className="mt-6 space-y-5 overflow-y-auto">
      {Object.entries(grouped).map(([category, categoryItems]) => {
        const Icon = ACTION_ICONS[category as ActionCategory] || Ticket;
        return (
          <div key={category}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4 text-muted-foreground" />
              <span className="text-[10px] font-semibold uppercase tracking-luxury text-muted-foreground font-body">
                {category}
              </span>
            </div>
            <div className="space-y-2 ml-6">
              {categoryItems.map((item) => (
                <label key={item.id} className="flex items-start gap-2 cursor-pointer group min-h-[44px] py-1">
                  <Checkbox
                    checked={item.completed}
                    onCheckedChange={() => onToggle(item.id)}
                    className="mt-0.5"
                  />
                  <span className={`text-sm font-body leading-tight ${
                    item.completed ? "line-through text-muted-foreground" : "text-foreground"
                  }`}>
                    {item.text}
                    {item.cost != null && item.cost > 0 && (
                      <span className="text-xs text-muted-foreground ml-1">(~${item.cost})</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
      {totalCount === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8 font-body">
          No action items yet. They'll appear as your itinerary takes shape.
        </p>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <div className="fixed bottom-24 right-6 z-50 flex flex-col items-center gap-1">
        <Drawer>
          <DrawerTrigger asChild>{fabButton}</DrawerTrigger>
          <DrawerContent className="max-h-[85vh] bg-white/90 backdrop-blur-2xl">
            <DrawerHeader>
              <DrawerTitle className="font-display flex items-center gap-2">
                <Check className="w-5 h-5 text-primary" />
                Action Items
                <span className="text-sm font-body text-muted-foreground font-normal ml-auto">
                  {completedCount}/{totalCount}
                </span>
              </DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-6">
              {listContent}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  return (
    <div className="fixed bottom-24 right-6 z-50 flex flex-col items-center gap-1">
      <Sheet>
        <SheetTrigger asChild>{fabButton}</SheetTrigger>
        <span className="hidden sm:block text-[10px] font-body font-medium text-muted-foreground">Tasks</span>
        <SheetContent className="w-[400px] sm:w-[440px] bg-white/90 backdrop-blur-2xl border-l-white/20">
          <SheetHeader>
            <SheetTitle className="font-display flex items-center gap-2">
              <Check className="w-5 h-5 text-primary" />
              Action Items
              <span className="text-sm font-body text-muted-foreground font-normal ml-auto">
                {completedCount}/{totalCount}
              </span>
            </SheetTitle>
          </SheetHeader>
          {listContent}
        </SheetContent>
      </Sheet>
    </div>
  );
}
