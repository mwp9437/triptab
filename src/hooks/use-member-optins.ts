import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface OptInState {
  [blockId: string]: boolean; // true = opted in
}

export function useMemberOptIns(tripId: string | null | undefined) {
  const { user } = useAuth();
  const [optIns, setOptIns] = useState<OptInState>({});
  const [budgetCap, setBudgetCapState] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Load opt-ins and budget cap
  useEffect(() => {
    if (!tripId || !user) { setLoading(false); return; }

    (async () => {
      // Load opt-ins
      const { data: optInData } = await supabase
        .from("member_activity_optins")
        .select("block_id, opted_in")
        .eq("trip_id", tripId)
        .eq("user_id", user.id);

      const map: OptInState = {};
      (optInData as any[])?.forEach((r) => { map[r.block_id] = r.opted_in; });
      setOptIns(map);

      // Load budget cap from trip_collaborators
      const { data: collab } = await supabase
        .from("trip_collaborators")
        .select("budget_cap")
        .eq("trip_id", tripId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (collab) setBudgetCapState((collab as any).budget_cap);

      // Also check if user is owner — load from trips table directly
      const { data: trip } = await supabase
        .from("trips")
        .select("user_id")
        .eq("id", tripId)
        .single();

      // If owner, check if they have a collaborator entry for budget cap
      // Otherwise budget cap stays null (unlimited)
      setLoading(false);
    })();
  }, [tripId, user]);

  const toggleOptIn = useCallback(async (blockId: string) => {
    if (!tripId || !user) return;
    const currentlyIn = optIns[blockId] !== false; // default opted in
    const newValue = !currentlyIn;

    setOptIns((prev) => ({ ...prev, [blockId]: newValue }));

    await supabase.from("member_activity_optins").upsert({
      trip_id: tripId,
      user_id: user.id,
      block_id: blockId,
      opted_in: newValue,
    } as any, { onConflict: "trip_id,user_id,block_id" });
  }, [tripId, user, optIns]);

  const isOptedIn = useCallback((blockId: string): boolean => {
    return optIns[blockId] !== false; // default: opted in
  }, [optIns]);

  const setBudgetCap = useCallback(async (cap: number | null) => {
    if (!tripId || !user) return;
    setBudgetCapState(cap);

    // Upsert into trip_collaborators
    const { data: existing } = await supabase
      .from("trip_collaborators")
      .select("id")
      .eq("trip_id", tripId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      await supabase.from("trip_collaborators").update({ budget_cap: cap } as any).eq("id", (existing as any).id);
    }
    // If no collaborator entry (owner), we could store it differently
    // For now, owner can also create a self-entry or we store locally
  }, [tripId, user]);

  return { optIns, isOptedIn, toggleOptIn, budgetCap, setBudgetCap, loading };
}
