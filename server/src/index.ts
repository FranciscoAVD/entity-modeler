import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "env/server";
import "./db/connection"; // runs migrations as a side effect on import
import { seedIfEmpty } from "./db/seed";
import { projectsRoute } from "./routes/projects";

if (env.NODE_ENV === "development") seedIfEmpty();

const app = new Hono();

app.use("/*", cors());

app.get("/", (c) => c.json({ status: "ok" }));
app.route("/projects", projectsRoute);

export default {
  port: env.PORT,
  fetch: app.fetch,
};
