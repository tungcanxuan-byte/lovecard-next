import { readLocalObject } from "@/lib/storage";

const TYPES: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg", png: "image/png", gif: "image/gif" };

/** Serves images uploaded while no S3/R2 bucket is configured. */
export async function GET(_req: Request, ctx: RouteContext<"/uploads/[...key]">) {
  const { key } = await ctx.params;
  const body = await readLocalObject(key.join("/"));
  if (!body) return new Response("Not found", { status: 404 });
  const ext = key.at(-1)?.split(".").pop() ?? "";
  return new Response(new Uint8Array(body), {
    headers: { "content-type": TYPES[ext] ?? "application/octet-stream", "cache-control": "public, max-age=31536000, immutable" },
  });
}
