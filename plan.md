 3D Entity Relationship Modeler — Project Plan
Key design decisions

1. True 3D rendering Entities and relationships exist in free 3D space, grouped into spaces, with orbits as an optional single-level sub-grouping within a space (no nested orbits). Core mitigations:

Billboarded text for all labels, offset far enough from anchor geometry to avoid rotational overlap
Depth cues — fog, distance-based opacity/size falloff
Curved (Bezier) edges, with distinct styling for cross-space and cross-orbit edges

2. Node geometry: spheres, title-only by default Entities render as plain spheres with only their title shown by default; fields/notes/metadata are click-to-reveal.

3. Label placement: offset to avoid rotational overlap Labels anchored at a fixed radial offset from their anchor's center, recomputed each frame toward the camera, positioned just outside the anchor's silhouette. Applies to entity titles, edge titles, and orbit/space labels.

4. Three visibility tiers

Space-level info: always visible
Orbit-level info: label always visible while its parent space is in view; notes/metadata click-to-reveal
Node and edge info: title always visible; full details click-to-reveal

5. Data model is separate from the renderer Project/Space/Orbit/Entity/Relationship/Note live in a plain data structure; the three.js scene is one view over that data. This gives undo/redo, JSON export, and alternate render targets (e.g. flattened 2D export) without touching core logic.

6. Notes: freeform + optional structured metadata, at five levels Project, Space, Orbit, Entity, and Relationship all carry independent notes[]. Each note is primarily free text, with an optional metadata bag for structured cases (e.g. an edge representing a subnet: { cidr: "10.0.4.0/24", vlan: 12 }), rendered as a small key-value table alongside the prose. Same shape, same rendering path at every level.

7. Relationships can cross spaces and orbits, and survive entity moves sourceId/targetId reference entities globally by id. If an entity moves to a different space or orbit, its relationships are never severed or auto-deleted — they simply re-render with updated styling (e.g. an edge that was intra-space may become cross-space after a move). Relationship lifetime is tied only to its own existence, not to its endpoints' current location.

8. No self-relationships An entity cannot have a relationship where sourceId === targetId. Enforced at creation time (API throws/rejects rather than silently allowing it).

9. Cascading deletes Deleting a space deletes everything scoped to it: its orbits, its entities, and any relationship where either endpoint was one of those entities (since a relationship can't exist with a dangling endpoint). This is the one case where relationships do get removed — moving an entity keeps relationships intact; deleting its space does not.

10. Nodes must belong to a space; orbit is optional There's no "orphan" entity — the API enforces a parent space at creation time (space.addEntity(...)), with an optional orbit assignment (orbit.addEntity(...) or space.addEntity(..., { orbitId })) for tighter grouping.

11. Search: tagged keywords + universal title search

Spaces and orbits can carry a tags: string[] field — user-defined keywords, indexed separately for fast lookup (e.g. tagging a space "prod" or "external-facing")
All objects (spaces, orbits, entities, relationships) are searchable by title/name via a simpler substring/fuzzy match, without needing explicit tagging
Tags are a space/orbit-only concept (grouping-level metadata), while title search is universal across every object type

12. Multi-selection via tabs

Selecting a node/edge/orbit opens a tab (rather than replacing the current selection), so multiple objects can be inspected side by side
Clicking a tab flies the camera to that object — animated (tweened, ease-in-out, ~400–800ms), never an instant snap, to preserve spatial orientation
Closing a tab clears that object's selection state; if it was active, the next open tab (or none) becomes active
A "reset view" control exists independent of tabs, returning to a full-project overview, so users aren't trapped at node-level zoom after opening several tabs

13. Empty space/orbit rendering Tinted, transparent, color-coded spheres/ellipsoids — space, orbit, and entity each get a distinct hue or saturation level so nesting is visually obvious at a glance. For empty groups specifically:

Minimum bounding-volume size so an empty group is never too small to see or click
Dashed or reduced-opacity boundary to distinguish "empty" from "populated," at a glance and from a distance
Label remains always-visible even at zero members
Optional "+" affordance inside the boundary if used as an authoring tool

14. Single-user for now No concurrent editing/collaboration concerns in this version of the plan; the reactive store can stay simple (no CRDT/conflict resolution needed yet).

15. Normalized data model — flat collections, parent references point up Rather than nesting children as arrays inside their parents (Project.spaces: Space[]), every object holds a reference up to its parent by id (Space.projectId), consistent with how Relationship.sourceId/targetId already work. The store holds flat, id-keyed collections (Map<id, T> per type); "children of X" (spaces in a project, entities in a space, etc.) are computed queries/indices, not stored arrays. This avoids the two-sided sync problem of keeping a parent's child array and a child's parent pointer both correct — especially important since entities already move between spaces/orbits, and a project list/switcher UI means projects need to be loaded and displayed independently of their full contents.

Data model
Project {
  id, name, description?,
  notes: Note[]
}

Space {
  id, projectId,             // ← points up to parent Project
  name, label?, origin: Vector3,
  tags: string[],
  notes: Note[],
  metadata?: Record<string, string | number>
}

Orbit {
  id, spaceId,                // ← points up to parent Space
  name, label?, origin: Vector3,   // local to parent space's origin
  tags: string[],
  notes: Note[],
  metadata?: Record<string, string | number>
}

Entity {
  id, spaceId, orbitId?,      // ← points up to parent Space, optionally an Orbit
  name, fields: Field[], position: Vector3,  // local to parent space's (or orbit's) origin
  notes: Note[]
}

Field {
  id, name, type, isPK?, isFK?
}

Relationship {
  id, sourceId, targetId,     // must differ — no self-relationships; may span different orbits/spaces
  cardinality: "1:1" | "1:N" | "N:M",
  notes: Note[]
}

Note {
  id, text, author?, createdAt,
  metadata?: Record<string, string | number>
}

Store shape: flat maps per type — projects, spaces, orbits, entities, relationships — each keyed by id. "Children of X" views (e.g. spacesInProject(projectId), entitiesInSpace(spaceId), entitiesInOrbit(orbitId)) are derived by filtering/indexing these maps on demand, optionally backed by a maintained parentId -> Set<childId> index for performance, rather than being a second source of truth to keep in sync.

Validation rules enforced by the API/store layer (not just types):

sourceId !== targetId on relationship creation
Entity creation always requires a spaceId (and optionally orbitId)
Deleting a Space cascades: delete the Space record, delete all Orbit/Entity records where spaceId matches, then delete Relationship records where sourceId/targetId matched any deleted entity
Moving an entity between spaces/orbits is a field update (entity.spaceId = ..., entity.orbitId = ...) — no array surgery, and it never touches Relationship records
An entity's effective world position resolves by walking up: entity.orbitId → orbit.origin (if assigned) + entity.spaceId → space.origin + entity.position
Loading a project (e.g. for a project list/switcher) requires only Project records — spaces/orbits/entities are pulled in lazily by filtering on projectId once a project is opened, not eagerly nested inside it
Selection, tabs & search architecture

Selection model

openTabs: { id, type: "entity" | "relationship" | "orbit" }[]
activeTabId: string | null
Clicking a node/edge/orbit adds a tab (if not already open) and makes it active
Making a tab active triggers an animated camera fly-to centered on that object
Closing a tab removes it from openTabs and clears its selection highlight; if it was active, the next tab (or none) becomes active
A separate "reset view" action clears camera focus and flies to a default overview position, without necessarily closing tabs

Search

Text input matches against: space/orbit tags (exact/keyword index) and all object name fields (fuzzy/substring)
Selecting a search result behaves like a click: opens a tab, flies camera to it
Tag index is a simple inverted index (tag -> [space/orbit ids]), rebuilt or incrementally updated on tag edits
Rendering: visibility by tier
Object	Always visible	Revealed on click	Empty-state treatment
Space	name/label, tint boundary	notes, metadata, tags	dashed/low-opacity boundary, min size floor
Orbit	name/label (dimmer), tint boundary	notes, metadata, tags	same as space, nested inside it
Entity	title only, offset-billboarded sphere	fields, notes, metadata	n/a (entities aren't containers)
Relationship	title only (if present)	cardinality, notes, metadata	n/a
Click-to-reveal / tab architecture

Hit detection (raycasting)

Nodes: raycast against sphere meshes, keyed via userData.entityId
Edges: raycast against invisible "hit tube" meshes (cylinder/tube geometry) running alongside each visible curved line — gives a generous, consistent click target regardless of visual line thickness
Orbits: raycast against a light bounding volume (shell/disc) for orbit-level notes/metadata reveal
Spaces: not part of the reveal flow (info is always-on), but still selectable for drag/move purposes

Flow

Click → raycast → resolve { id, type } → open/focus tab → look up record → emit select event
DOM tab bar + panel: tab bar lists open selections (title + type icon), panel below shows the active tab's full info (title, fields for entities, cardinality for relationships, notes as prose, metadata as key-value table)
In-scene highlight (outline shader, emissive pulse) on whichever object the active tab represents
Vector3.project() available for optional in-scene panel anchoring near the clicked object's screen position

Space labels render as a persistent, lower-emphasis billboarded label rather than going through the select/reveal flow — always visible, not gated behind a click. Project-level notes are surfaced via a persistent "project info" panel/button rather than a 3D click target, since there's no single geometry representing "the whole project."

Phase plan

Phase 0 — Scope & spike

1 space with 2 orbits (a few nodes each) plus one ungrouped node, one intra-orbit edge, one cross-orbit edge, one relationship that survives a manual "move entity to another space" test
Empty-state test: one deliberately empty orbit, rendered per the tinted/dashed treatment
Tab bar with 2+ open tabs, clicking between them triggers animated camera fly-to
Validates label-tier visual hierarchy, orbit hit-testing, relationship persistence through entity moves, empty-group rendering, and tab/camera UX — before deeper investment

Phase 1 — Core data model

Project/Space/Orbit/Entity/Field/Relationship/Note as above, with tags on Space/Orbit
Normalized store: flat Map<id, T> per type, parent references point up (Space.projectId, Entity.spaceId/orbitId), no nested child arrays
Derived "children of X" queries/indices (spacesInProject, entitiesInSpace, entitiesInOrbit) computed from the flat maps, optionally cached via a maintained parentId -> Set<childId> index
Validation rules: no self-relationships, entities always require a space, cascade delete logic
openTabs/activeTabId in the store instead of a single selection slot
Reactive store (pub-sub, Zustand, or similar) so the scene reacts to model changes rather than being mutated directly
Position resolution helper (getWorldPosition(entity)) walking up via orbitId/spaceId lookups
Tag index and title index for search
Project list/switcher: load Project records independently of their spaces/orbits/entities, which are fetched lazily by projectId once a project is opened

Phase 2 — Space & orbit rendering

Tinted, transparent, color-coded bounding volumes for spaces and orbits, visually distinguishable by nesting level
Empty-state treatment (dashed boundary, min size, always-visible label)
origin transforms applied correctly through the space → orbit → entity chain
Per-space and per-orbit visibility toggles

Phase 3 — Node rendering

Sphere geometry per entity, billboarded title at computed offset (radial, camera-facing, clipping-safe)
Instancing strategy for larger schemas

Phase 4 — Edge rendering + hit tubes

Visible curved (Bezier) line + paired invisible hit-tube mesh per relationship
Billboarded title at curve midpoint, offset perpendicular to the curve
Distinct styling for same-orbit / cross-orbit / cross-space edges
Cardinality markers (billboarded) at endpoints

Phase 5 — Camera & interaction

OrbitControls for orbit/pan/zoom
Unified raycasting across spheres + hit-tubes + orbit bounds → tab-open dispatch
Animated camera fly-to on tab activation; independent "reset view" control
Camera-plane-constrained dragging for repositioning entities (modifier key for depth movement)

Phase 6 — Tabs, notes & search UI

Tab bar (open/close/switch), info panel generic across entity/relationship/orbit
Space info stays a separate always-on label (not this panel)
Search input (tags + titles), results open tabs like clicks do
If authoring tool: add/edit/delete note UI, including metadata key-value editing, writing back to the data model at any level

Phase 7 — 3D auto-layout

Force-directed layout within each orbit first, then orbits arranged within their parent space, then spaces arranged within the project — a layout hierarchy mirroring the data hierarchy
Shell/sphere constraint option at each tier to keep things navigable
Manual drag position always overrides auto-layout once set, at entity, orbit, or space level

Phase 8 — Editing UI

Add/edit/delete projects, spaces, orbits, entities, fields, relationships, notes/metadata, tags
Move entity between spaces/orbits (re-parenting, re-basing position to the new local origin) — relationships persist automatically per the data model rule
Delete space/orbit — cascade confirmation UI, since this is destructive and touches relationships

Phase 9 — Persistence & export

JSON serialize/deserialize including all note levels, metadata, and tags
Export: since 3D doesn't screenshot cleanly, include a "flatten to top-down orthographic" mode for PNG/PDF snapshots, selectable at project, space, or orbit scope

Phase 10 — Performance polish

LOD for text/geometry at distance, frustum culling, instancing for repeated geometry, worker-based layout computation for large graphs, visibility culling of hidden spaces/orbits

Phase 11 — Packaging & API

Public API (new ERModeler(container, options), .addProject(), .addSpace(), space.addOrbit(), space.addEntity() / orbit.addEntity(), .on('select', ...), .search(query), etc.) — note the API shape itself enforces the "nodes must belong to a space" rule
Framework wrapper (React) if needed, docs, example schemas (e.g. a "company network" space with "DMZ" and "internal" orbits, plus a "cloud services" space)
Single-user assumption documented as a current constraint (not designed for concurrent editing yet)

Build order: 0 → 1 → 2 → 3 → 5 → 4 → 6 → 7 → 8 → 9 → 10 → 11 — spaces/orbits come right after the data model since nodes are meaningless without a parent coordinate frame; camera/interaction comes before edges to get things visible and clickable early; everything else follows dependency order.

Open questions / things to revisit later
Multi-select bulk operations (bulk-move, bulk-delete, bulk-tag) beyond the tab pattern
Long-title truncation/wrapping rules for billboarded labels
Formal color/material scheme per nesting level (beyond "tinted, color-coded")
Undo/redo implementation depth (history stack vs. relying solely on the reactive store)
Testing strategy for raycasting/hit-detection and layout correctness (visual regression, scripted-camera screenshots)
Revisit collaboration/concurrent editing if multi-user need arises later
