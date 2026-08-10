# Progress recap

Status as of 2026-08-03. Monorepo scaffolded (Bun workspaces: `client` Vite/React/R3F,
`server` Bun+Hono, unused so far). 80 tests passing, build/lint clean. Full
plan lives in [plan.md](plan.md); build order is `0 → 1 → 2 → 3 → 5 → 4 → 6 → 7 → 8 →
9 → 10 → 11`.

## What's built

**Phase 1 — Core data model** (`client/src/store/`)
Project/Space/Orbit/Entity/Relationship/Note types matching the schema in
plan.md. Zustand store as flat `Map<id, T>` per type, parent-up references. Validation
enforced at the store layer: no self-relationships, entities require a space, deleting
a space cascades to its orbits/entities/relationships. Moving an entity never touches
relationships, and (since the Phase 8 pass below) re-bases `position` so world position
is preserved across the move rather than being a pure field update. Tab selection state
(`openTabs`/`activeTabId`) with cascade-aware pruning. Selectors for derived queries,
world-position resolution, and title/tag search.

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

**Phase 8 (part 1) — Delete + move entity UI** (`client/src/scene/DeleteConfirmDialog.tsx`,
`MoveEntityDialog.tsx`, `SidebarTree.tsx`, `Sidebar.tsx`, `InfoPanel.tsx`,
`client/src/store/store.ts`, `selectors.ts`)
Scoped deliberately to just these two of Phase 8's four pieces (notes/tags/metadata
editing and repositioning are still TODO, see below) — the store already implemented
both, only the UI was missing.
- `DeleteConfirmDialog.tsx`: generic confirm dialog (same shared shape as `CreateDialog.tsx`),
  used by every delete entry point. Space/orbit/entity rows get a destructive "Delete"
  item at the bottom of their existing sidebar `ContextMenu` (`RowContextMenu` gained an
  `onDelete` prop); the confirmation message is built from two new pure selectors,
  `spaceDeleteImpact`/`entityDeleteImpact` (orbit/entity/relationship counts, entity
  count respectively) — `store.ts`'s own cascade logic in `deleteSpace`/`deleteOrbit`/
  `deleteEntity` is untouched, these just preview the same shape ahead of time.
  Relationships have no sidebar row, so their only delete entry point is a button added
  to `InfoPanel.tsx`'s `RelationshipDetails`.
- `MoveEntityDialog.tsx`: modeled directly on `AddRelationshipDialog.tsx`'s two-dependent-
  `Select`s structure — target space, then target orbit (or "no orbit", via a local
  `"__none__"` sentinel value since Radix `Select` can't use an empty string) scoped to
  that space. Triggered by a new "Move to..." item on entity rows.
- **Bug found and fixed along the way**: plan.md's own data model says moving an entity
  means "re-parenting, re-basing position to the new local origin," but `moveEntity` had
  only ever been a field update (`spaceId`/`orbitId` reassigned, `position` untouched) —
  nothing exercised that path before this UI existed. Left as-is, an entity's local
  offset would get silently reinterpreted against the new parent's origin and jump in
  world space on every move. Fixed by computing `getWorldPosition` before the move and
  `subtract`-ing the new parent's origin (`getOrbitWorldOrigin` or the space's own
  `origin`) to re-derive `position`, so world position is now preserved across a move —
  matching the documented design. Covered by two new tests moving an entity across
  spaces/orbits with different origins and asserting world position is unchanged.
  **Known follow-on, not fixed here**: space creation from the sidebar (`Sidebar.tsx`'s
  `handleCreate`) has no origin field and always calls `addSpace({ projectId, name })`,
  so every UI-created space defaults to the same `{0,0,0}` origin — meaning a move
  between two UI-created spaces currently produces *no visible relocation at all* (world
  position is preserved, and since both parents share an origin, local position doesn't
  even need to change). Confirmed intentional/expected with the user; left for later
  rather than adding an origin field to `CreateDialog` in this pass.

**Phase 8 (part 2) — Notes, tags & metadata editing UI** (`client/src/scene/TagEditor.tsx`,
`MetadataEditor.tsx`, `MetadataTable.tsx`, `NoteDialog.tsx`, `InfoPanel.tsx`,
`client/src/store/store.ts`, `types.ts`, `seed.ts`)
Closes out Phase 8's remaining pieces except repositioning (still deferred, see TODO).
Three separate editing surfaces per explicit user direction ("notes editing is separate
from tag/metadata editing"), scoped to Space/Orbit/Entity for tags/metadata and
Space/Orbit/Entity/Relationship for notes — Relationship has no `tags`/`metadata` fields
in the data model, so it only gets note editing. Went through several rounds of UI
iteration on top of the initial version; the bullets below describe where each landed.
- `TagEditor.tsx`/`MetadataEditor.tsx`: presentational, no store coupling — each takes
  the current value plus an `onUpdate` callback, so `InfoPanel.tsx`'s `EntityDetails`/
  `OrbitDetails`/`SpaceDetails` (which already fetch their own record) are the ones that
  bind the specific store action (`updateEntityTags` vs. `updateOrbitTags`, etc.) into
  that callback — `GroupDetails` itself stays generic across the three types, same
  division of responsibility it already had. Metadata values are always written back as
  strings from the editor's text input (a plain scope simplification — a value typed
  through the UI can't stay a `number`; only seed-set values do).
- **Editing is off by default.** `GroupDetails` gained a pencil/check toggle button next
  to the object's name (`editing` state); read-only tag badges and `MetadataTable` show
  by default, swapping to `TagEditor`/`MetadataEditor` only once toggled. Each
  `EntityDetails`/`OrbitDetails`/`SpaceDetails` call site keys its `GroupDetails` by the
  object's id so switching to a different object resets the toggle back to read-only
  rather than carrying edit-mode across (React doesn't remount on a prop change alone,
  only a `key` change).
- `TagEditor.tsx` UI iteration: the remove-tag `X` shrank to `size-2.5` (the badge CSS
  otherwise forces `size-3!`, so overriding needed a matching `!` important-marker
  class), and only turns `text-destructive` **on hover** — an earlier pass that also
  dimmed its default color to `text-muted-foreground` was reverted per feedback ("the
  original dark text was fine"). The "add tag" input moved out of the chip row onto its
  own line below (`mt-1` added only when chips exist, via `cn()`).
- `MetadataEditor.tsx` gained full edit capability, not just add/remove: each row now
  gets `Pencil`/`Trash2` buttons (matching `NoteList`'s icon language) — clicking Pencil
  swaps that row's key/value cells for inline `Input`s with `Check`/`X` to save/cancel
  (Enter/Escape as shortcuts). Renaming a key is a delete-old + set-new, since a metadata
  bag has no meaningful order to preserve. Row hover started as a whole-row
  `bg-destructive/10` tint (when delete was the only action) but was walked back to a
  neutral `hover:bg-accent/10` once edit was added — a red row now reads ambiguously
  when hovering could mean either action, so only the `Trash2` button itself keeps
  `hover:text-destructive`.
- Tags and metadata keys both get `capitalize` (CSS `text-transform`, display-only —
  stored values are untouched) for visual consistency, applied at every render site
  (`TagEditor`, `GroupDetails`' read-only badges, `MetadataEditor`, `MetadataTable`).
- **Notes: view/add/edit consolidated into one dialog.** Note text in the list now
  clips to `line-clamp-6` with a `hover:bg-accent/10` row and click-to-open; this
  started as a *second*, read-only "view full note" dialog alongside the existing
  edit dialog, but per feedback ("editing a note also opens a dialog, let's move the
  editing feature into the dialog") the two were merged into a single `NoteDialog.tsx`:
  a brand-new note ("new") opens straight into the edit form (title `Input` + text
  `Textarea`); an existing note opens read-only (full text, author, metadata) with a
  pencil toggle into that same form, Save returning to the view rather than closing.
  The row's separate Pencil button was removed as redundant once clicking the note
  itself opens the same dialog; the row's `Trash2` (delete, own confirm dialog) is
  unaffected. `MetadataTable` (used both for this and for `GroupDetails`' read-only
  metadata) was extracted out of `InfoPanel.tsx` into its own `MetadataTable.tsx` to
  avoid a circular import once `NoteDialog.tsx` needed it too.
- `NoteList` in `InfoPanel.tsx` gained `targetType`/`targetId` props and an "Add note"
  button, and no longer early-returns `null` on an empty `notes` array, since the
  header + add button need to render even with zero notes.
- `addNote`/`updateNote`/`deleteNote` in `store.ts` were unified onto a shared
  `notesPatch`/`withNotes` helper (look up the record by `targetType`, replace its
  `notes` array) — `addNote` existed alone before; adding the other two made the
  "3 actions, same lookup-and-replace shape" duplication worth collapsing.
- **Data-model change, not just a UI addition**: `Project.notes` is removed entirely
  (not merely left without a UI) — confirmed with the user that notes/tags/metadata are
  exclusively a Space/Orbit/Entity(/Relationship, notes only) concept going forward.
  `NoteTargetType` narrowed from 5 variants to 4 (drops `"project"`); `addProject` no
  longer initializes a `notes` array; `seed.ts`'s two demo project notes are gone.
  plan.md's data model, decision #6, the stale "Project-level notes have no UI yet" note,
  and the now-resolved "Delete and move-entity UI" open question (part 1's work) were all
  updated in the same pass.

**InfoPanel layout: `PanelSection` wrapper + full-bleed row hover** (not a plan.md phase
— UI polish, `client/src/scene/InfoPanel.tsx`, `MetadataEditor.tsx`)
`InfoPanel`'s own padding (`p-3`) was removed in favor of a `py-3`-only outer container
plus a small `PanelSection` wrapper (`px-3`) that everything opts into individually —
motivated by wanting the Notes section's per-note hover background, and later
`MetadataEditor`'s per-row hover, to span the *entire* panel width rather than stopping
at wherever the panel's own padding was. `NoteList` and (only while editing)
`MetadataEditor` sit as unpadded siblings of `PanelSection` so their outer hoverable
rows reach the panel edges, while their own inner content carries matching `px-3`/`pl-3`
so text still lines up with everything else in `PanelSection`.

**Recently-viewed picker moved from the side panel into the Header** (not a plan.md
phase — layout tweak, `client/src/scene/Header.tsx`, `TabBar.tsx`, `SidePanel.tsx`)
`TabBar` (the recency-capped `Select`, see decision #12) now renders inline in `Header`
between the project switcher and "Reset view," rather than docked above `InfoPanel` in
`SidePanel` — it's a navigation control, not part of the details being viewed. Lost its
own bordered/padded wrapper (`border-b p-2`) and fixed width (`w-56`) to fit the
header's flex row instead of a full-width docked panel.

**Close button on the side panel** (not a plan.md phase — small UX gap,
`client/src/store/store.ts`, `client/src/scene/SidePanel.tsx`, `plan.md`)
New store action `clearActiveTab()` sets `activeTabId: null` without touching
`openTabs` — deliberately distinct from plan.md decision #12's "no manual close,"
which is about the recency *history*, not the panel's visibility. `SidePanel` now
gates on `activeTabId !== null` instead of `openTabs.length > 0` (previously the two
were always equivalent in practice, since `activeTabId` only ever went `null` when
`openTabs` also emptied out via cascade delete — this is the first path that
deliberately decouples them) and renders a small bordered header row with an `X`
button above `InfoPanel`. Closing leaves the tab history intact, so the Header's
"Recently viewed" select can still reopen the same tab afterward. plan.md's decision
#12 gained a clarifying sentence so this doesn't read as contradicting "no manual
close."

**InfoPanel polish: typography, type-colored titles, cardinality-aware relationship
rendering, and a real relationship edit mode** (not a plan.md phase — UI polish +
data-model extension, `client/src/scene/InfoPanel.tsx`, `RelationshipEdge.tsx`,
`components/ui/badge.tsx`, `MetadataTable.tsx`, `MetadataEditor.tsx`, `TagEditor.tsx`,
`NoteDialog.tsx`, `client/src/store/store.ts`, `selectors.ts`, `types.ts`, `seed.ts`,
`plan.md`)
- Text floor raised from `text-xs` to `text-sm` across every InfoPanel-scoped surface
  (notes, tags, metadata editing) — including `Badge` (bumped `h-5`→`h-6` to fit),
  which is only ever used from this surface. Hierarchy is now carried by weight/case/
  color (uppercase section labels, muted dates/authors) rather than a smaller size.
  Titles bumped to `text-xl`.
- Space/orbit/entity titles are now colored by their type (`text-space`/`text-orbit`/
  `text-entity`, the existing sidebar-icon hues). Relationships have no fixed per-type
  hue, so their title is colored by scope instead (local/cross-orbit/cross-space),
  reusing `RelationshipEdge.tsx`'s `EDGE_STYLES` (now exported) — the title matches
  whatever color the edge itself renders as in the 3D scene.
- The relationship title's `→` is now a real icon that depends on cardinality:
  `ArrowRightLeft` (the same icon as the sidebar's "Add relationship" action) for N:M,
  since it's the one inherently-bidirectional cardinality; `ArrowRight` for 1:1/1:N.
  `RelationshipEdge.tsx` grew matching two-way arrowheads (cone meshes oriented off
  each end's curve tangent) rendered only for N:M edges in the 3D scene itself.
- **Relationship edit mode, previously missing entirely.** `RelationshipDetails` gained
  the same pencil/check toggle pattern as `GroupDetails`, positioned next to the title
  (an earlier pass had incorrectly put it next to the cardinality line instead — fixed
  to match). Editing now covers: cardinality (`Select`), and — new — source/target
  entity (`Select`s scoped to the relationship's project via a new `projectIdForEntity`
  selector), backed by a new `updateRelationshipEndpoints` store action. Picking an
  entity already on the other end swaps the pair rather than hitting the
  no-self-relationship guard, mirroring `AddRelationshipDialog`'s source-change logic.
- **Data model change: `Relationship` gained `tags`/`metadata`**, same shape as
  Space/Orbit/Entity (`updateRelationshipTags`/`updateRelationshipMetadata` added;
  `addRelationship` accepts optional `tags`/`metadata`, though creation UI stays
  name/endpoints-only per the existing "creation is defaults-only" rule). Rendered/
  edited in `RelationshipDetails` via the same `Badge`/`TagEditor`/`MetadataTable`/
  `MetadataEditor` pieces `GroupDetails` uses. Tag *search* was deliberately **not**
  extended to relationships in this pass (`buildTagIndex` still only covers
  space/orbit/entity) — relationships have no `name` for a search-result label and no
  sidebar row, so wiring them into search is more surface area than this ask covered.
- **Note-level metadata was briefly removed from relationships, then reconsidered.**
  Mid-session, relationship notes were made prose-only (metadata rejected at
  `addNote`, enforced at the store boundary) because the note-level CIDR/VLAN example
  read as confusing floating alongside a note's text. Once relationships gained their
  own object-level `tags`/`metadata` (see above), that CIDR/VLAN example moved there
  instead — its more natural home, matching how space/orbit/entity metadata already
  works. Net result: relationship *notes* stay prose-only (no per-note metadata bag),
  but relationships themselves now have metadata, same as every other object type.
  plan.md's decision #6 and #11, the data model, the visibility table, and Phase 1
  status were all updated to match.

**Tags normalized into a shared registry** (plan.md decision #11's "planned but not
built" item, `client/src/store/types.ts`, `store.ts`, `selectors.ts`,
`scene/InfoPanel.tsx`, `scene/SidebarSearch.tsx`, `plan.md`)
Space/Orbit/Entity/Relationship previously each stored `tags: string[]` inline —
free-typed strings duplicated per object, with no shared identity (tagging two
objects "Billing" and "billing" produced two unrelated strings, and renaming a tag
meant editing every object that had it, one at a time).
- New `Tag { id, name }` type and a flat `tags: Map<string, Tag>` collection on
  `ModelState` — same "flat collection, parent references point up" shape as every
  other type (decision #15), except tags have no parent; they're shared vocabulary
  across the whole store. `Space`/`Orbit`/`Entity`/`Relationship` all swapped
  `tags: string[]` for `tagIds: string[]`, referencing this registry.
  - **Behavior stayed the same at the edges, changed underneath.** `TagEditor` and
    every `add*`/`update*Tags` action still take/return plain `string[]` of *names* —
    nothing about typing tags into a `TagEditor` looks different. A new private
    `resolveTagIds(tags, names)` helper in `store.ts` does the "normalize on write"
    step for all four `add*` actions and all four `update*Tags` actions: for each
    typed name, reuse an existing tag if one matches case-insensitively, otherwise
    create it in the registry, and store the resolved `tagIds` on the record. Verified
    against the seed data: "Node 1" and "Remote Node" both tag "billing" and now
    share one registry entry rather than two independent strings.
  - Two new actions this unlocks: `renameTag(tagId, name)` — touches only the
    registry record, so every object referencing it picks up the new name with zero
    array surgery, the actual payoff of normalizing — and `deleteTag(tagId)`, which
    removes the registry entry and strips the id out of every `tagIds` array that
    held it (same "no dangling reference" cascade shape as `deleteSpace`). Neither has
    a UI trigger yet — a global tag-management screen (browse/rename/delete tags,
    autocomplete while typing in `TagEditor`) is still open, tracked in plan.md
    decision #11 as the remaining "planned but not built" piece; the data model and
    store actions it needs are now in place.
  - `InfoPanel.tsx`'s `EntityDetails`/`OrbitDetails`/`SpaceDetails`/
    `RelationshipDetails` each gained a `tagNamesForIds` (new selector) lookup —
    resolving `record.tagIds` to display names via `useShallow`, same "subscribe to
    stable Maps, not a freshly-built array" pattern documented below for `searchAll` —
    and pass that resolved `tags` array into `GroupDetails`/`TagEditor` explicitly,
    rather than relying on `{...record}` spread (which no longer has a `tags` field
    to spread).
  - `buildTagIndex`/`searchByTag`/`searchAll` in `selectors.ts` updated to resolve
    tag names through the registry when building the index — external behavior is
    unchanged (still an exact-match name index), `SidebarSearch.tsx` just had to
    start subscribing to `state.tags` and threading it through alongside the other
    Maps it already passes to `searchAll`.
- plan.md's decision #11, the data model section (new `Tag` entry, `tagIds` on every
  taggable type, a validation-rules line for the delete-tag cascade), and Phase 1
  status updated to match.

**"Relationships" submenu on entity rows** (not a plan.md phase — sidebar UX,
`client/src/scene/SidebarTree.tsx`)
`EntityRow`'s context menu previously had a single top-level "Add relationship" item.
Replaced with a `ContextMenuSub` ("Relationships", no leading icon — went through one
iteration with a leading `ArrowRightLeft` on the trigger itself, removed per feedback
since the submenu's own chevron already signals "more inside") listing every
relationship the entity participates in (via the existing `relationshipsForEntity`
selector), with "Add relationship" moved to the end of that submenu behind a
separator — an empty list shows a disabled "No relationships yet" placeholder instead
of nothing. Each listed relationship renders as `{source} [icon] {target}` — the icon
is cardinality-dependent (`ArrowRightLeft` for N:M, `ArrowRight` for 1:1/1:N), the
same mapping `InfoPanel`'s relationship title uses, replacing an initial plain `→`
text version per feedback ("icons in the submenu match the relationship type").
Clicking a listed relationship calls `focusOn(id, "relationship")`, the same
camera-only-no-tab behavior every other sidebar row/search-result click already uses;
"Move to..." stays a top-level item, unaffected. Deliberately built the label list via
`useShallow` over `relationshipsForEntity`'s output (stable `Relationship` object
references already in the store) plus a separate plain `entities` Map subscription,
rather than mapping to fresh `{id, label}` objects inside the selector itself — the
latter would repeat the `getSnapshot`-returns-a-new-reference-every-call bug
documented below (`searchAll`), since freshly-constructed elements defeat
`useShallow`'s one-level comparison.

**NotePanel + Markdown notes** (plan.md's Phase 8 notes plan, now implemented —
`client/src/scene/NotePanel.tsx`, `MarkdownContent.tsx`, `viewStore.ts`, `InfoPanel.tsx`,
`Overlay.tsx`; `NoteDialog.tsx` deleted)
Closes out the "notes are moving off the small-dialog pattern" item written up in the
previous session. Started from a question about Obsidian-style render-as-you-type
editing — assessed as a real CodeMirror undertaking (custom cursor-aware decorations
to hide/reveal markdown syntax), not attempted here. Landed on a much cheaper option
instead, and iterated on its exact shape with the user before writing code.
- New `NotePanel.tsx`: docked sibling of `SidePanel` in `Overlay.tsx`
  (`absolute inset-y-0 right-80 w-[28rem]`, flush against `SidePanel`'s left edge),
  not a modal — same motivation as the original plan (notes run 500-800 words, the
  shared `Dialog` primitive is a fixed 384px with no height cap). Retires
  `NoteDialog.tsx` entirely; its view/edit/pencil-toggle content moved in with panel
  chrome (own close button) instead of dialog chrome.
- "Which note is open" moved out of `NoteList`'s local `useState` into
  `viewStore.ts` as `openNote: { targetType, targetId, note: "new" | Note } | null`
  plus `openNoteFor`/`closeNote` actions — matches the plan exactly, needed since
  `NotePanel` mounts outside `NoteList`'s own subtree (as a sibling of `SidePanel`,
  not inside `InfoPanel`).
- New `MarkdownContent.tsx`: shared `react-markdown` + `remark-breaks` renderer
  (remark-breaks so a single Enter still breaks the line, rather than requiring a
  blank line like strict CommonMark) with custom per-element styling — headings,
  lists, links, inline/block code, blockquotes — hand-matched to the panel's existing
  typography rather than pulling in `@tailwindcss/typography` for a handful of tags.
  One fix needed: react-markdown v10 no longer tells the `code` renderer whether it's
  inline or fenced, so the inline-code background/padding is reset inside `pre` via a
  `[&>code]:bg-transparent [&>code]:p-0` arbitrary-child selector rather than a
  conditional prop that no longer exists.
- **Editor decision diverged from the original plan, via a real-time back-and-forth
  with the user.** The plan called for "editor stays a plain Textarea, no WYSIWYG."
  Asked whether Obsidian-style live-render-while-typing was feasible first — assessed
  as expensive (CodeMirror + custom decorations) and deferred. User then asked for a
  side-by-side edit/preview split; before that was built, they reconsidered mid-build
  and asked for "editing and preview as one pane" instead, which on clarification
  meant a GitHub-style Write/Preview toggle occupying one pane at a time, not
  simultaneous columns and not live-render-in-place. Implemented as two small buttons
  above the `Textarea` in `NotePanel`'s edit form, swapping between the raw `Textarea`
  and a `MarkdownContent` preview of the same `text` state — cheap, since it reuses
  the existing render pipeline and editor state with no new dependency beyond
  `react-markdown`/`remark-breaks` themselves.
- Seed data (`seed.ts`) was, at the time this was written, all plain lorem-ipsum prose
  with no markdown syntax in it — **superseded** by the seed-notes rewrite documented
  below.
- Verified: `tsc -b && vite build` clean, `oxlint` clean (pre-existing warnings only),
  all 94 tests passing (no test coverage added for the new UI itself — it's
  presentational, consistent with how the rest of `InfoPanel`'s editing surfaces are
  tested, i.e. not at all; only the pure-logic layer has unit tests per the
  open-questions note on testing strategy).
- **Follow-up styling pass** (`MarkdownContent.tsx`): `h1`/`h2`/`h3` all colored
  `text-primary`, matching how the rest of the panel already uses `text-primary` as
  an accent (badges, note titles). `ul`/`ol` markers got `marker:text-primary` too —
  only the bullet/number, not the item text itself, stays tinted; the arbitrary
  `marker:` variant lets that apply without touching `li`. `h1` was then resized from
  `text-base` to `text-xl` specifically to match `GroupDetails`'/
  `RelationshipDetails`' own title size in `InfoPanel.tsx`, so a note that uses `#` as
  its top-level heading reads at the same visual weight as the object title above it.

**Seed notes rewritten as Markdown** (not a plan.md phase — content,
`client/src/store/seed.ts`)
All ten seed notes' `text` swapped from Lorem Ipsum to real Markdown — headings,
ordered/unordered lists, bold/italic, inline code, fenced code blocks, blockquotes,
links, `hr` — so `MarkdownContent.tsx`'s full rendering surface is exercised by the
demo project without hand-typing test content, closing the "worth seeding one
demonstrative note" gap noted above. Content stayed topically relevant to each object
(space maintenance windows, orbit on-call rotations, entity known-issues, relationship
network paths/change history) rather than generic placeholder text.

**App-wide font-size consolidation to a 4-tier scale** (not a plan.md phase —
typography pass, `client/src/scene/MarkdownContent.tsx`, `NotePanel.tsx`, `Sidebar.tsx`,
`SidebarSearch.tsx`, `DeleteConfirmDialog.tsx`,
`client/src/components/ui/{dialog,button,select,combobox,dropdown-menu,context-menu}.tsx`)
User request: a floor of `text-sm` everywhere, with `text-xl` titles, `text-lg`
subtitles, `text-base` paragraphs, and `text-sm` badges/extra-info. Swept every
`text-xs` and sub-`sm` arbitrary size (`text-[0.8rem]`, `text-[0.85em]`) out of the
codebase.
- Titles bumped to `xl`: the shared `DialogTitle` primitive (was `text-base`, so this
  affects every dialog in the app at once), `NotePanel`'s note-title heading (was
  `lg`), and `Sidebar`'s project name (previously had no size class at all, so it was
  silently rendering at the browser's 16px default rather than anything in the scale).
- `MarkdownContent.tsx`'s heading scale re-tiered to match: `h1` stayed `xl`, `h2` went
  `base→lg` (subtitle), `h3` went `sm→base` (no tier lower than `base` remains once the
  floor is `sm`). Its outer container — the actual note-body paragraph text — went
  `sm→base`; inline `code`/`pre` switched from a relative `text-[0.85em]` (would've
  landed under the new `sm` floor once the container itself became `base`) to an
  explicit `text-sm`.
- Paragraphs bumped to `base`: `DeleteConfirmDialog`'s description line, the shared
  `DialogDescription` primitive, and `Sidebar`'s project-description line.
- Every remaining `text-xs` bumped to the new `sm` floor: menu shortcuts/group-labels
  in `dropdown-menu.tsx`/`context-menu.tsx`, `SelectLabel`, `ComboboxLabel`/chip text,
  `SidebarSearch`'s result-type tag, `Sidebar`'s two uppercase section headers, and
  `Button`'s `xs`/`sm` size variants (`text-xs`/`text-[0.8rem]` → `text-sm`; padding
  and height untouched, only the type size changed).
- Deliberately left alone: `Input`/`Textarea`'s `text-base` (+ `md:text-sm` at desktop
  widths) — a standard mobile-zoom-prevention pattern, already floor-compliant and
  orthogonal to the title/subtitle/paragraph/badge hierarchy this pass was about.
- Verified with `tsc --noEmit` (clean); no visual/browser check was possible this
  session (Claude in Chrome not installed, user declined).

**Note-list preview: Markdown rendering, active-row highlight, and a panel-close
coupling fix** (not a plan.md phase — UI polish + bug fix, `client/src/scene/InfoPanel.tsx`,
`SidePanel.tsx`)
- `NoteList`'s clamped row preview (in `InfoPanel.tsx`) now renders through
  `MarkdownContent` instead of plain clamped text — **reverses** the Phase 8 notes-plan
  decision documented above ("rendering and line-clamp don't combine cleanly, and it's
  a preview, not the view"); user asked for it explicitly, with the tradeoff called out
  up front (clamping can now cut mid-element — a truncated list item or an unclosed
  fenced code block — same as any "clamp rendered rich content" preview). Rendered at
  `text-sm` (smaller than `MarkdownContent`'s own `text-base` default, overridden via
  its `className` prop) since this is a preview row, not the full note view.
- The row for whichever note is currently open in `NotePanel` now stays `bg-accent/10`
  (the hover shade) rather than only lighting up transiently on hover — same "stay
  highlighted while it's the current thing" convention `SidebarTree.tsx` already uses
  for focus/active rows, driven by comparing `viewStore.openNote` against each row's
  `targetType`/`targetId`/note id.
- **Bug found and fixed**: `NotePanel` docks flush against `SidePanel`'s left edge
  (`right-80`, see the Phase 8 entry above), but `SidePanel`'s close button only ever
  called `clearActiveTab()` — closing the info panel while a note was open left
  `NotePanel` floating mid-screen with an empty 20rem gap where `SidePanel` used to be,
  since nothing tied the two panels' visibility together. Fixed by also calling
  `viewStore.closeNote()` from that same close-button handler — notes are only ever
  opened from inside `InfoPanel`, so scoping the note panel's lifetime to the info
  panel's was the simpler of two options considered (the alternative, repositioning
  `NotePanel` to dock at the true right edge when `SidePanel` is closed so it can float
  independently, was rejected in favor of this).

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

**Phase 8 — Editing UI** (delete, move, and notes/tags/metadata editing all done, see
above; still TODO:)
- Entity/space/orbit *repositioning*, this time scoped deliberately (the earlier drag
  implementation was removed, not replaced) — the last piece of Phase 8
- No origin field on space creation (see the Phase 8 part 1 entry above) — worth
  revisiting alongside repositioning, since right now a moved entity only visibly
  relocates if its old and new parent happen to have different origins

**Phase 9 — Persistence & export**
- Decided: persistence is server-backed — SQLite via Bun's native driver
  (`bun:sqlite`) accessed through drizzle-orm, living in the `server` package
  (currently an unused Hono skeleton). Not started; no schema, no drizzle config,
  no migrations yet.
- JSON serialize/deserialize (all note levels, metadata, tags) — still needed as the
  wire format even with a DB backing it, and/or for import/export independent of the
  server
- Flatten-to-orthographic export (PNG/PDF) at project/space/orbit scope

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
