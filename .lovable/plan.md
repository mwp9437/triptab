

## Updated Plan: TripCraft — AI Travel Planning Dashboard

### Changes from Previous Plan
1. **Calendar integration**: Replace .ics upload with optional Gmail/Google Calendar connector integration. Users click "Connect Google Calendar" and we use the Google connector to read their existing events.
2. **Dashboard chat**: Instead of a "Back to Chat" navigation, the dashboard (Page 2) has a collapsible floating chat bubble in the bottom-right corner for refining the plan without leaving the dashboard.

### Architecture

**Page 1 — Chat Interface (full screen)**
- Welcome screen with friendly headline and two entry paths
- Full-screen chat powered by Lovable AI edge function
- AI asks clarifying questions: budget, dates, location, group size, vibe
- Brain dump support — paste messy text, AI parses it
- Optional "Connect Google Calendar" button — uses a Google connector to fetch existing events so AI knows busy times
- Once AI has enough context, generates structured itinerary and transitions to dashboard

**Page 2 — Dashboard (split screen)**
- Left: Day-by-day accordion itinerary with hour-by-hour color-coded timeline blocks (transport, activities, meals, free time). Each block shows time, name, location, cost.
- Right: Categorized action item checklists (Flights, Hotels, Restaurants, Tickets, Packing) with budget summary card
- Top bar: "Sync with Calendar" button generates .ics download
- **Bottom-right floating chat bubble**: Collapsed by default showing a chat icon. Click to expand a chat popover/drawer for refining the plan. AI responses update the dashboard in real-time.

**Edge Functions (Lovable Cloud)**
- `chat`: Streams AI responses via Lovable AI gateway with travel-agent system prompt
- `generate-itinerary`: Returns structured JSON itinerary via AI tool calling

**Design System**
- Vacation palette: soft ocean blues (`--primary`), warm sand tones (`--secondary`), coral accents for CTAs
- Clean, card-based layout with smooth transitions
- Floating chat uses a Sheet/Popover anchored bottom-right with subtle animation

**Google Calendar (Optional)**
- Check if Google connector is available; if so, offer "Connect Google Calendar" in the chat
- Edge function reads calendar events for the trip date range
- AI incorporates busy blocks into itinerary planning

**Calendar Export**
- Client-side .ics generation from itinerary data
- Download button in dashboard top bar

