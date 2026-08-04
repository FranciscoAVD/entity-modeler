 3D Entity Relationship Modeler — Project Plan
Key design decisions

1. True 3D rendering Entities and relationships exist in free 3D space, grouped into spaces, with orbits as an optional single-level sub-grouping within a space (no nested orbits). Core mitigations:

Billboarded text for all labels, offset far enough from anchor geometry to avoid rotational overlap
Depth cues — fog, distance-based opacity/size falloff
Curved (Bezier) edges, with distinct styling for cross-space and cross-orbit edges

2. Node geometry: spheres, title-only by default Entities render as plain spheres with only their title shown by default; tags/notes/metadata are click-to-reveal.

3. Label placement: offset to avoid rotational overlap Labels anchored at a fixed radial offset from their anchor's center, recomputed each frame toward the camera, positioned just outside the anchor's silhouette. Applies to entity titles, edge titles, and orbit/space labels.

4. Three visibility tiers

Space-level info: always visible
Orbit-level info: label always visible while its parent space is in view; notes/metadata click-to-reveal
Node and edge info: title always visible; full details click-to-reveal

5. Data model is separate from the renderer Project/Space/Orbit/Entity/Relationship/Note live in a plain data structure; the three.js scene is one view over that data. This gives undo/redo, JSON export, and alternate render targets (e.g. flattened 2D export) without touching core logic.

6. Notes: freeform + optional structured metadata, at four levels Space, Orbit, Entity, and Relationship all carry independent notes[] — this originally included Project too, but notes are exclusively a Space/Orbit/Entity/Relationship concept, so Project never gets one. Each note is primarily free text; Space/Orbit/Entity notes additionally support an optional per-note metadata bag for structured cases (e.g. a space representing a subnet: { cidr: "10.0.4.0/24", vlan: 12 }), rendered as a small key-value table alongside the prose — this bag is read-only in the UI (set via seed data only), separate from the object-level tags/metadata editing described in decision #11 and Phase 8. Relationship notes are prose-only — no per-note metadata bag, enforced at creation time (addNote throws if a relationship note is given metadata); a relationship's own object-level metadata (decision #11) is the place for that kind of structured data instead.

7. Relationships can cross spaces and orbits, and survive entity moves sourceId/targetId reference entities globally by id. If an entity moves to a different space or orbit, its relationships are never severed or auto-deleted — they simply re-render with updated styling (e.g. an edge that was intra-space may become cross-space after a move). Relationship lifetime is tied only to its own existence, not to its endpoints' current location.

8. No self-relationships An entity cannot have a relationship where sourceId === targetId. Enforced at creation time (API throws/rejects rather than silently allowing it).

9. Cascading deletes Deleting a space deletes everything scoped to it: its orbits, its entities, and any relationship where either endpoint was one of those entities (since a relationship can't exist with a dangling endpoint). This is the one case where relationships do get removed — moving an entity keeps relationships intact; deleting its space does not.

10. Nodes must belong to a space; orbit is optional There's no "orphan" entity — the API enforces a parent space at creation time (space.addEntity(...)), with an optional orbit assignment (orbit.addEntity(...) or space.addEntity(..., { orbitId })) for tighter grouping.

11. Search: tagged keywords + universal title search

Spaces, orbits, entities, and relationships can all carry tags — user-defined keywords, indexed separately for fast lookup (e.g. tagging a space "prod", an orbit "core", or an entity "billing" so it can be found alongside unrelated objects sharing that tag). This was originally a space/orbit-only concept; it's since been extended to entities, then relationships too — relationships also gained an optional metadata bag alongside tags, same shape as space/orbit/entity's own object-level metadata (distinct from the per-note metadata bag in decision #6, which relationships still don't get)
Tags are normalized: a shared Tag { id, name } registry (a flat Map<id, Tag>, same pattern as every other collection per decision #15) is the single source of truth for tag names, and each space/orbit/entity/relationship stores a tagIds: string[] referencing it rather than duplicating free-typed strings. Editing UI still reads/writes tags by name (TagEditor takes/returns string[] of names) — the store resolves a typed name against the registry on write, reusing an existing tag (matched case-insensitively) or creating a new one, so typing "Billing" and "billing" on two different objects converges on one shared tag rather than two near-duplicates. renameTag(tagId, name) updates that one registry record and every object referencing it picks up the new name for free (no array surgery across objects); deleteTag(tagId) removes the registry entry and strips the id out of every tagIds array that held it, the same "no dangling reference" rule used elsewhere (decision #9)
Projects, spaces, orbits, and entities are searchable by title/name via a simpler substring/fuzzy match, without needing explicit tagging — relationships are excluded since they have no name field
Tag search and title search stay conceptually separate (exact-match keyword index vs. fuzzy substring match), but both now cover the same three taggable/nameable object types (space/orbit/entity) plus project for title search — the tag index itself resolves tagIds through the registry, so a rename is reflected in search immediately. Relationships have tags too but aren't part of tag search yet (no name field to show as a result, no sidebar row) — deliberately deferred, not a gap in the normalization itself
Planned but not built: a UI for the tag registry itself — autocomplete/typeahead against existing tag names while typing in TagEditor (so users converge on the shared vocabulary instead of relying on the case-insensitive dedup catching near-duplicates after the fact), and a browsable/renameable global tag list. The data-model and store-action groundwork for both (the Tag registry, renameTag, deleteTag) is in place; only the UI surface is still missing

12. Multi-selection via tabs

A single click on a node/edge/orbit/space only moves the camera (focus-only, same as a sidebar row click); a double-click opens a tab (rather than replacing the current selection), so multiple objects can be inspected side by side — spaces were originally excluded from tabs entirely (see below), but now participate identically to orbits/entities
Clicking a tab flies the camera to that object — animated (tweened, ease-in-out, ~400–800ms), never an instant snap, to preserve spatial orientation
Tabs are no longer a user-managed open/close list — this originally had an explicit "close tab" action, but a row of removable chips got cluttered fast with more than a couple objects open. openTabs is now a recency-capped history (the 5 most recently viewed objects, oldest evicted automatically), presented as a single dropdown rather than a chip row. An object's tab is only removed early if the object itself is deleted (cascade), in which case the next remaining tab (or none) becomes active
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
  id, name, description?
}

Space {
  id, projectId,             // ← points up to parent Project
  name, label?, origin: Vector3,
  tagIds: string[],           // ← references the shared Tag registry, not free-typed strings
  notes: Note[],
  metadata?: Record<string, string | number>
}

Orbit {
  id, spaceId,                // ← points up to parent Space
  name, label?, origin: Vector3,   // local to parent space's origin
  tagIds: string[],
  notes: Note[],
  metadata?: Record<string, string | number>
}

Entity {
  id, spaceId, orbitId?,      // ← points up to parent Space, optionally an Orbit
  name, tagIds: string[], position: Vector3,  // local to parent space's (or orbit's) origin
  notes: Note[],
  metadata?: Record<string, string | number>
}

Relationship {
  id, sourceId, targetId,     // must differ — no self-relationships; may span different orbits/spaces
  cardinality: "1:1" | "1:N" | "N:M",
  tagIds: string[],
  notes: Note[],
  metadata?: Record<string, string | number>
}

Note {
  id, title, text, author?, createdAt,
  metadata?: Record<string, string | number>
}

Tag {
  id, name
}

Entity originally had a fields: Field[] property (Field being { id, name, type, isPK?, isFK? }) modeling database-table columns. That's been removed: a field with no value is a schema declaration, not an attribute of a specific entity instance, which is a narrower assumption (this tool models general entities/relationships, not specifically database schemas — see plan.md's own network-topology example schema under Phase 11) than this tool intends. Entity now carries tags/metadata directly instead, same shape as Space/Orbit.

Project originally had a notes: Note[] property too. That's been removed — notes, tags, and metadata are exclusively a Space/Orbit/Entity/Relationship concept; Project never gets an editing surface for any of them.

tags: string[] was originally stored inline on Space/Orbit/Entity(/Relationship) as free-typed strings, duplicated per object with no shared identity — renaming a tag meant editing it independently everywhere it appeared, and two objects tagging the same concept ("Billing" vs "billing") had no way to be recognized as the same tag. Normalized per decision #11: each of those types now carries tagIds: string[] instead, referencing the flat Tag registry below.

Store shape: flat maps per type — projects, spaces, orbits, entities, relationships, tags — each keyed by id. "Children of X" views (e.g. spacesInProject(projectId), entitiesInSpace(spaceId), entitiesInOrbit(orbitId)) are derived by filtering/indexing these maps on demand, optionally backed by a maintained parentId -> Set<childId> index for performance, rather than being a second source of truth to keep in sync. The tags map is the one collection not scoped under a parent — tags are shared vocabulary across the whole store, not owned by any single project/space/etc.

Validation rules enforced by the API/store layer (not just types):

sourceId !== targetId on relationship creation
Entity creation always requires a spaceId (and optionally orbitId)
Deleting a Space cascades: delete the Space record, delete all Orbit/Entity records where spaceId matches, then delete Relationship records where sourceId/targetId matched any deleted entity
Moving an entity between spaces/orbits is a field update (entity.spaceId = ..., entity.orbitId = ...) — no array surgery, and it never touches Relationship records
Deleting a Tag cascades the other direction from Space's cascade: the Tag record is removed, then every Space/Orbit/Entity/Relationship whose tagIds included it has that id stripped out — no dangling tagId ever survives in a tagIds array
An entity's effective world position resolves by walking up: entity.orbitId → orbit.origin (if assigned) + entity.spaceId → space.origin + entity.position
Loading a project (e.g. for a project list/switcher) requires only Project records — spaces/orbits/entities are pulled in lazily by filtering on projectId once a project is opened, not eagerly nested inside it
Selection, tabs & search architecture

Selection model

openTabs: { id, type: "entity" | "relationship" | "orbit" | "space" }[] — a recency-capped history (5 most recently viewed, oldest evicted), not a user-managed open/close list; see decision #12
activeTabId: string | null
A single click on a node/edge/orbit/space in the 3D scene only moves the camera (via the same focusOn/focusTarget mechanism a sidebar row click uses) — it does not add a tab. Double-clicking adds it to openTabs (moving it to most-recent if already present) and makes it active
Making a tab active triggers an animated camera fly-to centered on that object
There's no manual "close" of the openTabs history itself — an entry only leaves openTabs early if its underlying object is deleted (cascade), in which case the next remaining tab (or none) becomes active; otherwise it just ages out once 5 newer objects have been viewed. The side panel's own visibility is a separate concern: a close button clears activeTabId (clearActiveTab) without touching openTabs, so the panel can be dismissed and later reopened at the same point via the Header's "Recently viewed" select
A separate "reset view" action clears camera focus and flies to a default overview position, without necessarily affecting openTabs

Search

Text input matches against: space/orbit/entity tags (exact/keyword index) and all nameable object name fields (fuzzy/substring)
Selecting a search result flies the camera to it, same as a single click on a sidebar row or 3D-scene object — it does not open a tab (opening a tab requires a double-click in the 3D scene, or the sidebar row's "View notes" context-menu item)
Tag index is a simple inverted index (tag -> [space/orbit/entity ids]), rebuilt or incrementally updated on tag edits
Rendering: visibility by tier
Object	Always visible	Revealed on click	Empty-state treatment
Space	name/label, tint boundary	notes, metadata, tags	dashed/low-opacity boundary, min size floor
Orbit	name/label (dimmer), tint boundary	notes, metadata, tags	same as space, nested inside it
Entity	title only, offset-billboarded sphere	notes, metadata, tags	n/a (entities aren't containers)
Relationship	title only (if present)	cardinality, notes, tags, metadata	n/a
Click-to-reveal / tab architecture

Hit detection (raycasting)

Nodes: raycast against sphere meshes, keyed via userData.entityId
Edges: raycast against invisible "hit tube" meshes (cylinder/tube geometry) running alongside each visible curved line — gives a generous, consistent click target regardless of visual line thickness
Orbits: raycast against a light bounding volume (shell/disc) for orbit-level notes/metadata reveal
Spaces: raycast against the same kind of light bounding volume as orbits — spaces are now fully part of the reveal/tab flow (this reverses an earlier decision to exclude them; see the closing note below). Drag/move repositioning is unimplemented for every object type so far, not just spaces (tracked under Phase 5)

Flow

Click → raycast → resolve { id, type } → focus camera only (single click) or open/focus tab (double-click) → look up record → emit select event
DOM tab bar + panel: the tab bar is a single dropdown (recently-viewed history, title + type icon per option) rather than a row of open-selection chips, panel below shows the active tab's full info (title, tags/metadata for spaces/orbits/entities, cardinality for relationships, notes as prose, metadata as key-value table)
In-scene highlight on whichever object the active tab represents — currently a static emissive/opacity bump (entity emissive color, edge width/opacity, space/orbit boundary opacity via an `active` prop), not yet an outline shader or an animated pulse
Vector3.project() available for optional in-scene panel anchoring near the clicked object's screen position — not implemented yet

Space labels remain a persistent, lower-emphasis billboarded label regardless of click state — always visible, never gated behind a click. This originally meant spaces skipped the select/reveal flow entirely; that part is now reversed (see the hit-detection note above) — the space's boundary is a click target too: a single click flies the camera to it, a double-click opens a tab whose panel shows the space's tags/metadata/notes, same as an orbit. Project never gets this treatment — Project.notes has been removed from the data model entirely (see the data model section above), so there's no "project info" panel/button to build, planned or otherwise.

Phase plan

Phase 0 — Scope & spike (done)

1 space with 2 orbits (a few nodes each) plus one ungrouped node, one intra-orbit edge, one cross-orbit edge, one relationship that survives a manual "move entity to another space" test
Empty-state test: one deliberately empty orbit, rendered per the tinted/dashed treatment
Tab bar with 2+ open tabs, clicking between them triggers animated camera fly-to
Validates label-tier visual hierarchy, orbit hit-testing, relationship persistence through entity moves, empty-group rendering, and tab/camera UX — before deeper investment

Phase 1 — Core data model (done — the project switcher is a dropdown rather than a dedicated list/grid page, functionally equivalent to what's described below)

Project/Space/Orbit/Entity/Relationship/Note/Tag as above, with normalized tagIds on Space/Orbit/Entity/Relationship referencing the shared Tag registry
Normalized store: flat Map<id, T> per type, parent references point up (Space.projectId, Entity.spaceId/orbitId), no nested child arrays
Derived "children of X" queries/indices (spacesInProject, entitiesInSpace, entitiesInOrbit) computed from the flat maps, optionally cached via a maintained parentId -> Set<childId> index
Validation rules: no self-relationships, entities always require a space, cascade delete logic
openTabs/activeTabId in the store instead of a single selection slot
Reactive store (pub-sub, Zustand, or similar) so the scene reacts to model changes rather than being mutated directly
Position resolution helper (getWorldPosition(entity)) walking up via orbitId/spaceId lookups
Tag index and title index for search
Project list/switcher: load Project records independently of their spaces/orbits/entities, which are fetched lazily by projectId once a project is opened

Phase 2 — Space & orbit rendering (done)

Tinted, transparent, color-coded bounding volumes for spaces and orbits, visually distinguishable by nesting level
Empty-state treatment (dashed boundary, min size, always-visible label)
origin transforms applied correctly through the space → orbit → entity chain
Per-space and per-orbit visibility toggles

Phase 3 — Node rendering (partially done — instancing not started, explicitly deferred to Phase 10 in code)

Sphere geometry per entity, billboarded title at computed offset (radial, camera-facing, clipping-safe)
Instancing strategy for larger schemas

Phase 4 — Edge rendering + hit tubes (done)

Visible curved (Bezier) line + paired invisible hit-tube mesh per relationship
Billboarded title at curve midpoint, offset perpendicular to the curve
Distinct styling for same-orbit / cross-orbit / cross-space edges
Cardinality markers (billboarded) at endpoints

Phase 5 — Camera & interaction (partially done — drag-to-reposition not implemented; updateEntityPosition exists in the store but has no UI trigger)

OrbitControls for orbit/pan/zoom
Unified raycasting across spheres + hit-tubes + orbit bounds → tab-open dispatch
Animated camera fly-to on tab activation; independent "reset view" control
Camera-plane-constrained dragging for repositioning entities (modifier key for depth movement)

Phase 6 — Tabs, notes & search UI (done — add/edit/delete note UI was scoped out of the initial pass and delivered later under Phase 8's work instead, see below)

Tab bar is now a recently-viewed Select (switch only, no manual open/close — see decision #12), info panel generic across entity/relationship/orbit/space, with entity/orbit/space sharing one GroupDetails renderer since they're now the same shape (tags, metadata, notes)
Space info now goes through this same panel (SpaceDetails) rather than staying a separate always-on label-only affordance — this reverses the line's original assumption, see the reveal-flow note above
Search input (tags + titles); results fly the camera like a sidebar-row click, not a full tab-open — see the Search section above
Add/edit/delete note UI, including metadata key-value editing, writing back to the data model at any level — built, but as part of Phase 8's editing-UI pass rather than in this one

Phase 7 — 3D auto-layout (not started — no layout algorithm exists; bounds.ts is a static count-based sizing heuristic, not a layout)

Force-directed layout within each orbit first, then orbits arranged within their parent space, then spaces arranged within the project — a layout hierarchy mirroring the data hierarchy
Shell/sphere constraint option at each tier to keep things navigable
Manual drag position always overrides auto-layout once set, at entity, orbit, or space level

Phase 8 — Editing UI (mostly done — add, rename, delete-with-cascade-confirmation, move-entity, and notes/tags/metadata editing UI all exist; entity/space/orbit repositioning is the remaining piece, deliberately deferred)

Add/edit/delete projects, spaces, orbits, entities, relationships, notes/metadata, tags
Move entity between spaces/orbits (re-parenting, re-basing position to the new local origin) — relationships persist automatically per the data model rule
Delete space/orbit — cascade confirmation UI, since this is destructive and touches relationships

Phase 9 — Persistence & export (not started — architecture decided below, no implementation yet)

Persistence is server-backed: SQLite via Bun's native driver (bun:sqlite), accessed through drizzle-orm, living in the `server` package (currently an unused Hono skeleton) — resolves the "local-only vs. server-backed" open question in progress.md in favor of server-backed

New `shared` workspace package (sibling to `client`/`server`, added to root package.json's workspaces) holds the wire contract: hand-written Zod schemas plus their inferred TS types, zero Drizzle dependency (only `zod`) so it can never accidentally pull a DB driver into the client bundle. Per-record schemas (ProjectSchema, SpaceSchema, OrbitSchema, EntitySchema, RelationshipSchema, NoteSchema, TagSchema) mirror the domain shapes already in client/src/store/types.ts (Vector3 as {x,y,z}, tagIds: string[], cardinality as a literal union) rather than raw DB rows, plus two composed response schemas: ProjectListResponseSchema and ProjectDetailResponseSchema (see response shape below). Because these are hand-authored to the domain shape rather than derived from the DB schema, adapting a response into the client's store is mostly containment-flattening (walking the nested tree into separate Map<id,T> collections), not field-by-field reshaping

`server` owns Drizzle entirely — `shared` has no idea it exists. `db/schema.ts` defines one table per type (projects, spaces, orbits, entities, relationships, notes, tags) plus four join tables for the tagIds relations (space_tags, orbit_tags, entity_tags, relationship_tags), since a many-to-many can't be a plain array column in SQL the way it is in the client's normalized store; notes are one polymorphic table (target_type + target_id) rather than four, matching decision #6's "same shape, same rendering path at every level"; Vector3 fields flatten to _x/_y/_z columns; metadata stays a JSON column since it's explicitly freeform. `db/connection.ts` does the actual bun:sqlite + drizzle() wiring. Route handlers query via Drizzle's relational `with` joins, then reshape the raw rows into `shared`'s schema form (reassembling {x,y,z} from columns, tagIds arrays from join-table rows) before responding — drizzle-zod may still be used internally here for insert/update validation against the DB schema, but that's a server-only implementation detail invisible to `shared`/`client`

Two endpoints for now: GET /projects (flat list — id/name/description only, matches the existing "project switcher needs only Project records" rule) and GET /projects/:id (one project at a time — the nested join: { project: {...spaces: [{...orbits: [{...entities}]}]}, relationships: [...], tags: [...] } — relationships and tags are flat siblings rather than nested inside entities, since a relationship isn't owned by any single container and tags are a shared registry, not per-entity data)

Client fetch flow: GET /projects/:id → parse the response through ProjectDetailResponseSchema (runtime validation, not just compile-time types, matching the "validate at boundaries" convention the store's own actions already follow) → adapter walks the parsed tree into the store's existing Map<id,T> collections → once a project's been fetched its data stays in the store, so re-opening it via the switcher doesn't re-fetch (exact cache mechanism — inside the Zustand store vs. a separate layer — left as an implementation detail)

Explicitly not designed yet: migrations/actual DB file setup, how the store's existing mutations (addEntity, updateEntityTags, etc.) sync back to the server (this pass only covers reads — write endpoints are a separate design pass), auth (single-user constraint, decision #14, still holds)

Export: since 3D doesn't screenshot cleanly, include a "flatten to top-down orthographic" mode for PNG/PDF snapshots, selectable at project, space, or orbit scope

Phase 10 — Performance polish (not started)

LOD for text/geometry at distance, frustum culling, instancing for repeated geometry, worker-based layout computation for large graphs, visibility culling of hidden spaces/orbits

Phase 11 — Packaging & API (not started — the app is a single React app wired directly to the Zustand store, no embeddable library/class wrapper exists)

Public API (new ERModeler(container, options), .addProject(), .addSpace(), space.addOrbit(), space.addEntity() / orbit.addEntity(), .on('select', ...), .search(query), etc.) — note the API shape itself enforces the "nodes must belong to a space" rule
Framework wrapper (React) if needed, docs, example schemas (e.g. a "company network" space with "DMZ" and "internal" orbits, plus a "cloud services" space)
Single-user assumption documented as a current constraint (not designed for concurrent editing yet)

Build order: 0 → 1 → 2 → 3 → 5 → 4 → 6 → 7 → 8 → 9 → 10 → 11 — spaces/orbits come right after the data model since nodes are meaningless without a parent coordinate frame; camera/interaction comes before edges to get things visible and clickable early; everything else follows dependency order.

Not on this list but built along the way: a right-click context menu on sidebar space/orbit/entity rows (rename, view notes, visibility toggle, "Add orbit"/"Add node" as applicable, a "Relationships" submenu on entity rows listing that entity's relationships (cardinality-dependent icon per row) with "Add relationship" at the end), plus the sidebar tree itself (collapsible space → orbit → entity list, click-to-focus, search). It's a Phase 8-ish "add/rename" UI and a Phase 6-ish "notes" affordance built ad hoc alongside the Phase 2/3 rendering work, rather than in the build-order sequence above.

Open questions / things to revisit later
Multi-select bulk operations (bulk-move, bulk-delete, bulk-tag) beyond the tab pattern
Long-title truncation/wrapping rules for billboarded labels
Formal color/material scheme per nesting level (beyond "tinted, color-coded") — currently just hardcoded per-type color constants, not a documented/formalized scheme
Undo/redo implementation depth (history stack vs. relying solely on the reactive store)
Testing strategy for raycasting/hit-detection and layout correctness (visual regression, scripted-camera screenshots) — the pure-logic helpers underneath (edge geometry/visibility, bounds, camera-focus resolution, store validation) are unit-tested; actual react-three-fiber pointer/raycast events and any layout algorithm are not, since no layout algorithm exists yet
Revisit collaboration/concurrent editing if multi-user need arises later
Search currently matches across every project's data (searchAll operates on the whole flat store, not filtered by the active projectId), even though the search box is nested under one project's sidebar — should search be scoped to the active project, or is cross-project jump-to-result intentional?
