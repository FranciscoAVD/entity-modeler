# Progress recap

Status as of 2026-08-11. Monorepo scaffolded (Bun workspaces: `client` Vite/React/R3F,
`server` Bun+Hono+SQLite/Drizzle, `shared` Zod schemas). Server-backed persistence is
live — see Phase 9 below. Phase 7 (3D auto-layout) is also now done — see below. 113
client tests + 6 server tests passing, build/lint clean in both packages. Full plan
lives in [plan.md](plan.md); build order is `0 → 1 → 2 → 3 → 5 → 4 → 6 → 7 → 8 → 9 →
10 → 11`.

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
- **`bun test` vs `bun run test` in `server/`**: `package.json`'s `test` script is
  `DB_FILE=:memory: bun test` — the env var is only set when invoked as `bun run test`.
  Running bare `bun test` directly (as a shortcut during verification) silently falls
  back to the real dev database (`server/data/app.db`) instead of an isolated in-memory
  one, so every test run writes real rows into the dev DB. Went unnoticed for several
  `bun test` invocations in one session before a routine curl-based verification turned
  up 19 stray "Test Project"/"Apple"/"Mango"/"Zebra" projects (the exact fixture names
  `persistence.test.ts` creates) alongside the one real "Demo Project" — confirmed as
  pure test pollution (no real project of those names had been created) and cleaned up
  by deleting `app.db` and letting `seedIfEmpty` reseed. Always use `bun run test` in
  `server/`, never bare `bun test`.
- **A `timeout`-wrapped background command can outlive the timeout**: `timeout 4 bun run
  --filter '*' dev` (used to verify the root `dev` script starts both packages) was
  assumed fully killed once the command returned "Terminated" — but `bun run --filter`
  spawns each package's own dev process (vite, the server) as children of a child,
  and `timeout` only guarantees killing the direct child it launched, not deeper
  descendants. One `vite` process, and the process that spawned it, survived in the
  background for the rest of the session undetected (a subsequent `ps aux | grep
  -E "vite|bun run|hono|--filter"` check, prompted by the user asking "are you running
  any dev servers?", should have caught this but apparently ran before the leak or
  missed it) — only surfaced later via a stray `bun run --hot` boot showing already-open
  ports. Cleaned up with `kill -9` on the specific PIDs (`pkill` pattern matching wasn't
  reliable here) and verified via both `ps aux` and a port check (`ss -ltn`). Lesson: a
  background verification command needs its *actual* child processes confirmed dead
  afterward, not just the wrapper command's own exit — check by PID/port, not just by
  re-running the same grep that already missed it once.

**Tags scoped per project, search scoped to the active project, and the tag registry UI**
(plan.md decision #11's remaining "planned but not built" item, now closed —
`client/src/store/types.ts`, `store.ts`, `selectors.ts`, `scene/TagEditor.tsx`,
`scene/TagBrowserDialog.tsx` (new), `scene/InfoPanel.tsx`, `scene/Sidebar.tsx`,
`scene/SidebarSearch.tsx`, `store/store.test.ts`, `plan.md`)
User-driven design change, planned out before writing any code (four separate commits,
one per stage) — starting point was "global tag creation/search" plus an explicit
requirement that tags be unique per project.
- **Data model: tag identity changed from global to project-scoped.** `Tag` gained a
  `projectId` field; identity is now `(projectId, name)` instead of one shared registry
  across every project — "billing" in two different projects now resolves to two
  independent `Tag` records rather than being silently merged into one. `resolveTagIds`
  (the "normalize on write" helper every `add*`/`update*Tags` action funnels through)
  now dedups within a project only; the `projectId` it needs is resolved from data
  already in scope at each of the 8 call sites (a space has it directly, orbit/entity/
  relationship walk up via their parent space or source entity) — no signature changes
  needed on `TagEditor` or any `InfoPanel.tsx` caller. `deleteProject`'s cascade gained
  a step to remove that project's own tags from the registry outright (previously a
  cascade-deleted object's tags were just orphaned-but-intact in the registry, reusable
  by other objects in the same project — but a project-scoped tag can never be
  referenced again once its project is gone). `renameTag` now throws on a same-project
  name collision — merging two tags into one on collision is a real edge case,
  deliberately left unhandled (tracked in plan.md's open questions).
- **Search scoped to the active project.** `searchByTitle`/`buildTagIndex`/
  `searchByTag`/`searchAll` (`selectors.ts`) all take a `projectId` now. Tag search
  scoping was a direct requirement of the data-model change (two projects sharing a tag
  *name* would otherwise conflate under one index key despite being independent tags);
  title search scoping was bundled into the same pass on request, closing a standing
  plan.md open question ("should search be scoped to the active project?") — leaving it
  unscoped would have read as inconsistent sitting next to a tag search that could no
  longer cross projects at all. `SidebarSearch.tsx` threads `projectId` through from
  `Sidebar.tsx`, which already had it.
- **New `TagBrowserDialog.tsx`**, reachable from a new "Browse tags" button in
  `Sidebar.tsx` (its own section, below Search): lists every tag in the current project
  with a live object count, each row expandable to the actual spaces/orbits/entities
  carrying it (via new selector `objectsForTag`) — clicking one focuses the camera and
  closes the dialog, same gating (`isSpaceVisible`/`isOrbitVisible`/`isEntityVisible`)
  and same `focusOn` call `SidebarSearch`'s result click already uses. Rename (pencil →
  inline `Input` + Check/X, same pattern as `MetadataEditor`'s row edit) wired to the
  existing `renameTag`, surfacing its new collision error inline rather than throwing
  uncaught; delete wired to the existing `deleteTag` behind the standard
  `DeleteConfirmDialog`. New selector `tagsInProject` (sorted by name) backs the list.
- **`TagEditor.tsx` gained autocomplete.** New optional `existingTags: string[]` prop
  (the project's full tag-name list) drives a filtered suggestion dropdown (capped at 6)
  below the add-tag input, so typing converges on the project's existing vocabulary
  instead of relying on `resolveTagIds`' case-insensitive dedup to catch
  near-duplicates after the fact — the other half of decision #11's "planned but not
  built" line. Selecting a suggestion needed `onMouseDown` + `preventDefault` on the
  suggestion button to fire before the input's existing `onBlur`-submits-the-draft
  handler, otherwise clicking a suggestion would submit whatever was still typed
  instead of the suggestion itself. Every `InfoPanel.tsx` call site
  (`EntityDetails`/`OrbitDetails`/`SpaceDetails`/`RelationshipDetails`) now resolves its
  own object's `projectId` (new selector `projectIdForOrbit` added for symmetry with
  the existing `projectIdForEntity`; `SpaceDetails` already has `space.projectId`
  directly) and passes `tagsInProject(...).map(t => t.name)` down as `existingTags`.
- Verified: `tsc -b`, `vite build`, and `oxlint` all clean; 101 tests passing (up from
  94), including new coverage for cross-project tag isolation, the rename collision
  guard (and that it doesn't false-positive across projects), `deleteProject`'s
  tag-registry cleanup, and the `tagsInProject`/`objectsForTag` selectors. No browser
  verification done this session (per standing preference — user verifies UI changes
  themselves).

**Tag search redesigned: folded into the sidebar search box, grouped by category** (plan.md
decision #11, further iteration on the previous session's tag-registry work — `client/src/store/
selectors.ts`, `scene/SidebarSearch.tsx`, `scene/TagObjectsDialog.tsx` (new),
`scene/TagBrowserDialog.tsx` (deleted), `scene/Sidebar.tsx`, `components/ui/combobox.tsx`,
`store/store.test.ts`, `plan.md`)
User-driven redesign, planned out via several rounds of clarifying questions before writing code
(what happens on a tag click, whether TagBrowserDialog survives, whether rename/delete UI
survives, whether projects stay in results, section order) — see the plan write-up in this
session's transcript for the full Q&A. One bug caught and fixed along the way, before the redesign
started: `TagBrowserDialog` (from the previous session) subscribed to `tagsInProject` directly as
a Zustand selector without `useShallow` — since it builds a fresh array every call (`filter` +
`sort`), that's the same "new reference every render" bug already documented for `searchAll`
below, causing an infinite render loop. Fixed by wrapping in `useShallow` (harmless once `tagsInProject` element identities are the actual stable `Tag` objects from the map) — but `TagBrowserDialog` itself was fully replaced a few messages later by this redesign, so the fix lives on now only in `TagObjectsDialog`'s equivalent code (as a `useMemo` over raw Maps instead, see below).
- **Tags are now their own top-level search category, not merged into the object list.**
  Previously, typing a tag name matched it *exactly* and merged the objects carrying it directly
  into the same flat result list as fuzzy title matches — indistinguishable from a title match
  once rendered. Redesigned: the search dropdown now shows up to four labeled sections — **Tags,
  Spaces, Orbits, Entities, tags always first, each section rendered only when it has ≥1 match**
  — built with `ComboboxGroup`/`ComboboxLabel`/`ComboboxCollection` (already present in
  `combobox.tsx`'s shadcn/base-ui scaffold, unused by the app until now). `ComboboxLabel`'s default
  style gained `uppercase tracking-wide font-medium` to match the app's existing section-header
  convention, since this was its first real usage.
- **Tag matching switched from exact to fuzzy (substring), matching titles.** `buildTagIndex`/
  `searchByTag` (the old exact-match inverted index) are gone; new `searchTags` does the same
  substring match `searchByTitle` already does, just against tag names. `searchAll` is now simply
  `[...searchTags(...), ...searchByTitle(...)]` — tags first, and — since a tag and a
  same-named space/orbit/entity are different categories now — never deduplicated against each
  other the way the old merged list had to be.
- **Projects dropped from search entirely.** `SearchResult.type` lost `"project"` (gained
  `"tag"`) — a project result never belonged in any of the four sections anyway, and project
  switching already has its own UI in the Header.
- **Clicking a Tag result doesn't focus the camera — a tag isn't a scene object.** It opens new
  `TagObjectsDialog.tsx`, listing the spaces/orbits/entities carrying it (via the existing
  `objectsForTag` selector, kept from the previous session). Picking one of *those* focuses the
  camera, mirroring `SidebarTree`'s exact row-click behavior — including, per explicit direction,
  the **cascading** visibility check (`isSpaceVisible`/`isOrbitVisible`/`isEntityVisible` from
  `visibility.ts`) rather than `SidebarTree`'s own slightly-inconsistent inline check (its
  `OrbitRow` only looks at the orbit's own hidden flag, not its parent space's — a discrepancy
  flagged and deliberately not matched here, though `SidebarTree` itself was left as-is).
  `objectsForTag`'s result is computed via a plain `useMemo` over the raw (stable) `spaces`/
  `orbits`/`entities` Maps rather than as a Zustand selector — `objectsForTag` builds fresh plain
  objects per match, so subscribing to it directly (even with `useShallow`) would hit the same
  class of infinite-loop bug just fixed in `TagBrowserDialog` (see above), since `useShallow`'s
  one-level comparison can't see past freshly-constructed *elements*, only a freshly-constructed
  *array* of stable elements.
- **`TagBrowserDialog.tsx` deleted; its rename/delete UI has no replacement yet** — explicit
  scope cut, tracked as a new plan.md open question. `TagObjectsDialog` is read-only.
  `renameTag`/`deleteTag` still exist and work at the store layer; only the UI trigger is gone.
  `Sidebar.tsx`'s "Tags" section / "Browse tags" button is gone too — search is now the only tag
  entry point.
- Test coverage rewritten: fuzzy/substring tag-name matching (including a shared-tag-dedup case:
  one `Tag` record tagged on both a space and an orbit still produces one search result, not two),
  tag-before-title ordering in `searchAll`, and a "projects never appear in results" assertion.
- Verified: `tsc -b`, `vite build`, and `oxlint` all clean; 102 tests passing. No browser
  verification done this session (per standing preference) — worth checking the grouped dropdown,
  the tag-click dialog, and that a hidden object's row inside that dialog is correctly
  non-clickable/greyed before treating this as done.

**`Entity` renamed to `Node` throughout the client project** (not a plan.md phase —
naming consistency, touches nearly every file in `client/src`; `plan.md` itself
updated to match, see below)
User-requested rename, closing a naming inconsistency that had been building for a
while: `plan.md`'s data model still called the type `Entity`, but user-facing UI text
had already drifted to "node" in several places (`Sidebar.tsx`'s create-dialog said
"New node"/"Node name", `SidebarTree.tsx`'s context-menu items said "Rename node"/
"Delete node") — this pass makes the internal identifiers match what the UI already
called the concept.
- Mechanical, not just the type: `Entity` (interface) → `Node`, `entities` (store Map)
  → `nodes`, and every derived identifier — `addEntity`/`deleteEntity`/`moveEntity`/
  `renameEntity`/`updateEntityTags`/`updateEntityMetadata`/`updateEntityPosition`
  (`store.ts`), `entitiesInSpace`/`entitiesInOrbit`/`ungroupedEntitiesInSpace`/
  `relationshipsForEntity`/`projectIdForEntity`/`entityDeleteImpact` (`selectors.ts`),
  `isEntityVisible` (`visibility.ts`), `EntityIcon`/`ENTITY_COLOR` (`SidebarTypeIcons.tsx`),
  the `"entity"` string-literal tags used for `TabType`/`NoteTargetType`/
  `GroupTargetType`/`FocusableType`/userData raycast tags, and the `--entity`/
  `--color-entity`/`bg-entity`/`text-entity` CSS custom properties and Tailwind
  classes (`index.css`). ~650 lines changed across 34 files, symmetric
  insertions/deletions (confirmed via `git diff --stat`) — every changed line was a
  1:1 rename, not a restructure.
- **File renames**: `EntityNode.tsx` → `Node.tsx`, `MoveEntityDialog.tsx` →
  `MoveNodeDialog.tsx`. `EntityNode.tsx`'s component was itself named after the old
  type (`Entity` the data → rendered as a "Node" in the graph sense) — once the data
  type became `Node` too, keeping a `Node` component in a `Node.tsx` file was a
  deliberate, explicit choice confirmed with the user (a type and a value can share an
  identifier in TS, resolved by position — `import type { Node } from "@/store/types"`
  alongside `function Node({ node }: { node: Node })` — rather than inventing a
  different name like `NodeSphere`/`NodeMesh` to sidestep the collision).
- Applied via a word-boundary-safe `sed` script (`\bEntity\b`/`\bentity\b` for
  standalone words, plain substring for camelCase compounds like `addEntity` since
  `Entity`'s capital `E` never collides with `identity`/`Identity` — lowercase `e`
  there), with `EntityNode` special-cased first so it collapsed to `Node` rather than
  doubling to `NodeNode`. Caught and fixed one class of bug the mechanical pass
  introduced: grammar drift on the indefinite article (`"an entity"` → `"an node"`,
  since "node" starts with a consonant sound) in several error messages and comments —
  swept separately after the main rename, `grep -rn "an node"` before/after used to
  verify.
- `plan.md` updated in the same pass — same rename applied throughout (data model,
  decision list, phase plan, open questions), including the doc's own title ("3D
  Entity Relationship Modeler" → "3D Node Relationship Modeler"). Unlike this file
  (a chronological log, left as-is for historical accuracy — old entries below still
  say "Entity" because that was its name at the time), `plan.md` documents current
  design only, so it was fully brought in line rather than partially.
- Verified: `tsc -b`, `vite build`, and `oxlint` all clean (same 4 pre-existing
  fast-refresh warnings as before, unrelated to this change); all 102 tests still
  passing, no test assertions needed updating beyond the mechanical rename itself. No
  browser verification done — purely a rename, no behavioral change.

**Phase 9 — Server-backed persistence** (plan.md's Phase 9, now implemented —
`shared/` (new package), `server/src/db/*`, `server/src/routes/projects.ts`,
`client/src/store/{api,serialize,persistence}.ts`, `client/src/store/store.ts`,
`client/src/App.tsx`, `client/src/scene/{Header,Overlay,SidebarTree}.tsx`,
`client/src/store/seed.ts` (deleted), `plan.md`)
Planned as an explicit layered plan (`/home/victoriano/.claude/plans/moonlit-knitting-crayon.md`)
before writing any code, with two architectural forks resolved with the user up front —
both material enough to change the shape of the whole plan, so worth restating here:
(1) write-sync is **debounced full-project autosave**, not ~30 individually-designed
per-mutation REST endpoints — the store stays the sole source of validation/cascade
truth, the server just persists whatever complete snapshot it's handed; (2) demo
seed data **moves server-side** (seeded into SQLite once, on first boot, if empty) —
`client/src/store/seed.ts` is gone, the client never fabricates data itself anymore.
Built and verified in six layers, each checked before the next started (typecheck +
tests at every layer; two `curl`-based server checkpoints before any client code
existed; full browser verification — headless Chromium via Playwright, load → switch
→ create → edit → reload — at the end, not just unit tests).
- **Layer 0 — `shared` package.** New workspace package (`shared/src/schemas.ts`),
  zero DB dependency (only `zod`), added to root `package.json`'s workspaces.
  Hand-written schemas mirror `client/src/store/types.ts` 1:1 — `Vector3Schema`,
  `NoteSchema`, `TagSchema`, `SpaceSchema`, `OrbitSchema`, `NodeSchema`,
  `RelationshipSchema`, `ProjectSummarySchema` — plus a composed `ProjectDetailSchema`
  (the nested tree: project → spaces → (orbits → nodes) + ungroupedNodes, with
  relationships/tags as flat siblings) used for both the `GET` response and the `PUT`
  request body, authored once for both directions. Types are `z.infer`'d, not
  hand-duplicated, so client and server can't drift apart.
- **Layer 1 — server DB layer.** `drizzle-orm`/`drizzle-kit` added; `db/schema.ts`
  defines one Drizzle table per type plus four join tables for the `tagIds`
  many-to-many (`space_tags`/`orbit_tags`/`node_tags`/`relationship_tags`) — a
  many-to-many can't be a plain array column in SQL the way it is in the client's
  normalized store. `notes` is one polymorphic table (`target_type` + `target_id`),
  matching decision #6's "same shape, same rendering path at every level" rather than
  four separate note tables. Every FK uses `onDelete: cascade` (or `set null` for a
  node's `orbitId`, mirroring `deleteOrbit`'s reassign-not-delete behavior) —
  explicitly a referential-integrity safety net only, not where cascade business
  logic lives (that stays 100% in `store.ts`, already tested — the server never
  re-implements it). `db/connection.ts` wires `bun:sqlite` + `drizzle()` and runs
  migrations (drizzle-kit-generated, checked into `server/drizzle/`) on every boot, so
  `bun run dev`/`start` stays one command rather than a separate manual migrate step.
  `db/seed.ts` ports `seed.ts`'s old demo content to direct Drizzle inserts, seeding
  once if `projects` is empty. DB file at `server/data/app.db`, gitignored.
- **Layer 2 — server read API.** `db/reads.ts`'s `loadProjectList`/`loadProjectDetail`
  reshape flat rows into the nested tree (grouping join-table rows back into
  `tagIds` arrays, notes by `targetId`, nodes by `orbitId`/`spaceId`), validated
  through `ProjectDetailSchema` before responding — catches a reshape bug at the
  boundary rather than shipping a malformed response. `GET /projects`, `GET
  /projects/:id` (404 if missing). **Checkpoint A**: curl-verified against a running
  `bun run dev:server` before any write code existed.
- **Layer 3 — server write API.** `db/writes.ts`'s `upsertProject` does one Drizzle
  transaction: gather the *old* target ids for this project first (notes have no FK
  to their target, so a cascade delete won't clean them up — has to be explicit),
  delete those notes, delete the `projects` row (cascades everything else per the
  Layer 1 FK rules), then bulk-insert the complete new snapshot. `PUT /projects/:id`
  is upsert (creates if missing, replaces if present — one route covers both "save a
  new project" and "autosave an edit"); `DELETE /projects/:id` exists too. **Checkpoint
  B**: full CRUD curl-verified (including a 400 on an invalid payload showing real Zod
  issue paths, and a row-count check proving a round-trip PUT doesn't duplicate
  anything) before touching the client. A proper test suite followed
  (`db/persistence.test.ts`, 5 tests against an isolated in-memory DB via
  `DB_FILE=:memory:`, including a deep `.toEqual` round-trip and a
  replace-not-merge check).
- **Layer 4 — client read integration.** `store.ts` gained one new action,
  `hydrateProject(detail)`, bulk-populating the five data Maps from a fetched
  `ProjectDetail` — merges by id rather than replacing, so switching projects
  accumulates data rather than evicting what's already loaded (plan.md: "once
  fetched, stays in the store"). `store/serialize.ts`'s `serializeProject` is the
  inverse, walking the flat Maps back into the nested tree via the *existing*
  selectors (`spacesInProject`, `nodesInOrbit`, `ungroupedNodesInSpace`,
  `tagsInProject`, etc.) — no new query logic. `App.tsx`'s bootstrap rewritten from a
  synchronous `useState(() => seedDemoProject())` to an async flow: fetch the project
  list, load+hydrate the first one, loading/empty/error states in between. A
  `loadedProjectIds` ref (not state — never needs to trigger a re-render) tracks
  what's already hydrated so re-selecting a project in the Header's switcher doesn't
  re-fetch it. `Header.tsx`'s "New project" flow changed from `addProject` +
  `onProjectChange` to a new `onCreateProject` prop (threaded through
  `Overlay.tsx`) that does `addProject` then an *immediate*, non-debounced `PUT` —
  without it, closing the tab right after creating a project would lose it entirely,
  since the Layer 5 autosave hasn't had its first debounce cycle yet.
- **Layer 5 — client write integration (autosave).** `store.ts`'s `create<...>()`
  gained zustand's `subscribeWithSelector` middleware. New `store/persistence.ts`'s
  `useAutosave(projectId)` subscribes to just the five data Maps with a `shallow`
  equality check — critical, since `openTabs`/`activeTabId` live in the same store
  and must *not* trigger a save (view/session state, never persisted). ~1s after the
  last change, `flush()` serializes and `saveProject`s; a pending flush is run (not
  dropped) on project-switch or unmount rather than silently losing an edit still
  waiting on the debounce. A small "Saving…"/"Saved"/"Save failed" indicator was
  added to `Header.tsx`, backed by a new `saveStatus` field on `viewStore.ts` (view
  state, not model data — same reasoning as `focusTarget`/`openNote` already living
  there). **Checkpoint C**: full browser round-trip — rename a node via the sidebar,
  watch the indicator, reload the page in a fresh browser context, confirm the rename
  survived — plus an independent `curl` check (a separate process, after the browser
  closed) proving it's real server-side durability, not just optimistic client state.
- **Bug found and fixed along the way, unrelated to persistence itself**: browser
  testing (Playwright driving headless Chromium — no `chromium-cli` available in this
  environment, so `playwright`'s `chromium` module was used directly, matching the
  `run` skill's documented fallback) surfaced a React console warning —
  `SidebarTree.tsx`'s space list used a bare `<>...</>` fragment as the element
  returned from `.map()`, with `key` mistakenly placed on the child `SpaceRow`
  instead of the fragment itself (a bare fragment can't take props at all). Silent
  until this session, since no prior session had actually opened devtools console —
  every previous UI change was verified structurally (typecheck/build/tests) but "no
  browser verification done this session" is a recurring note throughout this file.
  Fixed with `Fragment` (from `"react"`) + `key={space.id}`.
- Verified end-to-end: `tsc`/`typecheck` clean in all three packages; `vite build`
  clean; `oxlint` clean (same 4 pre-existing fast-refresh warnings, unrelated); all
  102 existing client tests pass unmodified (no store business logic changed — the
  whole point of the autosave-over-per-mutation-endpoints decision); 5 new server
  tests pass. Full manual browser verification as described above, zero console
  errors in the final run.
- `plan.md`'s Phase 9 section rewritten to match what's actually built (was "not
  started — architecture decided, no implementation yet"); this file's Phase 8 TODO
  bullet also picked up a small stale-terminology fix (still said "Entity" from before
  last session's rename — missed then since that pass deliberately left this file's
  *historical* entries alone, but the TODO section is forward-looking, not history, so
  it should have followed).
- **Not built this pass, explicitly deferred**: flatten-to-orthographic export (PNG/
  PDF) — separate Phase 9 line item; `serializeProject` gives it a head start later.
  Auth — decision #14 (single-user) still holds. Retry/offline-queue robustness for a
  failed autosave — logs to console, no retry/backoff, matching "single-user,
  low-stakes local tool" scope. A delete-project UI — the action and route both exist
  and work, just no UI entry point (wasn't one before this pass either).

**Notes moved off the polymorphic table; per-note metadata removed entirely** (follow-up
to Phase 9's persistence pass, same session — `server/src/db/{schema,writes,reads}.ts`,
`shared/src/schemas.ts`, `client/src/store/{types,store,store.test}.ts`,
`client/src/scene/{InfoPanel,NotePanel}.tsx`, `plan.md`)
User-driven correction, caught right after the persistence walkthrough above: the original
`notes` table used `targetType`/`targetId` with no real FK (called out in decision #6 of
plan.md as matching "same shape at every level" across four note-bearing types), which meant
`upsertProject` had to manually gather a project's old space/orbit/node/relationship ids
before every delete just to clean up their notes — the exact workaround a real FK exists to
avoid. Fixed in two parts, both confirmed with the user before writing code.
- **Notes stay one table, not four** (rejected the alternative of a dedicated table per
  type, matching the join-table pattern tags already use) — instead `notes` gained four
  nullable FK columns (`spaceId`/`orbitId`/`nodeId`/`relationshipId`, each `onDelete:
  cascade`), exactly one set per row depending on which type the note belongs to. This is
  an app-level invariant (enforced by how `writes.ts` builds the insert rows), not a DB
  `CHECK` constraint — same "app layer owns the invariant" convention the rest of the
  schema already follows. `upsertProject`'s manual pre-delete step is gone entirely —
  deleting a space/orbit/node/relationship now cascades its notes automatically via
  whichever FK column matches. `reads.ts`'s `loadProjectDetail` queries the table once with
  an `OR` across the four FK columns, then groups into four maps (`notesBySpace`/
  `notesByOrbit`/`notesByNode`/`notesByRelationship`) instead of one `notesByTarget`.
- **Per-note `metadata` removed entirely**, at every level, not just relationships. This
  extends the reasoning already applied to relationship notes last session (decision #6's
  CIDR/VLAN example moved from a per-note bag to the relationship's own object-level
  metadata) to Space/Orbit/Node notes too — metadata is now exclusively an object-level
  concept (decision #11), never a per-note one. Removed from `Note` in both
  `shared/src/schemas.ts` and `client/src/store/types.ts`, from `addNote`'s signature and
  the now-pointless relationship-note-metadata-rejection guard in `store.ts` (nothing can
  carry note metadata anymore, so there's nothing to reject), from the `notes` table itself
  (no `metadata` column), and from the two rendering sites that displayed it
  (`InfoPanel.tsx`, `NotePanel.tsx`). Two now-meaningless tests deleted from
  `store.test.ts` ("rejects metadata on a relationship note" / "allows metadata on a
  space/orbit/node note") — 102 → 100 client tests.
- **Migration generated by hand**, not via `drizzle-kit generate`'s normal interactive
  flow — the column-shape change (`targetType`/`targetId`/`metadata` → four nullable FK
  columns) makes `drizzle-kit` prompt interactively ("was this column renamed?"), which
  requires a TTY this environment doesn't have. Used `drizzle-kit generate --custom` to
  get an empty migration file without triggering the prompt, hand-wrote the actual
  `DROP TABLE` + `CREATE TABLE` SQL to match `schema.ts`, then discovered `--custom`
  had *not* actually updated `meta/0001_snapshot.json` to reflect the new schema (it
  silently carried the old `notes` shape forward) — patched that snapshot by hand
  (columns + `foreignKeys` entries, matching the format of neighboring tables in the same
  file) and confirmed a subsequent `drizzle-kit generate` reports "No schema changes,
  nothing to migrate", proving the hand-patched snapshot is now actually in sync with
  `schema.ts` for future diffing.
- No existing data to migrate — `server/data/app.db` didn't exist yet in this checkout
  (gitignored, never created locally), so this was a clean schema addition rather than a
  wipe-and-reseed of real content.
- Verified: server test suite (5 tests, including the deep round-trip test covering notes
  at every level) passes against the new schema; `tsc --noEmit` clean in `server`; client
  `tsc -b && vite build` clean; `oxlint` clean (same 4 pre-existing fast-refresh warnings,
  unrelated); 100 client tests passing. No browser verification done this session (per
  standing preference — user verifies UI changes themselves).

**Recently-viewed moved from the Header dropdown into the sidebar search box** (closes a
plan.md open question logged two sessions ago — `client/src/scene/{SidebarSearch,
SidebarTypeIcons,Header}.tsx`, `TabBar.tsx` (deleted), `client/src/store/selectors.ts`,
`plan.md`)
User-requested relocation, two design points confirmed up front before writing code: (1)
the Header's standalone "Recently viewed" `Select` (`TabBar.tsx`) is removed outright, not
kept as a second entry point; (2) picking a recently-viewed item from the search box keeps
its *old* behavior — fly the camera **and** open the side panel (`setActiveTab`, decision
#12) — rather than switching to the camera-only `focusOn` every other search result uses.
- `SidebarSearch.tsx`'s combobox `open` state is now controlled locally, with the input's
  `onFocus` forcing it open — previously fully uncontrolled, relying on base-ui's own
  defaults, which is also why `openOnInputClick={false}` existed (to stop an empty query
  from popping an empty "No results." on click); that prop is gone now that opening on an
  empty query is the whole point.
- When the query is empty, the dropdown shows a single "Recently viewed" section built
  from `openTabs` (newest first, same order `TabBar` used) instead of the four Tags/
  Spaces/Orbits/Nodes sections, which return empty on a blank query anyway. Typing
  anything reverts to the existing search behavior unchanged.
- Recently-viewed entries can include relationships, which `SidebarSearch` never rendered
  before (no name field, no sidebar row — decision #11 explicitly keeps them out of *text*
  search). Modeled as a `RecentItem` (`Tab` + `kind: "recent"` + a precomputed `label`,
  since relationships need `tabLabel`'s endpoint-based fallback, not a plain `name` field)
  unioned with the existing `SearchResult` as the combobox's value type, discriminated via
  a `"kind" in item` guard everywhere the two need different handling (key, label, click
  behavior).
- New `RelationshipIcon` in `SidebarTypeIcons.tsx`, needed since relationships now appear
  in this list — deliberately a neutral/muted badge rather than a fixed hue, since
  relationships already have no fixed color identity anywhere else in the app (their edge/
  title color depends on scope — local/cross-orbit/cross-space — not a signature hue like
  Space/Orbit/Node have).
- `selectors.ts`'s `tabLabel` had its parameter type relaxed from the full `ModelState` to
  `Pick<ModelState, "nodes" | "orbits" | "spaces" | "relationships">` — the only fields it
  actually reads — so `SidebarSearch` can call it without threading the whole store
  through; matches the same `Pick<...>` pattern `objectsForTag` already uses in the same
  file. Existing callers (`TabBar`'s `TabOption` used to pass a full reactive `state`)
  keep working unchanged, since `ModelState` structurally satisfies the narrower type.
- `plan.md` updated in several places: decision #12, the selection-model section, the
  click-to-reveal flow section, and Phase 6's status line all described a Header dropdown
  that no longer exists; the matching open-questions entry ("SidebarSearch shows nothing
  until you start typing…") is removed outright now that it's resolved.
- Verified: `tsc -b && vite build` clean; `oxlint` clean (same 4 pre-existing warnings,
  unrelated); 100 tests passing (no test coverage added for this UI itself, consistent
  with how the rest of `SidebarSearch`/`InfoPanel` are — presentational, not unit-tested).
  No browser verification done this session (per standing preference).

**Bug fix: relationships now appear in TagObjectsDialog** (`client/src/store/selectors.ts`,
`client/src/scene/TagObjectsDialog.tsx`, `client/src/store/store.test.ts`, `plan.md`)
User report: clicking the seeded "vpn" tag in search (a Tags result) showed "Nothing
tagged," even though the demo project's cross-space relationship (Ungrouped Node → Remote
Node) visibly carries that exact tag in its own info panel. Root cause: `objectsForTag`
only ever scanned spaces/orbits/nodes — relationships were excluded by a deliberate scope
cut from the tag-search redesign two sessions ago (plan.md decision #11: "no name field to
show as a result, no sidebar row"). Since "vpn" happens to be tagged only on the
relationship itself in the seed data, not on either endpoint node, the dialog had nothing
to show.
- That original exclusion reasoning no longer fully applied — relationships already have a
  synthesizable label (endpoint-based, the same fallback `tabLabel` uses for the
  recently-viewed list added earlier this session), `focusOn` already accepts
  `"relationship"` as a `FocusableType`, and `isRelationshipVisible` already existed in
  `edgeVisibility.ts` for edge rendering. Nothing was actually missing to support this —
  it just hadn't been wired into this one dialog.
- `objectsForTag` extended to also walk `state.relationships`, pushing a `{ type:
  "relationship", name: "Source → Target" }` result; `SearchResult.type` widened to
  include `"relationship"` (verified this doesn't break the two places that switch
  exhaustively over it — `SidebarSearch.tsx`'s `ResultIcon` already handled it via its
  `Tab["type"]` union half, `TagObjectsDialog.tsx`'s `ObjectIcon` gained a new case using
  the `RelationshipIcon` built for the recently-viewed feature).
- `TagObjectsDialog.tsx`'s `selectObject` gained an `isRelationshipVisible` branch
  alongside the existing space/orbit/node visibility gate, so a relationship whose
  endpoint is currently hidden won't attempt to focus the camera at it, consistent with
  every other result type in this dialog.
- Still explicitly out of scope, unchanged: relationships still don't participate in
  *title* search and still have no sidebar row of their own — only the tag-carrier lookup
  gained them, since that's the one place a missing relationship reads as a broken tag
  rather than an intentionally narrower search surface.
- New test: `objectsForTag also resolves relationships, labeled by their endpoints` in
  `store.test.ts`. `plan.md` decision #11 and the search-architecture section updated to
  match (the old "relationships still aren't part of tag search" line was flatly wrong
  once this landed).
- Verified: `tsc -b && vite build` clean; `oxlint` clean (same 4 pre-existing warnings);
  101 tests passing (up from 100). No browser verification done this session (per standing
  preference) — worth clicking the "vpn" tag in the demo project to confirm the
  relationship now shows up and focuses correctly.

**Bug fix: the project loaded on boot could silently change between reloads**
(`server/src/db/reads.ts`, `server/src/db/persistence.test.ts`)
User report: "different seeded data on reload." Not actually different seed content —
`loadProjectList()`'s `db.select().from(projects)` had no `ORDER BY`, so SQLite's scan
order (rowid order for a plain table scan) was whatever it happened to be, and
`upsertProject`'s autosave path deletes and reinserts the `projects` row itself on every
save (necessary so the FK cascade can clear that project's spaces/orbits/nodes/
relationships) — giving the row a new rowid and moving it to the end of that unordered
scan. `App.tsx` always loads `list[0]` on boot with nothing persisting "last active
project" (no `localStorage` use anywhere in the client), so with more than one project in
the switcher, whichever one loads by default could flip after *any* edit to *any*
project — reading exactly like the seed data itself was changing.
- Fixed with `.orderBy(asc(projects.name))` — deterministic, and reasonable default
  behavior for a project switcher regardless of this bug.
- New regression test in `persistence.test.ts`: creates three projects, re-saves one
  (triggering the delete+reinsert), asserts the list stays alphabetically ordered rather
  than reflecting save order.
- Deliberately not fixed here, out of scope: `upsertProject` still deletes+reinserts the
  `projects` row on every save (that's structural to the "full-project replace via FK
  cascade" design, not a bug) — only the missing ordering was the actual defect.
- Verified: server `tsc --noEmit` clean, 6/6 server tests passing (up from 5).

**Wire format flattened — `ProjectDetail` is five flat sibling arrays, not a nested tree**
(`shared/src/schemas.ts`, `client/src/store/{serialize,store}.ts`, `client/src/store/
selectors.ts`, `server/src/db/{reads,writes,seed}.ts`, `server/src/db/persistence.test.ts`,
`plan.md`)
User-driven design critique: both the client's store and the server's SQL schema already
store this data flat/normalized (decision #15 — parent references point up via id fields,
no nested child arrays), yet the wire format (`ProjectDetailSchema`) nested
`spaces → orbits → nodes` — the one place in the whole system doing tree-shaping, and
purely wasted work, since it was built on every save (`serializeProject` walking nested
selectors) and immediately undone again on every load (`loadProjectDetail`'s
`nodesByOrbit`/`ungroupedNodesBySpace`/`orbitsBySpace` groupBy-and-rebuild). It was also
already inconsistent with itself — `relationships`/`tags` were flat siblings in the same
schema, only spaces/orbits/nodes were nested.
- `ProjectDetailSchema` reduced from a nested tree to `{ project, spaces, orbits, nodes,
  relationships, tags }` — five flat arrays, each object keeping its existing parent-id
  field (`Orbit.spaceId`, `Node.spaceId`/`orbitId`) exactly as it's stored everywhere
  else. `OrbitDetailSchema`/`SpaceDetailSchema` (the nested-variant types) are gone.
- `client/src/store/serialize.ts`'s `serializeProject` dropped from a three-level nested
  `.map()` walk to five straight selector calls (`spacesInProject`, `nodesInProject`,
  `relationshipsInProject`, `tagsInProject`, and a new `orbitsInProject` added to
  `selectors.ts` — same "in project" pattern `nodesInProject` already used, just missing
  for orbits until now).
- `client/src/store/store.ts`'s `hydrateProject` simplified from a nested walk that
  manually reconstructed each Space/Orbit object field-by-field (to strip out the
  now-gone `orbits`/`ungroupedNodes`/`nodes` wire-only fields) to five flat `for` loops,
  each just `map.set(x.id, x)` — the same shape `tags`/`relationships` were already
  hydrated with before this change, now consistent across all five types.
- `server/src/db/writes.ts`'s `upsertProject` lost the `flatOrbits`/`flatNodes`
  flattening step entirely (`data.spaces.flatMap((s) => s.orbits)` etc.) — every
  reference just reads `data.orbits`/`data.nodes` directly now, since they arrive flat.
- `server/src/db/reads.ts`'s `loadProjectDetail` lost its nested-rebuild machinery
  (`toNodeDetail`/`toOrbitDetail`/`toSpaceDetail` and the `nodesByOrbit`/
  `ungroupedNodesBySpace`/`orbitsBySpace` groupBy calls) in favor of three flat mappers
  (`toNode`/`toOrbit`/`toSpace`) applied directly to each table's query rows.
- `server/src/db/seed.ts`'s demo project data un-nested to match — same tags/notes/
  metadata content as before, just spaces/orbits/nodes as three top-level arrays instead
  of two levels of inline nesting.
- `persistence.test.ts` updated to build/assert the flat shape; `minimalProject`'s base
  defaults gained `orbits: []`/`nodes: []` alongside the existing `spaces: []`.
- **Two unrelated problems found during end-to-end verification, both fixed in the same
  pass** (see "Notable bugs" below for the full write-up): (1) a `vite` + dev-server
  process from an earlier session verification had been running in the background,
  undetected, since a `timeout`-wrapped command's grandchildren outlived the timeout;
  (2) repeated bare `bun test` invocations in `server/` this session (instead of
  `bun run test`) had been writing real rows into the actual dev database
  (`server/data/app.db`) instead of an isolated in-memory one, leaving 19 stray test-
  fixture projects behind it. Both cleaned up: processes killed by PID and verified via
  `ps`/`ss`, database wiped and reseeded clean (confirmed as pure test pollution — no
  real project matched those fixture names — before deleting).
- Verified end-to-end against a real running server (not just unit tests): booted fresh,
  `GET /projects` and `GET /projects/:id` both confirmed to return the new flat shape
  (top-level keys `project`/`spaces`/`orbits`/`nodes`/`relationships`/`tags`, no `orbits`
  key nested inside a space), counts matched the demo project exactly (2 spaces, 2
  orbits, 4 nodes, 3 relationships, 6 tags), server then fully stopped and confirmed via
  both process list and port check. Also: server `tsc --noEmit`, shared `tsc --noEmit`,
  client `tsc -b && vite build`, and `oxlint` all clean (same 4 pre-existing warnings);
  6/6 server tests and 101/101 client tests passing (both unchanged in count — this pass
  didn't add or remove test cases, just reshaped what they assert against).

**Phase 7 — 3D auto-layout, built** (`client/src/scene/{autoLayout,bounds,Node}.ts(x)`,
`client/src/store/store.ts`, `client/src/store/{store,selectors}.test.ts`,
`client/src/scene/{bounds,cameraFocus}.test.ts`, `plan.md`)
Closes the last unstarted phase on the roadmap. Planned via several rounds of clarifying
questions before writing code, since the design space had real forks:
- **Positions are never user-set — the only structural lever a user has is choosing a
  parent.** User's own framing, stated directly: "a user should not be able to decide
  where an object physically sits within a parent. the user can only decide who the
  parent is." This reverses plan.md's original Phase 7 line ("manual drag position
  always overrides auto-layout") — there's no manual position concept left to override.
  Confirmed explicitly: node/space/orbit repositioning-via-drag (Phase 8's last
  remaining item, and Phase 5's reverted drag attempt) is not coming back, ever — the
  only "repositioning" is re-parenting via the existing `MoveNodeDialog` ("Move to...").
- **Hand-rolled, not a library** — d3-force-3d was discussed and picked first, then
  reconsidered once "trigger-only, not continuous/animated" was clarified: d3-force's
  main value (Barnes-Hut repulsion at scale, tuned real-time damping) doesn't matter for
  small graphs recomputed once per structural change with no animation. Landed on a
  small damped relaxation (repulsion + spring-along-relationships + centering, built on
  the existing `client/src/lib/vector3.ts` helpers) instead — avoids the dependency and
  the data-shape bridging a d3-force integration would need (it mutates plain
  `{x,y,z,vx,vy,vz}` objects; this store uses immutable `Vector3` records).
- **Automatic, not a button, no scoped/partial re-layout, no "locked position" flag** —
  all three were explicitly ruled out in favor of the simplest option consistent with
  "the user cannot decide position": `store.ts` calls `autoLayoutProject` at the end of
  every action that changes topology, whole-project each time.
- New `client/src/scene/autoLayout.ts`: `layoutGroup` (the reusable core primitive —
  settle a list of entities + weighted links, optionally clamped within a container
  radius) and `autoLayoutProject` (orchestrates three cascading tiers: nodes within each
  orbit; each space's orbits-as-blobs + ungrouped-nodes-as-points together; spaces
  within the project, unconstrained). Deterministic golden-angle-spiral starting
  positions (not `Math.random()`) so layout is reproducible for the same input — matters
  for testing, and avoids the "two entities start exactly coincident, repulsion has no
  defined direction" degenerate case.
- **Architectural care taken to keep the data layer separate from the renderer** (plan.md
  decision #5): `autoLayout.ts` needed the same node-sphere radius rendering uses
  (`NODE_RADIUS`, previously defined in `Node.tsx`, a React/R3F component) to keep
  physics and visuals consistent — importing it directly would have pulled a scene
  component into `store.ts`'s dependency graph. Moved `NODE_RADIUS` into `bounds.ts`
  (already React-free, already the "sizing" home for `orbitRadiusForNodeCount`/
  `spaceRadiusForChildren`, split out from the existing `computeOrbitRadius`/
  `computeSpaceRadius` as plain count → radius functions so `autoLayout.ts` doesn't need
  a full `ModelState` just to re-derive a count it already has); `Node.tsx` now imports
  and re-exports it, so `RelationshipEdge.tsx`'s existing import path keeps working
  unchanged.
- **Removed as genuinely dead code, not kept "just in case"**: `updateNodePosition`
  (store action) — no manual-positioning concept left for it to serve; the optional
  `position`/`origin` params on `addNode`/`addOrbit`/`addSpace` — confirmed via grep
  that no UI code ever passed them, only test fixtures did, so nothing user-facing
  changed; `moveNode`'s "preserve world position across the move" re-basing math — moot,
  since `autoLayoutProject` recomputes the position from scratch immediately after based
  on the new topology, so re-parenting is now just a field reassignment.
- **Bigger test-rewrite footprint than initially scoped**: since every `addSpace`/
  `addOrbit`/`addNode`/`addRelationship`/`moveNode`/delete-* call now triggers a
  relayout, tests that previously hand-placed exact coordinates via `origin`/`position`
  params (to test `getWorldPosition`/`getOrbitWorldOrigin`/camera-focus math, or to
  prove `bounds.ts`'s radius formulas ignore position) broke — not just in
  `store.test.ts` as originally estimated, but also `cameraFocus.test.ts` and
  `bounds.test.ts`. Fixed by patching state directly via `useModelStore.setState(...)`
  after structural setup (which bypasses the action layer entirely, so no relayout
  fires) wherever a test needs exact, known coordinates — arguably a cleaner test
  pattern anyway, since it no longer conflates "does this pure resolution/rendering
  logic work" with "did the action layer happen to produce this exact position."
- New `autoLayout.test.ts`: structural-property tests, not exact-coordinate assertions
  (brittle against tuning changes) — a single entity centers itself, nothing exceeds its
  container's radius, connected entities end up closer than unconnected ones,
  unconnected entities don't collapse onto the same point, objects outside the given
  project are left untouched, orbits with a relationship between their nodes end up
  closer together than orbits with none.
- Verified: `tsc -b && vite build` clean, `oxlint` clean (same 4 pre-existing warnings),
  109 client tests passing (up from 101 — 9 new in `autoLayout.test.ts`, plus a handful
  of rewritten/consolidated tests elsewhere netting out close to even). No browser
  verification done this session (per standing preference).
- `plan.md` rewritten throughout: Phase 7 (now done), Phase 5 and Phase 8's stale
  "drag/repositioning not implemented yet" framing (now "ruled out permanently, not
  deferred"), the hit-detection section's drag-repositioning note, and the Phase 8
  move-node bullet (no longer re-bases position itself).

**Auto-layout tuning: one horizontal plane, no more clustering near the origin**
(`client/src/scene/autoLayout.ts`, `autoLayout.test.ts`, `plan.md`)
User feedback after trying Phase 7: objects should prefer landing on the same horizontal
plane (panning/zooming across it is much easier than hunting above or below it), and
unrelated objects were bunching up near the origin instead of spreading out.
- **Flat plane, no damping term needed.** `seedPosition` switched from a full
  golden-angle *sphere* (`y` ranging -1..1) to a flat golden-angle *spiral* (`y=0` for
  every entity, spread only in x/z) — a "sunflower" disc packing (`ringRadius =
  sqrt((index+0.5)/count)`) for even area density. Turned out no separate y-damping
  force was needed at all: every force in `layoutGroup` (repulsion, spring, centering)
  is derived purely from *relative* positions with no external "up" bias, so once every
  input starts at y=0, every direction vector derived from those positions also has
  y=0 — nothing ever pulls an entity off the plane, for the lifetime of the simulation.
  New tests assert this literally (`pos.y === 0`, no tolerance needed) at both the
  `layoutGroup` primitive and the full `autoLayoutProject` cascade.
- **Root cause of the origin-clustering**: the *unconstrained* tier (spaces within a
  project — the only tier with no parent shell to seed within) scaled its initial seed
  spread off `entities.length` alone (`entities.length * 0.5`) — for a handful of
  spaces, 1-2 units, tiny against real space radii (2-10+ via `computeSpaceRadius`).
  Spaces started deep inside each other, and the existing repulsion force (tuned for
  local separation, not broad redistribution) was never going to undo that on its own —
  it mostly just enforces a minimum resting distance, not a "spread out to fill the
  available room" pressure. Fixed by scaling the fallback spread off the entities' own
  total radius instead (`Math.max(totalRadius * 0.6, 4)`).
- **`SEPARATION_PADDING` bumped 0.5 → 2.5** — this constant sets the resting-distance
  floor between any two entities (`radius + radius + padding`), and turned out to be the
  main lever controlling how much breathing room the *settled* layout has, not just
  whether it visually overlaps: repulsion decays fast enough (`1/dist²`) that once two
  entities clear this floor, there's little pushing them any further apart, so the old
  0.5 value meant everything settled right at (or barely past) bare non-overlap — reads
  as "clustered" even with zero actual overlap.
- New tests in `autoLayout.test.ts`: unconstrained entities end up meaningfully spread
  (not just non-overlapping) relative to their own size; the same, end-to-end, through
  `autoLayoutProject` for a project's spaces; y=0 for every layout output at both the
  primitive and orchestration level. One test initially failed against a `+2` margin
  (actual: `+1.97`) — rather than loosen the assertion to match, tightened
  `SEPARATION_PADDING` instead, since the test was catching a real "not quite enough
  breathing room" gap worth fixing at the source.
- Verified: `tsc -b && vite build` clean, `oxlint` clean (same 4 pre-existing warnings),
  113 client tests passing (up from 109 — 4 new). No browser verification done this
  session (per standing preference) — this one in particular is worth eyeballing, since
  "does the layout actually look right" isn't something the structural-property tests
  can fully confirm on their own.

## TODO — remaining phases

**Phase 9 — Persistence** (read/write, seeding, migrations, and autosave all done, see
below; export still TODO)
- Flatten-to-orthographic export (PNG/PDF) at project/space/orbit scope — the one
  remaining Phase 9 item; `client/src/store/serialize.ts`'s `serializeProject` (built
  for autosave) already knows how to flatten one project's full data, a head start
  for whatever export format ends up needed
- A delete-project UI — `deleteProject` (store) and `DELETE /projects/:id` (server)
  both exist and work, just have no UI entry point (project deletion had none before
  this pass either, so this isn't a regression, just a standing gap)
- Retry/offline-queue robustness for a failed autosave `PUT` — currently just logs to
  console, no retry/backoff, deliberately matching "single-user, low-stakes local
  tool" scope (plan.md decision #14)

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
