import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Expense, ExpenseParticipant, Traveler } from "@/types/expenses";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export function useExpenses(tripId: string | null | undefined) {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [travelers, setTravelers] = useState<Traveler[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTravelers = useCallback(async () => {
    if (!tripId) return;
    const { data } = await supabase
      .from("trip_travelers")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true });

    if (data) {
      setTravelers(
        data.map((t) => ({
          id: t.id,
          name: t.name,
          email: t.email ?? undefined,
          isCurrentUser: t.user_id === user?.id,
        }))
      );
    }
  }, [tripId, user?.id]);

  const fetchExpenses = useCallback(async () => {
    if (!tripId) return;
    const { data: expenseRows } = await supabase
      .from("expenses")
      .select("*")
      .eq("trip_id", tripId)
      .order("date", { ascending: true });

    if (!expenseRows) return;

    const expenseIds = expenseRows.map((e) => e.id);
    let participantRows: any[] = [];
    if (expenseIds.length > 0) {
      const { data } = await supabase
        .from("expense_participants")
        .select("*")
        .in("expense_id", expenseIds);
      participantRows = data || [];
    }

    const participantsByExpense: Record<string, ExpenseParticipant[]> = {};
    for (const p of participantRows) {
      if (!participantsByExpense[p.expense_id]) participantsByExpense[p.expense_id] = [];
      participantsByExpense[p.expense_id].push({
        travelerId: p.traveler_id,
        share: Number(p.share),
      });
    }

    setExpenses(
      expenseRows.map((e) => ({
        id: e.id,
        tripId: e.trip_id,
        blockId: e.block_id,
        description: e.description,
        amount: Number(e.amount),
        currency: e.currency,
        category: e.category as Expense["category"],
        date: e.date,
        paidBy: e.paid_by,
        participants: participantsByExpense[e.id] || [],
        splitMethod: e.split_method as Expense["splitMethod"],
        createdAt: e.created_at ?? new Date().toISOString(),
      }))
    );
  }, [tripId]);

  useEffect(() => {
    if (!tripId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([fetchTravelers(), fetchExpenses()]).finally(() => setLoading(false));
  }, [tripId, fetchTravelers, fetchExpenses]);

  const addExpense = useCallback(
    async (expense: Omit<Expense, "id" | "createdAt">) => {
      if (!tripId) return;
      const { data, error } = await supabase
        .from("expenses")
        .insert({
          trip_id: tripId,
          block_id: expense.blockId ?? null,
          description: expense.description,
          amount: expense.amount,
          currency: expense.currency,
          category: expense.category,
          date: expense.date,
          paid_by: expense.paidBy,
          split_method: expense.splitMethod,
        })
        .select()
        .single();

      if (error || !data) throw error;

      if (expense.participants.length > 0) {
        const { error: pError } = await supabase.from("expense_participants").insert(
          expense.participants.map((p) => ({
            expense_id: data.id,
            traveler_id: p.travelerId,
            share: p.share,
          }))
        );
        if (pError) throw pError;
      }

      await fetchExpenses();
    },
    [tripId, fetchExpenses]
  );

  const deleteExpense = useCallback(
    async (id: string) => {
      await supabase.from("expenses").delete().eq("id", id);
      await fetchExpenses();
    },
    [fetchExpenses]
  );

  const updateExpense = useCallback(
    async (id: string, updates: Partial<Omit<Expense, "id" | "tripId" | "createdAt">>) => {
      const dbUpdates: Record<string, any> = {};
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
      if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
      if (updates.category !== undefined) dbUpdates.category = updates.category;
      if (updates.date !== undefined) dbUpdates.date = updates.date;
      if (updates.paidBy !== undefined) dbUpdates.paid_by = updates.paidBy;
      if (updates.splitMethod !== undefined) dbUpdates.split_method = updates.splitMethod;
      if (updates.blockId !== undefined) dbUpdates.block_id = updates.blockId;
      dbUpdates.updated_at = new Date().toISOString();

      await supabase.from("expenses").update(dbUpdates).eq("id", id);

      if (updates.participants) {
        await supabase.from("expense_participants").delete().eq("expense_id", id);
        if (updates.participants.length > 0) {
          await supabase.from("expense_participants").insert(
            updates.participants.map((p) => ({
              expense_id: id,
              traveler_id: p.travelerId,
              share: p.share,
            }))
          );
        }
      }

      await fetchExpenses();
    },
    [fetchExpenses]
  );

  const addTraveler = useCallback(
    async (name: string, email?: string) => {
      if (!tripId) return;
      const { error } = await supabase.from("trip_travelers").insert({
        trip_id: tripId,
        name,
        email: email ?? null,
        user_id: email === user?.email ? user.id : null,
      });
      if (error) {
        toast({ title: "Failed to add traveler", description: error.message, variant: "destructive" });
        throw error;
      }
      await fetchTravelers();
    },
    [tripId, user, fetchTravelers]
  );

  const removeTraveler = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("trip_travelers").delete().eq("id", id);
      if (error) {
        toast({ title: "Failed to remove traveler", description: error.message, variant: "destructive" });
        throw error;
      }
      await fetchTravelers();
    },
    [fetchTravelers]
  );

  return { expenses, travelers, addExpense, deleteExpense, updateExpense, addTraveler, removeTraveler, loading };
}
