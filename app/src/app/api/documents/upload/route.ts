import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

const MAX_FILE_SIZE_BYTES = Number(process.env.MAX_FILE_SIZE_BYTES ?? 50 * 1024 * 1024); // 50MB default

export async function POST(req: NextRequest) {
  const auth = requireAuth(req, "contractor");
  if (auth instanceof NextResponse) return auth;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return err("Invalid multipart form data", 400);
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return err("file field is required in multipart form data", 422);
  }

  const blob = file as File;

  if (blob.size > MAX_FILE_SIZE_BYTES) {
    return err(
      `File exceeds maximum allowed size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
      422
    );
  }

  const uploadDir = process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads");
  await mkdir(uploadDir, { recursive: true });

  // Generate unique filename to avoid collisions
  const timestamp = Date.now();
  const safeName = blob.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${timestamp}_${safeName}`;
  const filePath = join(uploadDir, fileName);

  const arrayBuffer = await blob.arrayBuffer();
  await writeFile(filePath, Buffer.from(arrayBuffer));

  const fileUrl = `/uploads/${fileName}`;

  return ok(
    {
      file_url: fileUrl,
      file_name: blob.name,
      file_size_bytes: blob.size,
      mime_type: blob.type || null,
    },
    undefined,
    201
  );
}
