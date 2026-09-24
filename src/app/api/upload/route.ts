import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { getUser } from "@/lib/auth/server";
import { putObject } from "@/lib/storage";

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_SIDE = 1600;

/** Card photo upload: resized to at most 1600px and re-encoded as WebP. Returns { url }. */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Bạn cần đăng nhập." }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Không tìm thấy ảnh." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Ảnh quá lớn (tối đa 15MB)." }, { status: 413 });
  if (!file.type.startsWith("image/")) return Response.json({ error: "Tệp không phải ảnh." }, { status: 415 });

  let body: Buffer;
  try {
    body = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return Response.json({ error: "Không đọc được ảnh." }, { status: 415 });
  }
  const url = await putObject(`cards/${user.id}/${randomUUID()}.webp`, body, "image/webp");
  return Response.json({ url });
}
