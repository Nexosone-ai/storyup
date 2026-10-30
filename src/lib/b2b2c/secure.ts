import "server-only";
import { randomBytes } from "crypto";
import { SECURE_TOKEN_BYTES } from "./config";

/** 추측 불가능한 공개 토큰(오퍼/청구서 URL용). URL-safe base64. */
export function secureToken(): string {
  return randomBytes(SECURE_TOKEN_BYTES).toString("base64url");
}

/** 표시용 청구서 번호 — INV-YYYYMMDD-XXXXXX. */
export function invoiceNumber(): string {
  const d = new Date();
  const ymd =
    `${d.getFullYear()}` +
    `${String(d.getMonth() + 1).padStart(2, "0")}` +
    `${String(d.getDate()).padStart(2, "0")}`;
  const rand = randomBytes(3).toString("hex").toUpperCase();
  return `INV-${ymd}-${rand}`;
}
