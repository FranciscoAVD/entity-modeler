 3D Node Relationship Modeler — Project Plan
Key design decisions

1. True 3D rendering Nodes and relationships exist in free 3D space, grouped into spaces, with orbits as an optional single-level sub-grouping within a space (no nested orbits). Core mitigations:

Billboarded text for all labels, offset far enough from anchor geometry to avoid rotational overlap
Depth cues — fog, distance-based opacity/size falloff
Curved (Bezier) edges, with distinct styling for cross-space and cross-orbit edges

2. Node geometry: spheres, title-only by default Nodes render as plain spheres with only their title shown by default; tags/notes/metadata are click-to-reveal.

3. Label placement: offset to avoid rotational overlap Labels anchored at a fixed radial offset from their anchor's center, recomputed each frame toward the camera, positioned just outside the anchor's silhouette. Applies to node titles, edge titles, and orbit/space labels.

4. Three visibility tiers

Space-level info: always visible
Orbit-level info: label always visible while its parent space is in view; notes/metadata click-to-reveal
Node and edge info: title always visible; full details click-to-reveal

5. Data model is separate from the renderer Project/Space/Orbit/Node/Relationship/Note live in a plain data structure; the three.js scene is one view over that data. This gives undo/redo, JSON export, and alternate render targets (e.g. flattened 2D export) without touching core logic.

6. Notes: freeform text, at four levels Space, Orbit, Node, and Relationship all carry independent notes[] — this originally included Project too, but notes are exclusively a Space/Orbit/Node/Relationship concept, so Project never gets one. Every note is plain free text (title, text, optional author, createdAt) — no per-note metadata bag. Notes originally carried an optional structured metadata bag (e.g. a space representing a subnet: { cidr: "10.0.4.0/24", vlan: 12 }, rendered as a key-value table alongside the prose), with Relationship notes deliberately excluded from it (enforced at creation time). That per-note bag has since been removed entirely, for every level, not just relationships — metadata is exclusively an object-level concept (a Space/Orbit/Node/Relationship's own metadata field, decision #11), never a per-note one; the CIDR/VLAN-style example now belongs on the object itself, same as it already does for relationships.

7. Relationships can cross spaces and orbits, and survive node moves sourceId/targetId reference nodes globally by id. If a node moves to a different space or orbit, its relationships are never severed or auto-deleted — they simply re-render with updated styling (e.g. an edge that was intra-space may become cross-space after a move). Relationship lifetime is tied only to its own existence, not to its endpoints' current location.

8. No self-relationships An node cannot have a relationship where sourceId === targetId. Enforced at creation time (API throws/rejects rather than silently allowing it).

9. Cascading deletes Deleting a space deletes everything scoped to it: its orbits, its nodes, and any relationship where either endpoint was one of those nodes (since a relationship can't exist with a dangling endpoint). This is the one case where relationships do get removed — moving a node keeps relationships intact; deleting its space does not.

10. Nodes must belong to a space; orbit is optional There's no "orphan" node — the API enforces a parent space at creation time (space.addNode(...)), with an optional orbit assignment (orbit.addNode(...) or space.addNode(..., { orbitId })) for tighter grouping.

11. Search: tagged keywords + universal title search

Spaces, orbits, nodes, and relationships can all carry tags — user-defined keywords, indexed separately for fast lookup (e.g. tagging a space "prod", an orbit "core", or a node "billing" so it can be found alongside unrelated objects sharing that tag). This was originally a space/orbit-only concept; it's since been extended to nodes, then relationships too — relationships also gained an optional metadata bag alongside tags, same shape as space/orbit/node's own object-level metadata (decision #6's per-note metadata bag has since been removed entirely — metadata is exclusively an object-level concept now, this is the only kind there is)
Tags are normalized *and project-scoped*: a Tag { id, projectId, name } registry (a flat Map<id, Tag>, same pattern as every other collection per decision #15) is the single source of truth for tag names, and each space/orbit/node/relationship stores a tagIds: string[] referencing it rather than duplicating free-typed strings. Tag identity is (projectId, name) — this was originally a single global registry shared across every project (a tag called "billing" was one shared record no matter which project used it); it's since been scoped so the same name in two different projects resolves to two independent tag records, never merged. Editing UI still reads/writes tags by name (TagEditor takes/returns string[] of names) — the store resolves a typed name against the *current object's project* on write, reusing an existing tag in that project (matched case-insensitively) or creating a new one there, so typing "Billing" and "billing" on two objects in the same project converges on one shared tag, while the same name in a different project stays independent. renameTag(tagId, name) updates that one registry record and every object referencing it picks up the new name for free (no array surgery across objects) — it throws if the new name would collide with another tag already in the same project (merging two tags into one is a real edge case, deliberately left unhandled); deleteTag(tagId) removes the registry entry and strips the id out of every tagIds array that held it, the same "no dangling reference" rule used elsewhere (decision #9). Deleting a project (decision #9) now also removes that project's own tags from the registry outright, rather than leaving them orphaned-but-intact — a project-scoped tag can never be referenced again once its project is gone
Spaces, orbits, and nodes are searchable by title/name via a substring/fuzzy match, without needing explicit tagging — relationships are excluded since they have no name field, and projects are excluded too (search lives inside one project's sidebar; project switching already has its own UI in the Header) — this was originally title-searchable, deliberately dropped once the search box was redesigned into per-category sections (see below), since a project result never fit into any of Spaces/Orbits/Nodes/Tags anyway
**Tag search redesigned: tags are now their own top-level search category, fuzzy-matched by name, not resolved directly into the objects that carry them.** This was originally an exact-match keyword index whose *hits* (the objects carrying a matched tag) were merged directly into the same flat result list as title matches — deliberately changed on request. The sidebar search box now shows up to four labeled sections when there are results — **Tags, Spaces, Orbits, Nodes, in that fixed order, tags always first, each section only rendered when it has ≥1 match** — and tag matching switched from exact-match to the same substring/fuzzy approach title search already used, so typing part of a tag's name now matches it like everything else. Selecting a Tag result doesn't focus the camera (a tag isn't a scene object) — it opens a dialog (see below) listing the spaces/orbits/nodes/relationships that carry it; picking one of *those* focuses the camera, same as any other search result. Both title and tag search are scoped to the active project (searchByTitle/searchTags/searchAll all take a projectId) — resolves a standing open question ("should search be scoped to the active project?"), settled once tags themselves became project-scoped (see above): an unscoped title match from an unrelated project would otherwise read as inconsistent sitting next to a tag match that could no longer cross projects at all. Relationships still aren't part of *title* search or the Tags/Spaces/Orbits/Nodes section list itself (no name field, no sidebar row) — but they do now appear inside a Tag result's TagObjectsDialog (labeled by their endpoints, e.g. "Node 1 → Node 2", same fallback tabLabel uses), since a relationship with that tag genuinely carries it and omitting it there read as the tag simply not working
Built: a UI for the tag registry — TagEditor's free-text input autocompletes against the current project's existing tag names as you type (a suggestion dropdown, filtered, capped at 6). The standalone browsable/renameable/deletable tag list (TagBrowserDialog, reachable from a sidebar "Browse tags" button) was retired in the same redesign that folded tag search into the main search box — clicking a Tag search result now opens TagObjectsDialog instead, a read-only listing of what that tag is attached to (no rename/delete UI for the moment, tracked as an open question below), clicking an item focuses the camera exactly like a SidebarTree row click (cascading visibility gate through parent space/orbit)

12. Multi-selection via tabs

A single click on a node/edge/orbit/space only moves the camera (focus-only, same as a sidebar row click); a double-click opens a tab (rather than replacing the current selection), so multiple objects can be inspected side by side — spaces were originally excluded from tabs entirely (see below), but now participate identically to orbits/nodes
Clicking a tab flies the camera to that object — animated (tweened, ease-in-out, ~400–800ms), never an instant snap, to preserve spatial orientation
Tabs are no longer a user-managed open/close list — this originally had an explicit "close tab" action, but a row of removable chips got cluttered fast with more than a couple objects open. openTabs is now a recency-capped history (the 5 most recently viewed objects, oldest evicted automatically) — originally presented as a standalone dropdown in the Header, now surfaced from the sidebar's search box instead: focusing the (empty) search input shows it as a "Recently viewed" section, picking an entry flies the camera and opens the panel exactly like the old dropdown did. An object's tab is only removed early if the object itself is deleted (cascade), in which case the next remaining tab (or none) becomes active
A "reset view" control exists independent of tabs, returning to a full-project overview, so users aren't trapped at node-level zoom after opening several tabs

13. Empty space/orbit rendering Tinted, transparent, color-coded spheres/ellipsoids — space, orbit, and node each get a distinct hue or saturation level so nesting is visually obvious at a glance. For empty groups specifically:

Minimum bounding-volume size so an empty group is never too small to see or click
Dashed or reduced-opacity boundary to distinguish "empty" from "populated," at a glance and from a distance
Label remains always-visible even at zero members
Optional "+" affordance inside the boundary if used as an authoring tool

14. Single-user for now No concurrent editing/collaboration concerns in this version of the plan; the reactive store can stay simple (no CRDT/conflict resolution needed yet).

15. Normalized data model — flat collections, parent references point up Rather than nesting children as arrays inside their parents (Project.spaces: Space[]), every object holds a reference up to its parent by id (Space.projectId), consistent with how Relationship.sourceId/targetId already work. The store holds flat, id-keyed collections (Map<id, T> per type); "children of X" (spaces in a project, nodes in a space, etc.) are computed queries/indices, not stored arrays. This avoids the two-sided sync problem of keeping a parent's child array and a child's parent pointer both correct — especially important since nodes already move between spaces/orbits, and a project list/switcher UI means projects need to be loaded and displayed independently of their full contents.

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

Node {
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
  id, title, text, author?, createdAt
}

Tag {
  id, projectId,              // ← identity is (projectId, name); scoped per decision #11
  name
}

Node originally had a fields: Field[] property (Field being { id, name, type, isPK?, isFK? }) modeling database-table columns. That's been removed: a field with no value is a schema declaration, not an attribute of a specific node instance, which is a narrower assumption (this tool models general nodes/relationships, not specifically database schemas — see plan.md's own network-topology example schema under Phase 11) than this tool intends. Node now carries tags/metadata directly instead, same shape as Space/Orbit.

Project originally had a notes: Note[] property too. That's been removed — notes, tags, and metadata are exclusively a Space/Orbit/Node/Relationship concept; Project never gets an editing surface for any of them.

tags: string[] was originally stored inline on Space/Orbit/Node(/Relationship) as free-typed strings, duplicated per object with no shared identity — renaming a tag meant editing it independently everywhere it appeared, and two objects tagging the same concept ("Billing" vs "billing") had no way to be recognized as the same tag. Normalized per decision #11: each of those types now carries tagIds: string[] instead, referencing the flat Tag registry below.

Store shape: flat maps per type — projects, spaces, orbits, nodes, relationships, tags — each keyed by id. "Children of X" views (e.g. spacesInProject(projectId), nodesInSpace(spaceId), nodesInOrbit(orbitId)) are derived by filtering/indexing these maps on demand, optionally backed by a maintained parentId -> Set<childId> index for performance, rather than being a second source of truth to keep in sync. The tags map was originally the one collection not scoped under a parent — tags started as shared vocabulary across the whole store, not owned by any single project. That's since changed (decision #11): each Tag now carries a projectId, so tagsInProject(projectId) is a derived "children of X" view like everything else in this list, and tag identity/dedup is scoped to a single project rather than the whole store.

Validation rules enforced by the API/store layer (not just types):

sourceId !== targetId on relationship creation
Node creation always requires a spaceId (and optionally orbitId)
Deleting a Space cascades: delete the Space record, delete all Orbit/Node records where spaceId matches, then delete Relationship records where sourceId/targetId matched any deleted node
Moving a node between spaces/orbits is a field update (node.spaceId = ..., node.orbitId = ...) — no array surgery, and it never touches Relationship records
Deleting a Tag cascades the other direction from Space's cascade: the Tag record is removed, then every Space/Orbit/Node/Relationship whose tagIds included it has that id stripped out — no dangling tagId ever survives in a tagIds array
An node's effective world position resolves by walking up: node.orbitId → orbit.origin (if assigned) + node.spaceId → space.origin + node.position
Loading a project (e.g. for a project list/switcher) requires only Project records — spaces/orbits/nodes are pulled in lazily by filtering on projectId once a project is opened, not eagerly nested inside it
Selection, tabs & search architecture

Selection model

openTabs: { id, type: "node" | "relationship" | "orbit" | "space" }[] — a recency-capped history (5 most recently viewed, oldest evicted), not a user-managed open/close list; see decision #12
activeTabId: string | null
A single click on a node/edge/orbit/space in the 3D scene only moves the camera (via the same focusOn/focusTarget mechanism a sidebar row click uses) — it does not add a tab. Double-clicking adds it to openTabs (moving it to most-recent if already present) and makes it active
Making a tab active triggers an animated camera fly-to centered on that object
There's no manual "close" of the openTabs history itself — an entry only leaves openTabs early if its underlying object is deleted (cascade), in which case the next remaining tab (or none) becomes active; otherwise it just ages out once 5 newer objects have been viewed. The side panel's own visibility is a separate concern: a close button clears activeTabId (clearActiveTab) without touching openTabs, so the panel can be dismissed and later reopened at the same point via the sidebar search box's "Recently viewed" section (focus the empty input)
A separate "reset view" action clears camera focus and flies to a default overview position, without necessarily affecting openTabs

Search

Text input matches against: tag names (fuzzy/substring, own category) and all nameable space/orbit/node name fields (fuzzy/substring) — this was originally an exact-match tag index whose hits resolved directly into the object list; redesigned per decision #11 into four ordered sections (Tags, Spaces, Orbits, Nodes), tags shown but not focusable directly
Selecting a Space/Orbit/Node result flies the camera to it, same as a single click on a sidebar row or 3D-scene object — it does not open a tab (opening a tab requires a double-click in the 3D scene, or the sidebar row's "View notes" context-menu item). Selecting a Tag result instead opens TagObjectsDialog, listing the objects that carry it — picking one of those focuses the camera the same way
Tags are matched directly against the project's Tag registry (decision #11) by substring, not through a separate inverted index — objectsForTag (a plain lookup over spaces/orbits/nodes/relationships' tagIds) resolves a specific tag to what it's attached to, on demand when its dialog opens, rather than a maintained tag -> [ids] index
**Both title and tag search are scoped to the active project** — this was originally whole-store (cross-project), an open question resolved once tags themselves became project-scoped (decision #11)
Rendering: visibility by tier
Object	Always visible	Revealed on click	Empty-state treatment
Space	name/label, tint boundary	notes, metadata, tags	dashed/low-opacity boundary, min size floor
Orbit	name/label (dimmer), tint boundary	notes, metadata, tags	same as space, nested inside it
Node	title only, offset-billboarded sphere	notes, metadata, tags	n/a (nodes aren't containers)
Relationship	title only (if present)	cardinality, notes, tags, metadata	n/a
Click-to-reveal / tab architecture

Hit detection (raycasting)

Nodes: raycast against sphere meshes, keyed via userData.nodeId
Edges: raycast against invisible "hit tube" meshes (cylinder/tube geometry) running alongside each visible curved line — gives a generous, consistent click target regardless of visual line thickness
Orbits: raycast against a light bounding volume (shell/disc) for orbit-level notes/metadata reveal
Spaces: raycast against the same kind of light bounding volume as orbits — spaces are now fully part of the reveal/tab flow (this reverses an earlier decision to exclude them; see the closing note below). Drag/move repositioning was never built for any object type, and Phase 7 has since settled that it never will be — positions are exclusively auto-layout's responsibility (see Phase 7)

Flow

Click → raycast → resolve { id, type } → focus camera only (single click) or open/focus tab (double-click) → look up record → emit select event
DOM tab bar + panel: the recently-viewed history (title + type icon per entry) no longer has its own dedicated tab bar — it surfaces as a "Recently viewed" section in the sidebar search box when the input is focused with an empty query, rather than a standalone Header dropdown or a row of open-selection chips; panel below shows the active tab's full info (title, tags/metadata for spaces/orbits/nodes, cardinality for relationships, notes as prose, metadata as key-value table)
In-scene highlight on whichever object the active tab represents — currently a static emissive/opacity bump (node emissive color, edge width/opacity, space/orbit boundary opacity via an `active` prop), not yet an outline shader or an animated pulse
Vector3.project() available for optional in-scene panel anchoring near the clicked object's screen position — not implemented yet

Space labels remain a persistent, lower-emphasis billboarded label regardless of click state — always visible, never gated behind a click. This originally meant spaces skipped the select/reveal flow entirely; that part is now reversed (see the hit-detection note above) — the space's boundary is a click target too: a single click flies the camera to it, a double-click opens a tab whose panel shows the space's tags/metadata/notes, same as an orbit. Project never gets this treatment — Project.notes has been removed from the data model entirely (see the data model section above), so there's no "project info" panel/button to build, planned or otherwise.

Phase plan

Phase 0 — Scope & spike (done)

1 space with 2 orbits (a few nodes each) plus one ungrouped node, one intra-orbit edge, one cross-orbit edge, one relationship that survives a manual "move node to another space" test
Empty-state test: one deliberately empty orbit, rendered per the tinted/dashed treatment
Tab bar with 2+ open tabs, clicking between them triggers animated camera fly-to
Validates label-tier visual hierarchy, orbit hit-testing, relationship persistence through node moves, empty-group rendering, and tab/camera UX — before deeper investment

Phase 1 — Core data model (done — the project switcher is a dropdown rather than a dedicated list/grid page, functionally equivalent to what's described below)

Project/Space/Orbit/Node/Relationship/Note/Tag as above, with normalized tagIds on Space/Orbit/Node/Relationship referencing the shared Tag registry
Normalized store: flat Map<id, T> per type, parent references point up (Space.projectId, Node.spaceId/orbitId), no nested child arrays
Derived "children of X" queries/indices (spacesInProject, nodesInSpace, nodesInOrbit) computed from the flat maps, optionally cached via a maintained parentId -> Set<childId> index
Validation rules: no self-relationships, nodes always require a space, cascade delete logic
openTabs/activeTabId in the store instead of a single selection slot
Reactive store (pub-sub, Zustand, or similar) so the scene reacts to model changes rather than being mutated directly
Position resolution helper (getWorldPosition(node)) walking up via orbitId/spaceId lookups
Tag index and title index for search
Project list/switcher: load Project records independently of their spaces/orbits/nodes, which are fetched lazily by projectId once a project is opened

Phase 2 — Space & orbit rendering (done)

Tinted, transparent, color-coded bounding volumes for spaces and orbits, visually distinguishable by nesting level
Empty-state treatment (dashed boundary, min size, always-visible label)
origin transforms applied correctly through the space → orbit → node chain
Per-space and per-orbit visibility toggles

Phase 3 — Node rendering (partially done — instancing not started, explicitly deferred to Phase 10 in code)

Sphere geometry per node, billboarded title at computed offset (radial, camera-facing, clipping-safe)
Instancing strategy for larger schemas

Phase 4 — Edge rendering + hit tubes (done)

Visible curved (Bezier) line + paired invisible hit-tube mesh per relationship
Billboarded title at curve midpoint, offset perpendicular to the curve
Distinct styling for same-orbit / cross-orbit / cross-space edges
Cardinality markers (billboarded) at endpoints

Phase 5 — Camera & interaction (done — drag-to-reposition was tried, reverted per user feedback, and later ruled out permanently by Phase 7's design: positions are exclusively auto-layout's responsibility, dragging was never rebuilt)

OrbitControls for orbit/pan/zoom
Unified raycasting across spheres + hit-tubes + orbit bounds → tab-open dispatch
Animated camera fly-to on tab activation; independent "reset view" control
~~Camera-plane-constrained dragging for repositioning nodes (modifier key for depth movement)~~ — dropped; see Phase 7

Phase 6 — Tabs, notes & search UI (done — add/edit/delete note UI was scoped out of the initial pass and delivered later under Phase 8's work instead, see below)

Recently-viewed history (switch only, no manual open/close — see decision #12) now surfaces from the sidebar search box (focus the empty input) rather than a dedicated tab bar, info panel generic across node/relationship/orbit/space, with node/orbit/space sharing one GroupDetails renderer since they're now the same shape (tags, metadata, notes)
Space info now goes through this same panel (SpaceDetails) rather than staying a separate always-on label-only affordance — this reverses the line's original assumption, see the reveal-flow note above
Search input (tags + titles); results fly the camera like a sidebar-row click, not a full tab-open — see the Search section above
Add/edit/delete note UI, including metadata key-value editing, writing back to the data model at any level — built, but as part of Phase 8's editing-UI pass rather than in this one

Phase 7 — 3D auto-layout (done — `client/src/scene/autoLayout.ts`)

**Positions are never user-set — the only structural lever a user has is choosing a parent** (creation, or the existing "Move to..." re-parent dialog). This reverses the phase's original framing ("manual drag position always overrides auto-layout once set") — there is no manual position/drag concept at all, so nothing to override. Confirmed with the user before implementation: dragging was explicitly ruled out as a feature, not deferred.

Hand-rolled, not a library (d3-force-3d was considered and rejected) — a small damped relaxation (repulsion between every pair + a spring pull along relationships + a gentle centering force, position-only, no separate velocity state) built on the existing `client/src/lib/vector3.ts` helpers, run for a fixed number of iterations with damping ramping down so it settles rather than oscillating. Graphs here are small (dozens of objects) and layout is never animated (positions just update, no requestAnimationFrame/live tick loop), so a library's main value — Barnes-Hut repulsion at scale, tuned real-time convergence — didn't justify the dependency or the data-shape bridging it would need (d3-force mutates plain `{x,y,z,vx,vy,vz}` objects; this store uses immutable Vector3 records).

Three cascading tiers, mirroring the data hierarchy, run together as one pass (`autoLayoutProject`) — no manual trigger button, no scoped/partial re-layout, no per-object "locked" flag:
1. **Nodes within each orbit** — `layoutGroup` over that orbit's nodes, links from intra-orbit relationships, clamped within `orbitRadiusForNodeCount` (bounds.ts's existing count-based sizing formula, extracted into a plain count → radius function so this module can call it without needing a full `ModelState`).
2. **Each space's direct children together** — every orbit (as one blob, collision radius = its own orbit-tier radius) plus every ungrouped node (as an individual point), links aggregated from relationships between the underlying nodes, clamped within `spaceRadiusForChildren`.
3. **Spaces within the project** — one point per space (collision radius = its own space-tier radius), links aggregated from cross-space relationships, unconstrained (no parent shell).

Automatic, not manual — `store.ts` calls `autoLayoutProject` at the end of every action that changes topology (`addNode`/`deleteNode`/`moveNode`, `addOrbit`/`deleteOrbit`, `addSpace`/`deleteSpace`, `addRelationship`/`deleteRelationship`/`updateRelationshipEndpoints`); a rename/tag/note/metadata edit never touches it. Does **not** run on project load/hydration — a freshly loaded project (including the seeded demo, with its own hand-placed positions) keeps its saved layout until something actually changes its structure.

This removed what's now dead code: `updateNodePosition` (the store action — there's no manual-positioning concept left for it to serve), the optional `position`/`origin` params on `addNode`/`addOrbit`/`addSpace` (no UI ever passed them; keeping them would've been misleading once auto-layout overwrites them immediately anyway), and `moveNode`'s "preserve world position across the move" re-basing math (moot — `autoLayoutProject` recomputes the position from scratch right after based on the new topology, so re-parenting is now just a field reassignment).

**Tuning pass, same session — everything lands on one horizontal plane; unrelated groups no longer cluster near the origin.** User feedback after trying it: objects should prefer a shared horizontal plane (panning/zooming across it is much easier than hunting above/below it), and unrelated objects were bunching up near the origin instead of spreading out. Two fixes: (1) `seedPosition` switched from a full golden-angle *sphere* to a flat golden-angle *spiral* (y=0 for every entity, x/z only) — every force in `layoutGroup` (repulsion, spring, centering) is derived purely from relative positions with no external "up" bias, so seeding y=0 for everyone is sufficient on its own to keep y=0 forever, no separate damping term needed. (2) The unconstrained tier's (spaces-in-project) initial seed spread previously scaled off `entities.length` alone — tiny (1-2 units) against real space radii (2-10+), so a handful of spaces started deep inside each other with only weak repulsion to undo it. Now scales off the entities' own total radius instead. `SEPARATION_PADDING` (the resting-distance floor between any two entities, beyond bare non-overlap) bumped 0.5 → 2.5 for real breathing room in the settled layout, not just "technically not touching."

Phase 8 — Editing UI (done — add, rename, delete-with-cascade-confirmation, move-node, and notes/tags/metadata editing UI all exist; node/space/orbit repositioning is no longer planned at all, not merely deferred — see Phase 7 above)

Add/edit/delete projects, spaces, orbits, nodes, relationships, notes/metadata, tags
Move node between spaces/orbits (re-parenting) — relationships persist automatically per the data model rule; position is no longer re-based by moveNode itself, since Phase 7's auto-layout recomputes it from scratch immediately afterward
Delete space/orbit — cascade confirmation UI, since this is destructive and touches relationships

Notes moved off the small-dialog pattern (done): notes are expected to run long (500-800 words), and the shared `Dialog` primitive every other action uses (CreateDialog, AddRelationshipDialog, MoveNodeDialog, DeleteConfirmDialog) is a fixed 384px with no height cap — fine for a name field or a couple of dropdowns, not for long-form text. Small/quick actions (move, delete, add relationship) stay dialogs; notes get their own docked panel instead. `NotePanel` renders as a sibling of `SidePanel` in `Overlay.tsx`, positioned `absolute inset-y-0 right-80` (flush against `SidePanel`'s left edge, since `SidePanel` is `w-80`) — wider than SidePanel's 320px, at `w-[28rem]` (448px). "Which note is open" moved out of `NoteList`'s local `useState` into `viewStore.ts` (alongside the existing `focusTarget`) as `openNote: { targetType, targetId, note: "new" | Note } | null` plus `openNoteFor`/`closeNote` actions, since `NotePanel` has to be reachable from outside `NoteList`'s own subtree. `NoteDialog.tsx` was retired — its view/edit content (title, date/author, rendered text or edit form, pencil toggle) moved into `NotePanel` with different chrome (its own close button, matching `SidePanel`'s pattern, instead of a modal); note deletion still confirms via the small `DeleteConfirmDialog`, just retargeted to the new panel. Notes also gained Markdown rendering (`react-markdown` + `remark-breaks`, new shared `MarkdownContent.tsx`, custom element styling rather than the `@tailwindcss/typography` plugin) in both the read-only view and — new since the original plan — a Write/Preview toggle inside the edit form itself: one pane at a time, not a WYSIWYG editor and not a side-by-side split (a two-column split was tried in discussion first and rejected as cramped even at 448px; a GitHub-style in-place toggle was picked instead, reusing the same `Textarea` + `MarkdownContent`). The truncated row preview in `NoteList` stays plain/unrendered clamped text — rendering and `line-clamp` don't combine cleanly, and it's a preview, not the view.

Phase 9 — Persistence & export (persistence done — read/write, seeding, migrations, autosave; export not started)

Persistence is server-backed: SQLite via Bun's native driver (bun:sqlite), accessed through drizzle-orm, living in the `server` package — resolves the "local-only vs. server-backed" open question in progress.md in favor of server-backed. Built in six layers (shared schemas → server DB layer → server reads → server writes → client reads → client autosave), each verified independently before the next started — see progress.md for the session write-up.

New `shared` workspace package (sibling to `client`/`server`, added to root package.json's workspaces) holds the wire contract: hand-written Zod schemas plus their inferred TS types, zero Drizzle dependency (only `zod`) so it can never accidentally pull a DB driver into the client bundle. Per-record schemas (Vector3Schema, NoteSchema, TagSchema, ProjectSummarySchema, SpaceSchema, OrbitSchema, NodeSchema, RelationshipSchema) mirror the domain shapes in client/src/store/types.ts exactly (Vector3 as {x,y,z}, tagIds: string[], cardinality as a literal union) rather than raw DB rows, plus a composed ProjectDetailSchema (five flat sibling arrays — see response shape below) used for both the GET response and the PUT request body, one schema authored once for both directions. ProjectDetailSchema was originally a nested tree (spaces containing their orbits containing their nodes) mirroring a natural REST resource shape — changed since neither side actually stores data that way: the client's store and the server's SQL schema are both already flat/normalized (decision #15), so the nested wire shape was pure overhead, built on every save and undone again on every load, for data that was normalized on both ends the whole time.

`server` owns Drizzle entirely — `shared` has no idea it exists. `db/schema.ts` defines one table per type (projects, spaces, orbits, nodes, relationships, notes, tags) plus four join tables for the tagIds relations (space_tags, orbit_tags, node_tags, relationship_tags), since a many-to-many can't be a plain array column in SQL the way it is in the client's normalized store; notes are one table (not four), matching decision #6's "same shape, same rendering path at every level", with a real nullable FK per possible parent (spaceId/orbitId/nodeId/relationshipId, each `onDelete: cascade`) rather than a polymorphic targetType/targetId pair — exactly one is set per row, so a note's parent is a real foreign key (queryable, cascade-deletable by the DB itself) instead of an unenforced string pair. No `metadata` column on notes — metadata is exclusively an object-level concept (decision #11), never per-note. Vector3 fields flatten to _x/_y/_z columns; object-level metadata stays a JSON column since it's explicitly freeform. Every other FK uses `onDelete: cascade` (or `set null` for a node's optional orbitId, mirroring deleteOrbit's reassign-not-delete behavior) as a referential-integrity safety net only — cascade *business logic* stays entirely in the client's store.ts, already tested; the server never re-implements it. `db/connection.ts` does the bun:sqlite + drizzle() wiring and runs migrations (drizzle-kit-generated, checked into `server/drizzle/`) on every boot, so `bun run dev`/`start` stays a single command. `db/seed.ts` seeds the same demo project client/src/store/seed.ts used to fabricate in-memory, once, if the `projects` table is empty on boot — the client no longer fabricates any data itself; `client/src/store/seed.ts` is deleted.

**Write-sync is debounced full-project autosave, not per-mutation REST** — resolves the "how do the store's ~30 mutations sync back" open question in favor of the simplest option that decision #14 (single-user, no concurrent editing) allows: the Zustand store stays the sole source of validation/cascade truth, completely unchanged; `client/src/store/persistence.ts`'s `useAutosave(projectId)` subscribes to the five data Maps (shallow-compared, via zustand's `subscribeWithSelector` — tab/selection state living in the same store must *not* trigger a save), and ~1s after the last change, `client/src/store/serialize.ts`'s `serializeProject` pulls each Map down to just this project's own records (via the same "in project" selectors already used everywhere else, no new query logic — no tree-building either, per the flat wire shape above) and `PUT`s it. The server does a transactional delete-scoped-to-this-project + full reinsert (`db/writes.ts`'s `upsertProject`) — no diffing, no partial patches. `PUT /projects/:id` doubles as create-or-replace (upsert), so creating a project is just an immediate, non-debounced call to the same endpoint right after the local `addProject` — without it, closing the tab before the debounce fires would lose a freshly created project entirely. A pending debounced save is flushed (not dropped) on project-switch or unmount. A small "Saving…"/"Saved"/"Save failed" indicator in the Header reflects it (`viewStore.ts`'s `saveStatus`, not model data).

Four routes total: GET /projects (flat list — id/name/description only), GET /projects/:id ({ project: {...}, spaces: [...], orbits: [...], nodes: [...], relationships: [...], tags: [...] } — five flat sibling arrays, not nested; each Space/Orbit/Node/Relationship carries its own parent-id field (Orbit.spaceId, Node.spaceId/orbitId) the same way the client's store and the server's SQL schema already represent parent references), PUT /projects/:id (upsert, described above), DELETE /projects/:id (exists and works; no UI trigger yet — project deletion never had one before this pass either).

Client fetch flow: GET /projects/:id → parse the response through ProjectDetailSchema (runtime validation, not just compile-time types, matching the "validate at boundaries" convention the store's own actions already follow) → `store.ts`'s `hydrateProject` action sets each flat array straight into the store's existing Map<id,T> collections, merging by id rather than replacing → once a project's been fetched its data stays in the store (tracked via a loaded-ids ref in App.tsx), so re-opening it via the switcher doesn't re-fetch.

Verified end-to-end in a real browser (headless Chromium via Playwright, not just unit tests): load → renders the seeded demo project correctly, switch projects, create a project (and confirm the immediate save survives independently of the debounced path), edit a node's name → watch the save indicator → reload the page in a fresh browser context → confirm the edit persisted, all with zero console errors. Along the way, browser testing caught and fixed a real pre-existing bug unrelated to persistence: `SidebarTree.tsx`'s space list used `<>...</>` (a bare fragment, which can't take props) as the element returned from `.map()`, with `key` mistakenly placed on the child `SpaceRow` instead — React never actually saw a key, silently, until this session's browser console check surfaced the warning. Fixed with `<Fragment key={space.id}>`.

Not built this pass: export (see below — separate scope, tracked as its own remaining item), auth (still not needed, decision #14), retry/offline-queue robustness for a failed autosave (logs to console; matches "single-user, low-stakes local tool" scope), a delete-project UI (the action and route both exist, just no UI entry point).

Export: since 3D doesn't screenshot cleanly, include a "flatten to top-down orthographic" mode for PNG/PDF snapshots, selectable at project, space, or orbit scope — not started; `serializeProject` (above) gives this a head start since it already knows how to flatten one project's data.

Phase 10 — Performance polish (not started)

LOD for text/geometry at distance, frustum culling, instancing for repeated geometry, worker-based layout computation for large graphs, visibility culling of hidden spaces/orbits

Phase 11 — Packaging & API (not started — the app is a single React app wired directly to the Zustand store, no embeddable library/class wrapper exists)

Public API (new ERModeler(container, options), .addProject(), .addSpace(), space.addOrbit(), space.addNode() / orbit.addNode(), .on('select', ...), .search(query), etc.) — note the API shape itself enforces the "nodes must belong to a space" rule
Framework wrapper (React) if needed, docs, example schemas (e.g. a "company network" space with "DMZ" and "internal" orbits, plus a "cloud services" space)
Single-user assumption documented as a current constraint (not designed for concurrent editing yet)

Build order: 0 → 1 → 2 → 3 → 5 → 4 → 6 → 7 → 8 → 9 → 10 → 11 — spaces/orbits come right after the data model since nodes are meaningless without a parent coordinate frame; camera/interaction comes before edges to get things visible and clickable early; everything else follows dependency order.

Not on this list but built along the way: a right-click context menu on sidebar space/orbit/node rows (rename, view notes, visibility toggle, "Add orbit"/"Add node" as applicable, a "Relationships" submenu on node rows listing that node's relationships (cardinality-dependent icon per row) with "Add relationship" at the end), plus the sidebar tree itself (collapsible space → orbit → node list, click-to-focus, search). It's a Phase 8-ish "add/rename" UI and a Phase 6-ish "notes" affordance built ad hoc alongside the Phase 2/3 rendering work, rather than in the build-order sequence above.

Open questions / things to revisit later
Multi-select bulk operations (bulk-move, bulk-delete, bulk-tag) beyond the tab pattern
Long-title truncation/wrapping rules for billboarded labels
Formal color/material scheme per nesting level (beyond "tinted, color-coded") — currently just hardcoded per-type color constants, not a documented/formalized scheme
Undo/redo implementation depth (history stack vs. relying solely on the reactive store)
Testing strategy for raycasting/hit-detection and layout correctness (visual regression, scripted-camera screenshots) — the pure-logic helpers underneath (edge geometry/visibility, bounds, camera-focus resolution, store validation) are unit-tested; actual react-three-fiber pointer/raycast events and any layout algorithm are not, since no layout algorithm exists yet
Revisit collaboration/concurrent editing if multi-user need arises later
Merging two tags (e.g. after a rename collides with an existing tag in the same project) — currently renameTag just throws rather than merging the two registry entries and remapping every tagIds reference onto one
Tag rename/delete UI — TagObjectsDialog (opened from a Tags search result) is read-only for now; TagBrowserDialog used to offer both but was retired when tag search moved into the main search box. renameTag/deleteTag still exist and work at the store layer, just have no UI trigger currently
