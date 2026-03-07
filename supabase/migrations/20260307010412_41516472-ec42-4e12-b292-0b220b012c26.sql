
-- Budget cap on collaborators
ALTER TABLE public.trip_collaborators ADD COLUMN budget_cap numeric DEFAULT NULL;

-- Member activity opt-ins (default: opted in to everything)
CREATE TABLE public.member_activity_optins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  block_id text NOT NULL,
  opted_in boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (trip_id, user_id, block_id)
);
ALTER TABLE public.member_activity_optins ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own opt-ins
CREATE POLICY "Users manage own optins" ON public.member_activity_optins FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Trip owner can read all opt-ins for their trips (visibility expansion later if needed)
CREATE POLICY "Owner reads optins" ON public.member_activity_optins FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid()));
