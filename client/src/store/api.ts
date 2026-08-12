import { env } from "env/client";
import type { ProjectDetail, ProjectSummary } from "shared";
import { ProjectDetailSchema, ProjectListResponseSchema } from "shared";

// Single-user local tool (plan.md decision #14) — VITE_API_URL defaults to the server's own
// default dev port (server/src/index.ts) if unset.
const API_BASE = env.VITE_API_URL;

// Every response is parsed through the shared Zod schema before being trusted — runtime
// validation at the boundary, matching the store's existing "validate at boundaries" convention.

export async function fetchProjectList(): Promise<ProjectSummary[]> {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) throw new Error(`Failed to fetch project list: ${res.status}`);
  return ProjectListResponseSchema.parse(await res.json());
}

export async function fetchProjectDetail(id: string): Promise<ProjectDetail> {
  const res = await fetch(`${API_BASE}/projects/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch project ${id}: ${res.status}`);
  return ProjectDetailSchema.parse(await res.json());
}

export async function saveProject(id: string, data: ProjectDetail): Promise<void> {
  const res = await fetch(`${API_BASE}/projects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to save project ${id}: ${res.status}`);
}

export async function deleteProjectRemote(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/projects/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`Failed to delete project ${id}: ${res.status}`);
}
