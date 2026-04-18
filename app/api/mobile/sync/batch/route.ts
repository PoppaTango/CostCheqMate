import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileAccessToken, extractBearerToken } from "@/lib/mobile-auth";
import { logMobileMutation } from "@/lib/mobile-sync";

type SyncMutation = {
  entityType: string;
  entityId: string;
  operation: "create" | "update" | "delete";
  payload?: Record<string, unknown>;
  clientMutationId?: string;
  occurredAt?: string;
};

export async function POST(request: NextRequest) {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
    }

    const user = await authenticateMobileAccessToken(`Bearer ${token}`);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const mutations = Array.isArray(body?.mutations) ? (body.mutations as SyncMutation[]) : [];
    if (mutations.length === 0) {
      return NextResponse.json({ error: "mutations array is required" }, { status: 400 });
    }

    const accepted: string[] = [];
    for (const mutation of mutations) {
      if (
        !mutation.entityType ||
        !mutation.entityId ||
        !mutation.operation ||
        !["create", "update", "delete"].includes(mutation.operation)
      ) {
        continue;
      }

      const log = await logMobileMutation({
        userId: user.id,
        entityType: mutation.entityType,
        entityId: mutation.entityId,
        operation: mutation.operation,
        payload: mutation.payload,
        source: "mobile",
        clientMutationId: mutation.clientMutationId,
        occurredAt: mutation.occurredAt ? new Date(mutation.occurredAt) : undefined,
      });
      accepted.push(log.id);
    }

    return NextResponse.json({
      acceptedCount: accepted.length,
      acceptedMutationLogIds: accepted,
      rejectedCount: mutations.length - accepted.length,
    });
  } catch (error) {
    console.error("Mobile sync batch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
