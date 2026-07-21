import { NextRequest, NextResponse } from "next/server";

export function GET(request: NextRequest) {
  const configuredGatewayKey = process.env.ONECONTEXT_GATEWAY_KEY;
  const receivedGatewayKey = request.headers.get("x-onecontext-key");

  if (configuredGatewayKey && receivedGatewayKey !== configuredGatewayKey) {
    return NextResponse.json(
      { error: { code: "INVALID_GATEWAY_KEY", message: "A valid gateway key is required." } },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true });
}
