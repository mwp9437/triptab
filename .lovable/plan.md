

## Plan: Editable Prices, Auth, Itinerary Saving & Group Trips

### 1. Editable Prices (Frontend Only)
- In `Dashboard.tsx`, make cost displays clickable/editable inline — clicking the price on a block opens a small input field where users can type an exact dollar amount
- On blur/enter, update the block's cost in the plan state via a new `onUpdateBlockCost` callback passed from `PlanningWorkspace`
- Apply to both regular blocks and accommodation blocks

### 2. Authentication (Email/Password, Auto-Confirm)
**Database:**
- Create `profiles` table (id, user_id FK to auth.users, display_name, avatar_url, created_at) with RLS
- Configure auth to auto-confirm email signups
- Create trigger to auto-create profile on signup

**Frontend:**
- Create `src/pages/Auth.tsx` with login/signup tabs (email + password)
- Create `src/contexts/AuthContext.tsx` for session state via `onAuthStateChange`
- Add `/auth` route, protect `/` route — redirect unauthenticated users to `/auth`
- Add logout button to the Dashboard header
- Add a "Save Trip" button visible when logged in

### 3. Itinerary Saving
**Database:**
- Create `trips` table: id, user_id, title (destination), intake_data (jsonb), plan_data (jsonb), created_at, updated_at — with RLS (owner can CRUD)
- Create `trip_collaborators` table: id, trip_id FK, user_id FK, invited_email, role (owner/editor/viewer), accepted boolean, created_at — with RLS

**Frontend:**
- "Save Trip" button in Dashboard header persists the current plan + intake to the `trips` table
- Create `src/pages/MyTrips.tsx` — lists saved trips, click to load back into PlanningWorkspace
- Add `/my-trips` route

### 4. Group Trips (Add People to Itineraries)
**Frontend:**
- Add "Share / Invite" button on Dashboard header for saved trips
- Opens a modal where the user can enter email addresses to invite collaborators
- Inserts rows into `trip_collaborators` with `accepted: false`
- Invited users see the trip in their "My Trips" page once they sign up/log in with that email
- Collaborators with "editor" role can modify the itinerary; "viewer" can only view

### Technical Details

**Database migrations (single migration):**
```sql
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
CREATE POLICY "Owner can CRUD trips" ON public.trips FOR ALL TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.trip_collaborators tc WHERE tc.trip_id = id AND tc.user_id = auth.uid()))
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Collaborators can read trips" ON public.trips FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trip_collaborators tc WHERE tc.trip_id = id AND tc.user_id = auth.uid()));

-- Trip Collaborators
CREATE TYPE public.collaborator_role AS ENUM ('owner', 'editor', 'viewer');
CREATE TABLE public.trip_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  role collaborator_role NOT NULL DEFAULT 'viewer',
  accepted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (trip_id, invited_email)
);
ALTER TABLE public.trip_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trip owner can manage collaborators" ON public.trip_collaborators FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid()));
CREATE POLICY "Collaborators can read own entries" ON public.trip_collaborators FOR SELECT TO authenticated
  USING (user_id = auth.uid());
```

**New files:**
- `src/pages/Auth.tsx` — login/signup form
- `src/pages/MyTrips.tsx` — saved trips list
- `src/contexts/AuthContext.tsx` — auth state provider
- `src/components/InviteModal.tsx` — invite collaborators modal

**Modified files:**
- `src/App.tsx` — add AuthProvider, routes for `/auth`, `/my-trips`, protected routing
- `src/components/Dashboard.tsx` — inline editable prices, save button, invite button
- `src/components/planning/PlanningWorkspace.tsx` — pass save/update handlers, accept trip ID for loading saved trips
- `src/pages/Index.tsx` — handle loading saved trips

