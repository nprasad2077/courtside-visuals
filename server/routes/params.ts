import { z } from "zod";
import type { FastifyReply } from "fastify";

export const season = z.coerce.number().int().min(1946).max(2100);
export const playerId = z.string().regex(/^[a-z0-9]{3,16}$/, "invalid player id");
export const teamCode = z.string().regex(/^[A-Z]{3}$/, "invalid team code");
export const conf = z.enum(["E", "W"]);

export const idParams = z.object({ id: playerId });
export const seasonQuery = z.object({ season });

/** Parse with zod; on failure send 400 and return null. */
export function parse<T extends z.ZodTypeAny>(schema: T, value: unknown, reply: FastifyReply): z.infer<T> | null {
  const r = schema.safeParse(value);
  if (r.success) return r.data;
  reply.code(400).send({ error: "bad_request", issues: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
  return null;
}
