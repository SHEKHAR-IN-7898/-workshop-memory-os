import "dotenv/config";
import { SignJWT, jwtVerify } from "jose";

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters");
}
const key = new TextEncoder().encode(secret);

export type SessionClaims = {
  userId: string;
  tenantId: string;
  role: string;
};

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_TTL ?? "8h")
    .sign(key);
}

export async function verifySession(token: string): Promise<SessionClaims> {
  const { payload } = await jwtVerify(token, key);
  if (
    typeof payload.userId !== "string" ||
    typeof payload.tenantId !== "string" ||
    typeof payload.role !== "string"
  ) throw new Error("Invalid session claims");
  return { userId: payload.userId, tenantId: payload.tenantId, role: payload.role };
}
