# Coding Agent Instructions: Mental Health Support App

### Expo Project Initialization Protocol

1. **Environment Check:** Always check if `package.json` exists and contains `expo` as a dependency before suggesting code changes.
2. **Initialization:** If starting a new project, use the command: `npx create-expo-app@latest .` to initialize in the current directory.
3. **Dependency Management:** If files are missing, do not attempt to write them manually. Instead, instruct the user to run `npm install` or `npx expo install` to ensure peer dependencies are matched.
4. **Hidden Files:** Ensure the `.gitignore` and `.expo` folders are accounted for in the workspace context.

## 1. Core Tech Stack

- **Framework:** React Native with Expo (SDK 55+).
- **Language:** TypeScript (Strict mode).
- **State Management:** React Query (for API caching) and Context API (for theme/user state).
- **Database:** PostgreSQL (Supabase) for backend; expo-sqlite for offline-first local storage.
- **Styling:** Tailwind CSS (NativeWind) with a "Dark Mode First" philosophy.

## 2. UI/UX Principles

- **Cognitive Load:** High-stress users need minimalism. No complex animations or deep menus.
- **Color Palette:** Muted blues, deep greens, and soft terracotta (for SOS). Avoid "Alert Red."
- **Feedback:** Use `expo-haptics` for all grounding exercises to provide tactile guidance.

## 3. Database & ERD Rules

- **Bridge Tables:** Always use 1:M (One-to-Many) notation when connecting entities (e.g., Users to Saved Resources).
- **Recursive Relationships:** Use a "pig's ear" loop for hierarchical data, specifically for the 'Support Categories' table to allow for infinite nesting of topics.
- **Security:** Implement local encryption via `expo-secure-store` for any user-generated journals or safety plans.

## Database Guidelines (SQLite)

- **Engine:** Use `expo-sqlite` (next-gen async API).
- **Schema Design:** - Maintain strict 1:M relationships for user-generated data.
  - Bridge tables must be used for any Many-to-Many associations.
  - For hierarchical data (like resource categories), use a self-referencing foreign key to create a "pig's ear" recursive loop.
- **Transactions:** Always use `db.withTransactionAsync` for multi-step write operations to ensure data integrity.

## 4. Feature Implementation Logic

- **SOS Button:** Must be accessible within one tap from any screen.
- **Offline Reliability:** All crisis resources and breathing tools must be cached and functional without an internet connection.
- **Location Logic:** Prioritize privacy—request foreground location only when searching for local resources and do not store precise GPS history.

## Feature Implementation: SOS & Breathing

- **SOS Implementation:** Use `expo-linking` for 'tel:988' and 'sms:988'. Use `Haptics.notificationAsync` on the press event to confirm user intent.
- **Breathing Logic:** Use `react-native-reanimated` v3. Coordinate `useSharedValue` with `runOnJS(Haptics.impactAsync)` to create a "pulsing" inhale effect.
- **Performance:** Ensure the breathing animation runs on the UI thread to prevent lag during a mental episode.
- **Accessibility:** Ensure the SOS button has a `role="button"` and clear `accessibilityLabel` for screen readers.

# Mental Health Support App: Development Phases

## Phase 1: SOS & Immediate Grounding (MVP)

**Objective:** Deliver a critical "safety net" that works offline.

- **988 Integration:** One-tap calling/texting to the 988 Suicide & Crisis Lifeline using `expo-linking`.
- **Haptic Breathing (Hero Feature):** A visual and tactile breathing guide using `expo-haptics` and `react-native-reanimated`.
- **Grounding Tools:** Interactive 5-4-3-2-1 sensory exercise to de-escalate acute panic.
- **Offline Safety Plan:** Local CRUD for "Safe People" and "Safe Places" using `expo-secure-store`.

## Phase 2: Location-Aware Resource Engine

**Objective:** Dynamically serve local help based on the user's current coordinates.

- **Geolocation:** Implementation of `expo-location` for real-time lat/long retrieval.
- **API Integration:** Connect to 211 National Data Platform or SAMHSA API to fetch nearby clinics.
- **Local Overrides:** Hardcoded fail-safe resources for specific regions (e.g., South Bend/Elkhart area).
- **Offline Caching:** Use `react-query` to ensure recently viewed resources remain accessible without data.

## Phase 3: Proactive Daily Wellness

**Objective:** Transition from crisis-only use to a daily mental health maintenance tool.

- **Mood Tracking:** A daily check-in interface with visual data visualization of trends.
- **The Joy Kit:** A private digital locker for comfort media (photos, audio notes, and text).
- **Stress Library:** A categorized repository of daily practices for stress reduction and healthy mood elevation.

## Phase 4: Peer Support & Community Roadmap

**Objective:** Securely scale the application to include community interaction.

- **Hope Board:** Asynchronous, moderated board for sharing encouragement.
- **Support Circles:** Real-time, topic-based chat rooms using `Socket.io`.
- **Recursive Category Logic:** Use a recursive database model (Pig's Ear loop) to organize complex support hierarchies.
- **AI Safety Layer:** Automated sentiment analysis to flag high-risk language and trigger immediate resource modals.
