/**
 * Port for a stable, random per-install identifier. It is NOT a fingerprint:
 * it is generated locally and only used server-side, HMAC-hashed, for anti-fraud
 * and ban evasion (PRD 4.1 ban_identifiers, 6.15 A04).
 */
export interface DeviceIdService {
  getDeviceId(): Promise<string>
}
