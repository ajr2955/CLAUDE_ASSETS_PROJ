import { NextResponse } from "next/server";

type ApiMeta = {
  page?: number;
  per_page?: number;
  total?: number;
};

export function ok<T>(data: T, meta?: ApiMeta, status = 200) {
  return NextResponse.json({ data, error: null, meta: meta ?? null }, { status });
}

export function err(message: string, status = 400) {
  return NextResponse.json({ data: null, error: message, meta: null }, { status });
}
