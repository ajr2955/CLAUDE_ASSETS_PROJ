import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";

export async function GET() {
  try {
    const types = await prisma.documentType.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(ok(types));
  } catch (e) {
    console.error(e);
    return NextResponse.json(err("Failed to load document types"), { status: 500 });
  }
}
