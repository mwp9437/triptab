
-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Auto-create profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Collaborator role enum
CREATE TYPE public.collaborator_role AS ENUM ('owner', 'editor', 'viewer');

-- Trip Collaborators (create first so trips policies can reference it)
CREATE TABLE public.trip_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  role collaborator_role NOT NULL DEFAULT 'viewer',
  accepted boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Trips
CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  intake_data jsonb,
  plan_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner full access" ON public.trips FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Collaborators can read" ON public.trips FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trip_collaborators tc WHERE tc.trip_id = id AND tc.user_id = auth.uid() AND tc.accepted = true));

-- Now add FK and policies for collaborators
ALTER TABLE public.trip_collaborators ADD CONSTRAINT trip_collaborators_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;
ALTER TABLE public.trip_collaborators ADD CONSTRAINT trip_collaborators_unique UNIQUE (trip_id, invited_email);
ALTER TABLE public.trip_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trip owner manages collaborators" ON public.trip_collaborators FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid()));
CREATE POLICY "Collaborators read own" ON public.trip_collaborators FOR SELECT TO authenticated
  USING (user_id = auth.uid());
