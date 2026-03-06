

## Luxury Facelift — Implementation Plan

### Design Direction
Mediterranean luxury resort aesthetic inspired by the uploaded references: white/ivory base, warm stone tones, indigo/navy accents, gold details, and frosted glassmorphism over destination photography. Clean editorial feel with generous whitespace.

### 1. Color & Style System (`src/index.css`, `tailwind.config.ts`)
- Shift palette: ivory `#FAFAF7` background, charcoal `#1a1a2e` foreground, muted gold `#c9a96e` primary, indigo `#3d4f7c` ocean, warm stone `#d4c5b2` sand
- Add glassmorphism utility: `.glass { backdrop-blur-xl bg-white/60 border border-white/20 shadow-xl }`
- Add `.glass-dark` variant for darker panels
- Increase letter-spacing on uppercase labels for editorial feel
- Refine border-radius to `1rem` default

### 2. Background Images (`src/assets/`)
- Copy the 2 uploaded luxury photos into `src/assets/` as `luxury-bedroom.png` and `luxury-terrace.png`
- Use as full-bleed backgrounds on the wizard and loading screens
- Images sit behind frosted glass content cards

### 3. Wizard (`WizardContainer.tsx`) — ~200 lines changed
- Full-screen luxury photo background (alternates per step)
- Center content in frosted glass card: `backdrop-blur-xl bg-white/70 rounded-3xl shadow-2xl border border-white/20`
- Header becomes minimal floating logo text over the image (white/gold)
- Progress bar: thin gold line with small diamond/circle markers instead of numbered circles
- Inputs get refined styling: thinner borders, more padding, subtle focus glow
- Budget tier cards: thin gold border on selection, soft shadows
- Vibe/dietary chips: pill-shaped with soft glass background

### 4. Loading Screen (`PlanningWorkspace.tsx`) — ~30 lines
- Full-screen photo background with centered glass card
- Gold-tinted spinner, Playfair italic heading: "Curating your experience..."

### 5. Dashboard (`Dashboard.tsx`) — ~80 lines changed
- Top bar: glassmorphism with subtle blur (`bg-white/80 backdrop-blur-lg`)
- Sidebar cards: frosted glass styling, rounded-2xl, soft shadows, gold accent icons
- Activity blocks: subtle gradient backgrounds, refined left accent borders with muted luxury colors
- Day headers: larger day number in Playfair, date in small caps tracking-wider

### 6. Block Detail Modal (`BlockDetailModal.tsx`) — ~30 lines
- Modal background: `bg-white/90 backdrop-blur-2xl rounded-3xl`
- Category label in gold small caps
- Alternative cards: refined hover with lift + shadow
- Subtle gold divider lines between sections

### 7. Chat Panel (`ChatPanel.tsx`) — ~40 lines
- Glass panel background
- User messages in warm gold-tinted bubbles, assistant in frosted white
- Input area with refined border and inner shadow
- Prompt suggestions styled as glass pills

### 8. Floating Chat (`FloatingChat.tsx`) — ~15 lines
- Button becomes gold-accented glass circle
- Chat window gets glass treatment

### 9. Options Panel (`OptionsPanel.tsx`) — ~20 lines
- Glass background panel
- Option cards with gold selection border on hover

### 10. Action Items Modal (`ActionItemsModal.tsx`) — ~15 lines
- Sheet gets glass treatment
- Trigger button: glass circle with gold accent
- Checkboxes: gold accent on completion

### Files Modified (10 total)
1. `src/index.css` — new color variables, glass utilities
2. `tailwind.config.ts` — gold/champagne tokens, updated animations
3. `src/assets/luxury-bedroom.png` — copied from upload
4. `src/assets/luxury-terrace.png` — copied from upload
5. `src/components/wizard/WizardContainer.tsx` — glass card over photo bg
6. `src/components/planning/PlanningWorkspace.tsx` — luxury loading screen
7. `src/components/Dashboard.tsx` — glass cards, refined blocks
8. `src/components/BlockDetailModal.tsx` — glass modal
9. `src/components/planning/ChatPanel.tsx` — glass chat panel
10. `src/components/FloatingChat.tsx` — glass floating button
11. `src/components/planning/OptionsPanel.tsx` — glass options
12. `src/components/planning/ActionItemsModal.tsx` — glass sheet

