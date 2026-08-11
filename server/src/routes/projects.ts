import { Hono } from "hono";
import { ProjectDetailSchema } from "shared";
import { loadProjectDetail, loadProjectList } from "../db/reads";
import { deleteProject, upsertProject } from "../db/writes";

export const projectsRoute = new Hono();

projectsRoute.get("/", async (c) => {
  const list = await loadProjectList();
  return c.json(list);
});

projectsRoute.get("/:id", async (c) => {
  const detail = await loadProjectDetail(c.req.param("id"));
  if (!detail) return c.json({ error: "Project not found" }, 404);
  return c.json(detail);
});

// Upsert: creates the project if this id doesn't exist yet, otherwise replaces it wholesale.
// The client is the sole source of validation/cascade truth (store.ts) — this route only
// validates the wire shape, not business rules (no self-relationships, cascade correctness,
// etc.), which the client has already enforced before ever serializing this payload.
projectsRoute.put("/:id", async (c) => {
  const body = await c.req.json().catch(() => undefined);
  const parsed = ProjectDetailSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid project payload", issues: parsed.error.issues }, 400);

  upsertProject(c.req.param("id"), parsed.data);
  return c.json({ ok: true });
});

projectsRoute.delete("/:id", (c) => {
  const deleted = deleteProject(c.req.param("id"));
  if (!deleted) return c.json({ error: "Project not found" }, 404);
  return c.json({ ok: true });
});
