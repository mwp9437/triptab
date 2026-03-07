
-- Travelers for a trip
CREATE TABLE public.trip_travelers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  email text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.trip_travelers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip owner manages travelers" ON public.trip_travelers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid()));

CREATE POLICY "Collaborators read travelers" ON public.trip_travelers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trip_collaborators tc WHERE tc.trip_id = trip_travelers.trip_id AND tc.user_id = auth.uid() AND tc.accepted = true));

-- Expenses
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  block_id text,
  description text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD',
  category text NOT NULL CHECK (category IN ('flights', 'accommodation', 'food', 'activities', 'transport', 'other')),
  date date NOT NULL,
  paid_by uuid REFERENCES public.trip_travelers(id) ON DELETE CASCADE NOT NULL,
  split_method text NOT NULL DEFAULT 'equal' CHECK (split_method IN ('equal', 'custom_amount', 'custom_percent')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip owner manages expenses" ON public.expenses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid()));

CREATE POLICY "Collaborators manage expenses" ON public.expenses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trip_collaborators tc WHERE tc.trip_id = expenses.trip_id AND tc.user_id = auth.uid() AND tc.accepted = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trip_collaborators tc WHERE tc.trip_id = expenses.trip_id AND tc.user_id = auth.uid() AND tc.accepted = true));

-- Expense participants
CREATE TABLE public.expense_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid REFERENCES public.expenses(id) ON DELETE CASCADE NOT NULL,
  traveler_id uuid REFERENCES public.trip_travelers(id) ON DELETE CASCADE NOT NULL,
  share numeric NOT NULL CHECK (share >= 0),
  UNIQUE (expense_id, traveler_id)
);

ALTER TABLE public.expense_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows expense access" ON public.expense_participants FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.expenses e JOIN public.trips t ON t.id = e.trip_id WHERE e.id = expense_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.expenses e JOIN public.trips t ON t.id = e.trip_id WHERE e.id = expense_id AND t.user_id = auth.uid()));

CREATE POLICY "Collaborators follow expense access" ON public.expense_participants FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.expenses e JOIN public.trip_collaborators tc ON tc.trip_id = e.trip_id WHERE e.id = expense_id AND tc.user_id = auth.uid() AND tc.accepted = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.expenses e JOIN public.trip_collaborators tc ON tc.trip_id = e.trip_id WHERE e.id = expense_id AND tc.user_id = auth.uid() AND tc.accepted = true));
