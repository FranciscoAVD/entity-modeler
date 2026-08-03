# Progress recap

Status as of 2026-08-03. Monorepo scaffolded (Bun workspaces: `client` Vite/React/R3F,
`server` Bun+Hono, unused so far). 67 tests passing, build/lint clean. Full
plan lives in [plan.md](plan.md); build order is `0 → 1 → 2 → 3 → 5 → 4 → 6 → 7 → 8 →
9 → 10 → 11`.

## What's built

**Phase 1 — Core data model** (`client/src/store/`)
Project/Space/Orbit/Entity/Relationship/Note types matching the schema in
plan.md. Zustand store as flat `Map<id, T>` per type, parent-up references. Validation
enforced at the store layer: no self-relationships, entities require a space, moving
an entity is a field-only update that never touches relationships, deleting a space
cascades to its orbits/entities/relationships. Tab selection state (`openTabs`/
`activeTabId`) with cascade-aware pruning. Selectors for derived queries, world-position
resolution, and title/tag search.

**Phase 2 — Space & orbit rendering** (`client/src/scene/BoundarySphere.tsx`,
`SpaceBoundary.tsx`, `OrbitBoundary.tsx`)
Tinted boundary spheres, color-coded by nesting level. Populated groups get a solid
fill + solid edge; empty groups drop the fill and switch to a dashed edge. Nesting
(space → orbit → entity) composes via Three.js's own scene graph (`<group position>`),
not manual offset math. Per-space/orbit visibility toggles live in `viewStore.ts`,
separate from the model store.

**Phase 3 — Node rendering** (`client/src/scene/EntityNode.tsx`, `RadialLabel.tsx`)
Shaded sphere per entity. Labels use `RadialLabel`, which recomputes its offset toward
the camera every frame — used for entity titles; space/orbit labels (`BoundaryLabel.tsx`)
intentionally use a **static** top-of-sphere position instead, since a label sliding
around a large container as the camera orbits reads as disorienting (small entity
labels don't have that problem). Not GPU-instanced — deferred to Phase 10.

**Phase 5 — Camera & interaction** (`client/src/scene/CameraRig.tsx`,
`cameraFocus.ts`)
`OrbitControls` for orbit/pan/zoom. Animated fly-to (600ms ease-in-out) when a tab
becomes active or "Reset view" is clicked, along a fixed approach angle so the camera
never flips to a disorienting side. Focus resolution is a pure, tested function
(`resolveCameraFocus`) rather than logic embedded in a `useEffect` — extracted after a
real bug where a reset request was silently overridden by whichever tab was still
active. Clicking an entity/orbit opens a tab. **Entity dragging was built, then
removed** per explicit feedback — nodes are click-only now; the store's
`updateEntityPosition` action stays for Phase 7 auto-layout and future editing UI.

**Phase 4 — Edge rendering + hit tubes** (`client/src/scene/RelationshipEdge.tsx`,
`edgeGeometry.ts`, `edgeVisibility.ts`)
Curved Bezier line (drei `Line`) paired with a separate invisible `TubeGeometry`
hit-mesh for click detection, trimmed back to each node's *surface* (not center) so
edges don't visually clip through nodes or create click ambiguity at the endpoints.
Styling escalates with how many structural boundaries an edge crosses: neutral/thin
for local (same orbit or same-space ungrouped), amber for cross-orbit, dashed pink for
cross-space. Cardinality is split across two endpoint markers (e.g. "1:N" → "1" near
source, "N" near target) since `Relationship` has no name/title field. Click
precedence across overlapping hit volumes (entity > relationship > orbit) resolved via
`userData` tags + `e.intersections`. Edges hide when either endpoint's space/orbit is
toggled invisible.

**Phase 6 — Tab bar, info panel, search** (`client/src/scene/TabBar.tsx`,
`InfoPanel.tsx`, `SidebarSearch.tsx`)
Read-only viewing UI: a tab bar (later replaced by a recently-viewed `Select`, see the
UI layout iteration below), an info panel showing entity/orbit/space tags + metadata +
notes through one shared `GroupDetails` renderer (entity, orbit, and space are the same
shape), relationship cardinality + notes — `NoteList`/`MetadataTable` shared across all
of them per the plan's "same shape, same rendering path at every level" rule. Search
combines title (fuzzy) and tag (exact) matching into one box; selecting a result opens
a tab exactly like clicking in the scene does. **Add/edit/delete note UI was
explicitly scoped out of Phase 6**, deferred to Phase 8 which owns that same scope.

**UI layout iteration** (not a plan.md phase — user-driven redesign)
- Tab bar + info panel moved from a bottom dock to a right-docked sidebar
  (`SidePanel.tsx`) — kept together since switching tabs and viewing their content are
  tightly coupled.
- The old floating visibility-toggle card + top-center search bar were replaced with a
  single fixed left `Sidebar.tsx`: project switcher (+ inline project creation),
  search, a relationship-creation dialog (two entity pickers + cardinality — the one
  creation flow that can't be defaulted from just a name), and the space/orbit
  visibility tree with inline creation.
- Creation UI went through three iterations before settling: inline click-to-expand
  rows → right-click `ContextMenu` (rejected — not discoverable in a persistent
  sidebar meant to be scanned, not right-clicked) → `DropdownMenu` with a visible "+"
  trigger for section-level actions, plain icon buttons for row-level actions → final:
  each row collapsed into a single "options" (⋮) `DropdownMenu` holding the visibility
  toggle (as a checkbox item) + add actions, with a type-identifying icon moved to the
  row's left edge.
- Creation scope is deliberately **name + sensible defaults only** (explicit decision)
  — full editing (notes, metadata, tags, position, moving between spaces/orbits) is
  Phase 8's job.
- The space/orbit/entity sidebar icon markup (type icon + its color + its `bg-*/10`
  tint + `rounded-full`), previously repeated inline at every call site in
  `SidebarTree.tsx`/`SidebarSearch.tsx`, was extracted into three components
  (`SpaceIcon`/`OrbitIcon`/`EntityIcon`) in `client/src/scene/SidebarTypeIcons.tsx`.
  `SPACE_COLOR`/`ORBIT_COLOR`/`ENTITY_COLOR` moved there too (was standalone
  `colors.ts`, now deleted); the 3D scene boundary/node components
  (`SpaceBoundary.tsx`, `OrbitBoundary.tsx`, `EntityNode.tsx`) import the color
  constants from the same file. Default size (`size-6 p-1`) is baked into each
  component and overridable via `className` (`twMerge`-based `cn`).
- Dark-mode Tailwind variants (`dark:*`) stripped from every `components/ui/*`
  primitive (badge, button, checkbox, combobox, dropdown-menu, input, input-group,
  textarea, select). The app has no light/dark toggle, so `dark:` classes were only
  ever activated by the OS's `prefers-color-scheme`, producing inconsistent styling
  no one asked for. Newly-scaffolded primitives (e.g. `select.tsx`, added via
  `shadcn add select`) get their `dark:` variants stripped the same way before use.
- Remaining native `<button>`/`<select>` elements (`TabBar.tsx`, `SidebarTree.tsx`'s
  options-menu trigger, the project switcher, `AddRelationshipDialog.tsx`'s three
  pickers) replaced with the shared `Button`/`Select` components from `ui/`, so every
  interactive control in the app goes through the same styled primitives.
- `SidebarTree.tsx` hover/spacing polish: row hover and the options-menu (⋮) button
  hover both switched from `bg-muted/50`/`bg-muted` to `bg-accent/10`/`bg-accent`.
  The options-menu wrapper `div` (already the click-propagation boundary, see the
  portal-bubbling bug below) picked up `flex items-center` so it's responsible for
  centering the ⋮ button, plus `pr-0.5` for right-edge spacing — layout/spacing
  concerns like these go on the parent, not via margin/self-align on the child.

**Sidebar focus vs. panel selection** (not a plan.md phase — UX refinement)
Clicking a space/orbit row in the sidebar tree, or picking an entity/orbit from
search, now flies the camera to that object **without** opening/changing the details
panel — previously both went through `openTab`, which always opens the panel too.
Implemented via a new `viewStore.focusOn(id, type)` / `focusTarget` / `focusToken`,
kept independent of the model store's `openTabs`/`activeTabId`. `resolveCameraFocus`
gained a `focusRequested` param, prioritized over the active-tab branch when freshly
requested (same pattern as the existing `resetRequested`). Clicking directly in the
3D scene (`EntityNode`, `OrbitBoundary`, `RelationshipEdge`) is unchanged — it still
calls `openTab`, which opens the panel and focuses the camera together, as before.
`resolveCameraFocus` also now takes `hiddenSpaceIds`/`hiddenOrbitIds` and gates every
branch (explicit focus and tab-based) through `visibility.ts`'s `isSpaceVisible`/
`isOrbitVisible`/`isEntityVisible` (new module, deduped from `edgeVisibility.ts`'s
private copy) — a hidden object can never become a camera-focus target.

**Hover state in the 3D canvas — tried, reverted** (not a plan.md phase — UX polish)
Attempted: entities/orbits/edges previewing their existing "active" (selected) visual
treatment on hover (emissive glow / boundary opacity boost / lineWidth increase), gated
by a local `hovered` boolean OR'd with `isActive`. First pass drove it from
`onPointerOver`/`onPointerOut`, which was non-deterministic for nested objects
(hovering an entity sometimes also lit up its parent orbit) — root-caused to
`onPointerOver` being edge-triggered (fires once, on entry) rather than continuous, so
a "defer to a more specific hit" check only run there can miss a nested object that
enters the intersection list on a *later* frame (see the bug entry below). Moved the
check into `onPointerMove` (re-evaluated every frame) as the fix — **but the user
reported it was still buggy after that change**, so the whole feature was reverted
(`git revert`) rather than iterated on further. Current state: cursor still flips to
`pointer` on hover (unchanged, always worked fine) but no color/opacity change. If
revisited, the `onPointerMove` fix didn't fully explain the symptom — worth treating
the diagnosis as incomplete rather than re-applying the same approach.

**Header + full-screen overlay layout** (not a plan.md phase — UI restructuring,
`client/src/scene/Header.tsx`, `Overlay.tsx`)
- Added `Header.tsx`: project switcher (`Select` + inline "New project" creation) and
  the "Reset view" button, previously living in the sidebar and as a standalone
  `ResetViewButton.tsx` (now deleted) respectively. `Sidebar.tsx`'s "Project" section
  is now a read-only display of the current project's name + description — switching
  or creating projects only happens via the header.
- Layout mechanism changed from each panel independently hardcoding `absolute` offsets
  (`top-14`/`top-16` duplicated by hand across `Header`/`Sidebar`/`SidePanel`, easy to
  fall out of sync) to: the 3D canvas (`Scene`) stays full-screen and unconstrained,
  with a single `pointer-events-none` overlay layer (`Overlay.tsx`) laying out `Header`
  (row) and a `Sidebar`/`SidePanel` row via real flexbox flow, `pointer-events-auto`
  re-enabled only on the actual chrome so clicks/drags over empty space still reach
  `OrbitControls`/scene raycasting underneath. `SidePanel` is the one piece that stays
  `absolute` (`inset-y-0 right-0`) since it mounts/unmounts with open tabs — but it now
  anchors to the flex-sized row below the header instead of a hardcoded pixel offset.
- Established pattern: `Header`/`Sidebar`/`SidePanel` each take a `className` prop
  (merged via `cn()`) for everything about their position/size *in respect to their
  parent* (`pointer-events-auto`, `w-72`/`w-80`, `h-14`, `shrink-0`, `absolute
  inset-y-0 right-0`) — supplied by `Overlay.tsx`, the only place that owns that
  layout. Each component's own className now only describes its internal appearance
  and how *its own* children are arranged (`flex items-center justify-between gap-3`,
  `flex-col gap-4`, `border-l`, `backdrop-blur`, etc.). Apply the same split for any
  future component that needs parent-supplied positioning.

**Collapsible sidebar tree + node rendering** (not a plan.md phase — Phase 8 prep / UX,
`client/src/scene/SidebarTree.tsx`)
- Added shadcn `Collapsible` (`client/src/components/ui/collapsible.tsx`). Spaces and
  orbits now expand/collapse via a chevron trigger built on the shared `Button`; spaces
  default open, orbits default collapsed.
- Nodes (entities) now render as leaf rows in the tree — under their orbit
  (`entitiesInOrbit`) or directly under their space if ungrouped
  (`ungroupedEntitiesInSpace`) — click-to-focus like search results, with no options menu
  (no visibility toggle or children at the entity level).
- `ExpandToggle` reserves the chevron button's exact footprint (same `Button`
  variant/size, just `invisible` + `disabled`) for rows with no children, rather than a
  separately-sized spacer — a hand-tuned placeholder size drifted out of sync with the
  real button after an unrelated style tweak and threw off row alignment; reusing the
  same button markup makes that class of bug impossible.
- Rows now stay highlighted at `bg-accent/10` (the hover shade) when they're the current
  focus: spaces via `viewStore.focusTarget` (never open tabs, per plan.md), orbits/
  entities via either `activeTabId` (direct scene click, opens a tab) or `focusTarget`
  (sidebar/search click, camera-only) — the two are genuinely different "current"
  signals that both need to register.
- The Spaces section (header + tree) now scrolls independently (`flex-1 min-h-0
  overflow-y-auto`) while Project/Search/Relationships stay pinned above it in
  `Sidebar.tsx` — `min-h-0` is required alongside `flex-1` for a flex child to actually
  shrink and let its own overflow kick in.
- The tree's nesting line was `border-l border-dashed`, which doesn't expose any control
  over dash/gap length (the browser derives it from border-width) and couldn't be aligned
  to anything. Replaced with a `repeating-linear-gradient` background (`DASHED_LINE_STYLE`,
  6px dash / 6px gap) positioned at `12px` — the horizontal center of the chevron button
  above it — so the guide line now runs through the toggle icons like a standard
  file-tree. The `12px` is hardcoded to `ExpandToggle`'s current button size, not derived
  from it — flagged in a comment as a silent-drift risk if that size ever changes, the
  same class of bug the `ExpandToggle` footprint fix above was addressing.

**Theming fixes** (not a plan.md phase, `client/src/index.css`,
`client/src/components/ui/select.tsx`)
- `--card` lightened (`#14171c` → `#1c2028`) and Header/Sidebar's blur opacity raised
  (`bg-card/80` → `bg-card/90`) — the panel background was too close to the canvas's
  `--background`, making chrome hard to distinguish from the 3D scene behind it.
- `--border` lightened (`#262b33` → `#3a4150`) for the same reason once panels got
  lighter — section dividers (header's `border-b`, sidebar's `border-r`, notes panel's
  `border-l`, the tree's dashed nesting lines) were barely visible against the new panel
  color.
- Found and fixed a real mis-mapped-token bug: `--color-input` and `--color-ring` in the
  `@theme` block bypassed their own `--input`/`--ring` `:root` values and pointed
  straight at `--foreground` and `--border` respectively — so every unfocused `Select`/
  `Input`/`Combobox` showed a near-white border (`--foreground` is a light cream) and
  every focused one showed a muted gray ring instead of the primary accent. Fixed at the
  token level (`--input: var(--border)`, `--ring: var(--primary)`, both `--color-*`
  mappings now point through their own variable) rather than patching individual
  components, since every control built on `border-input`/`ring-ring` shared the bug.
- `Select`'s dropdown defaulted to Radix's `item-aligned` positioning, which
  intentionally anchors the menu so the *selected item* lines up over the trigger — read
  as the menu overlapping the trigger in the header's project select. Changed the
  component default to `popper` (matching how `DropdownMenu`/`Combobox` already anchor),
  fixing it for every `Select` in the app, not just the header one.
- `SelectItem`'s highlighted state changed from `focus:bg-accent
  focus:text-accent-foreground` to `focus:bg-primary/10` (no text-color swap — near-black
  `accent-foreground` text would be unreadable against a subtle `/10` tint), matching the
  `hover:bg-accent/10` treatment used elsewhere.

**Entity `fields` removed; entities now carry tags/metadata like Space/Orbit** (not a
plan.md phase — data model correction, `client/src/store/types.ts`,
`client/src/scene/InfoPanel.tsx`)
- `Entity.fields: Field[]` (`{ id, name, type, isPK?, isFK? }`) modeled a database-table
  column — a value-less schema declaration, and a narrower assumption (this tool targets
  general entities/relationships, e.g. plan.md's own network-topology example) than the
  tool intends. `isPK`/`isFK` were dropped from `Field` first, then `Field` itself was
  removed entirely; `Entity` now has `tags: string[]` and `metadata?` directly, the same
  shape as `Space`/`Orbit`.
- `InfoPanel.tsx`'s `EntityDetails` (previously its own `FieldsTable`-based renderer)
  now just spreads the entity into the shared `GroupDetails` component already used by
  `OrbitDetails`/`SpaceDetails` — one less bespoke renderer.
- Tags were previously space/orbit-only; `buildTagIndex`/`searchByTag`/`searchAll` now
  index entity tags too, so entities are searchable by tag like everything else.
  `seed.ts` demonstrates this by tagging two entities in different spaces `"billing"`.
- plan.md's data model, decision #11, the visibility table, and Phase 1/6/8 status were
  updated in the same pass.

**Notes gained a required `title` + rendered date** (not a plan.md phase — UI polish,
`client/src/scene/InfoPanel.tsx`, `client/src/store/store.ts`)
- `Note.title` is now required; `addNote`'s signature and every `seed.ts` call site were
  updated to pass one. `createdAt` was already tracked but never actually rendered —
  `NoteList` now shows the title next to a `toLocaleDateString()`-formatted date.
- Note rendering polish in the same pass: dropped the per-note border in favor of plain
  vertical spacing, removed left/right padding so notes sit flush with the rest of the
  panel, body text justified, title styled `text-primary` so it isn't the same color as
  the body. Titles `truncate`; body and metadata values get `break-words` — the side
  panel is a fixed width, and long unbroken text could otherwise force horizontal
  overflow.
- `seed.ts`'s demo notes were expanded (longer text, a second note on every object that
  already had one) specifically to exercise that overflow/multi-note-stacking handling.

## Notable bugs hit and fixed along the way
(worth knowing if similar patterns show up again)
- **Zustand `useShallow` gotcha**: works for arrays of *stable* references (existing
  Map values) but not for arrays whose *elements* are freshly constructed on every
  call (e.g. `searchAll`'s `SearchResult[]`) — the one-level shallow comparison can't
  see past that, causing an infinite render loop. Fix: memoize on the raw Maps/query
  instead of the derived array.
- **Click precedence**: a bigger hit volume (an orbit's sphere) is geometrically
  nearer the camera than anything nested inside it, so its click handler fires first
  unless it explicitly defers via `e.intersections` + `userData` tags.
- **Camera reset silently overridden**: fixed by extracting focus resolution into a
  pure function with a test for the exact regression case.
- **React portals still bubble through the *component* tree, not the DOM tree**: a
  `DropdownMenuCheckboxItem` rendered via `Portal` inside a sidebar row's options
  menu was still a React-tree descendant of that row's `onClick`, so toggling
  visibility ("Visible" checkbox) also fired the row's own `focusOn(...)` handler —
  hiding an object made the camera fly to it. Fixed by wrapping the whole menu
  (trigger + portal content) in one `stopPropagation` boundary in `SidebarTree.tsx`'s
  `OptionsMenu`, rather than only stopping propagation on the trigger button.
- **A "gate" dependency became a "trigger" dependency**: fixing the bug above also
  added `hiddenSpaceIds`/`hiddenOrbitIds` to `CameraRig`'s `useEffect` dependency
  array, intending them only to gate *new* focus resolutions — but as a dependency,
  *any* visibility toggle re-ran the effect, and if the object being shown/hidden was
  the current focus, its resolved key changed and the camera re-tweened, i.e. toggling
  visibility on now jumped the camera too. Fixed by reading `hiddenSpaceIds`/
  `hiddenOrbitIds` fresh via `useViewStore.getState()` *inside* the effect (same
  pattern as `useModelStore.getState()`) instead of subscribing to them as a
  dependency — they still gate resolution at the moment of a real trigger (tab
  change, reset, explicit focus) without being a trigger themselves. General lesson:
  a value read only to *gate* a computation inside an effect doesn't belong in that
  effect's dependency array — only values that should *re-run* the effect do.
- **`onPointerOver` is edge-triggered, not continuous — a "defer to a more specific
  hit" check only works if re-run every frame — but this alone didn't fully explain
  the symptom**: applying the same click-precedence pattern (`e.intersections.some(...)`
  + conditional `stopPropagation()`) to hover was non-deterministic for nested objects
  (hovering an entity sometimes also lit up its parent orbit). Traced through
  `@react-three/fiber`'s actual event source (`internal.hovered` bookkeeping in
  `handlePointer`): `onPointerOver` fires exactly once, the frame an object first
  enters the intersection list, so a one-time "is something more specific here" check
  can miss an entity that enters the intersection list on a *later* frame than the
  (geometrically larger) orbit around it. Moved the check into `onPointerMove`
  (re-evaluated every frame) as the fix — **the user reported it was still buggy
  afterwards**, so the feature was reverted rather than iterated on further. Either
  there's a second contributing factor not yet identified, or the diagnosis above is
  incomplete — don't assume it's solved if this is revisited.

## TODO — remaining phases

**Phase 7 — 3D auto-layout**
- Force-directed layout: within each orbit first, then orbits within their space, then
  spaces within the project (mirrors the data hierarchy)
- Optional shell/sphere constraint per tier
- Manual drag position (once dragging/editing exists again) always overrides
  auto-layout for whatever was moved

**Phase 8 — Editing UI**
- Full add/edit/delete for notes (all 5 levels), metadata, tags — `addNote` exists in
  the store (now with a required `title`) but has no UI caller yet
- Move entity between spaces/orbits (re-parent + re-base position) — store logic
  already exists (`moveEntity`), just needs UI
- Delete space/orbit/entity/relationship with cascade-confirmation UI — store logic
  already exists, no UI trigger yet
- Probably where entity/space/orbit *repositioning* comes back, this time scoped
  deliberately (the earlier drag implementation was removed, not replaced)

**Phase 9 — Persistence & export**
- JSON serialize/deserialize (all note levels, metadata, tags)
- Flatten-to-orthographic export (PNG/PDF) at project/space/orbit scope
- Probably where `server` (currently an unused Hono skeleton) starts being used, if
  persistence is server-backed rather than local-only

**Phase 10 — Performance polish**
- LOD for text/geometry at distance, frustum culling
- GPU instancing for entity spheres (explicitly deferred here from Phase 3)
- Worker-based layout computation, visibility culling of hidden spaces/orbits

**Phase 11 — Packaging & API**
- Public embeddable API (`new ERModeler(...)`, `.addProject()`, `.on('select', ...)`,
  `.search()`, etc.)
- Optional React wrapper, docs, example schemas
- Document the single-user constraint

## Smaller open items (from plan.md's own "open questions", still unaddressed)
- Multi-select bulk operations (bulk-move, bulk-delete, bulk-tag)
- Long-title truncation/wrapping rules for billboarded labels
- Formal color/material scheme per nesting level (current palette is a reasonable
  first pass, not a documented system)
- Undo/redo (history stack vs. relying on the reactive store)
- Testing strategy for raycasting/hit-detection and layout correctness (currently
  covered by unit tests on pure logic only — no visual regression / scripted-camera
  testing)
