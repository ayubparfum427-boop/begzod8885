import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/security";
import { getAdminOverviewPayload } from "@/lib/overview-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getStaffSession(request);
    if (!session) {
      return NextResponse.json(
        { error: "Ruxsat berilmagan. Admin tizimiga kiring." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const payload = await getAdminOverviewPayload(fromParam, toParam);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("GET /api/admin/overview error:", err);
    return NextResponse.json(
      { error: "Statistikani yuklashda xatolik yuz berdi." },
      { status: 500 }
    );
  }
}
