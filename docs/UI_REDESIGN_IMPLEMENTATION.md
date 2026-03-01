# UI Redesign Implementation Plan (Mobile, Premium Companion)

This is the concrete rollout map to migrate the entire app to the new companion-first design system.

## 1. Foundations

### Tokens
- Source: `src/theme/designSystem.ts`
- Use these tokens for all new/updated components.
- No hardcoded ad-hoc colors for new UI work.

### Core Primitives
- `src/components/ui/Buttons.tsx`
- `src/components/ui/Card.tsx`
- `src/components/ui/StatBar.tsx`
- `src/components/ui/MoodIndicator.tsx`
- `src/components/ui/AppModal.tsx`
- `src/components/ui/Toast.tsx`
- `src/components/ui/ScreenHeader.tsx`

## 2. Screen-by-screen Migration

### A) Home (`src/screens/HomeScreen.tsx`)
Goal: Emotional anchor and lowest cognitive load.

Steps:
1. Keep pet stage as hero (~55% viewport).
2. Replace custom chips with `MoodIndicator`.
3. Move all primary actions into one bottom dock with 4 large buttons.
4. Replace ad-hoc blocks with `Card` primitives.
5. Keep only one secondary row below actions (stats or glance, not both duplicated).
6. Ensure wallet status is subtle (icon + connected text).

Acceptance:
- Pet visually dominates.
- Thumb-reach actions are clear and large.
- No stacked noisy banners.

### B) Interaction Mode (Home action focus)
Goal: focused, tactile flow.

Steps:
1. Use `AppModal` as focused interaction surface.
2. Dim background and scale pet stage slightly.
3. Keep 1 primary action + 1 secondary action only.
4. Use subtle press scale (`0.97`) and haptics.

Acceptance:
- No modal stacking.
- No bounce-heavy animations.

### C) Profile (`src/screens/ProfileScreen.tsx`)
Goal: clean progression view.

Steps:
1. Keep header + identity compact.
2. Convert data sections to `Card`.
3. Keep progress, mood history, achievements in clear vertical rhythm.
4. Remove decorative noise that does not aid understanding.

Acceptance:
- Readable scroll structure.
- Strong hierarchy from level/XP to details.

### D) Store (`src/screens/ShopScreen.tsx`)
Goal: premium store, calm tone.

Steps:
1. Keep one top header and one category rail.
2. Use consistent product card height and CTA placement.
3. Avoid excessive labels/chips; keep rarity minimal.
4. Standardize purchase confirmation with `AppModal`.

Acceptance:
- Feels premium catalog, not game shop.
- Faster visual scanning.

### E) Games/Rewards (`src/screens/GamesScreen.tsx`)
Goal: structured reward center without visual chaos.

Steps:
1. Group into sections: Daily, Weekly, Wheel, Mini-games.
2. Use consistent section headers and card spacing.
3. Keep wheel as one focal module with clean surrounding UI.

Acceptance:
- Clear section boundaries.
- Low clutter.

### F) Wallet Connect (`src/components/WalletConnect.tsx`)
Goal: trustworthy onboarding.

Steps:
1. Use single hero header + one benefits card.
2. Keep one primary CTA only.
3. Keep error messaging concise and prominent.

Acceptance:
- Clear first-time flow.
- No extra decorative distractions.

### G) Mint (`src/screens/MintScreen.tsx`)
Goal: confident conversion flow.

Steps:
1. Keep mint summary in one card.
2. Keep explanatory bullets short.
3. Use one primary CTA and minimal secondary text.

Acceptance:
- Decision is clear in < 10 seconds.

## 3. Motion Standards

- Tap press scale: `0.96-0.98`
- Quick transitions: `120-160ms`
- Normal transitions: `240-320ms`
- Context transitions: `320-420ms`
- Prefer opacity/fade over complex stacked transforms.
- Keep background ambient motion subtle and low-frequency.

## 4. Accessibility Rules

- Tap targets >= `44x44`.
- Do not rely on color only for status.
- Maintain AA contrast for body text.
- Respect reduced motion mode (disable ambient drift and large scale transitions).
- Keep semantic reading order consistent.

## 5. Performance Rules (RN + 3D)

- Keep 3D canvas isolated from frequent re-renders.
- Memoize heavy UI sections around pet stage.
- Avoid multiple simultaneous overlays.
- Keep modals simple and non-nested.
- Avoid expensive blur stacks and overdraw-heavy backgrounds.

## 6. QA Checklist

- SafeArea top/bottom on common devices.
- One-hand reach for primary actions.
- 60 FPS feel during idle + pet animation.
- Visual consistency across all tabs.
- Dark/blue tonal cohesion preserved end-to-end.
