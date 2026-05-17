import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "This agent has been retired." }, { status: 410 });
}
