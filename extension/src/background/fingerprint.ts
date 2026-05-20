import type {
  CertificateChainEntry,
  CertificateObservation,
  RawFirefoxCertificate,
  RawFirefoxSecurityInfo
} from "../shared/types";

function normalizeFingerprintHex(value: string): `0x${string}` {
  const compact = value.replace(/:/g, "").trim().toLowerCase();
  return `0x${compact}` as `0x${string}`;
}

async function sha256Hex(input: ArrayBuffer): Promise<`0x${string}`> {
  const digest = await crypto.subtle.digest("SHA-256", input);
  const bytes = Array.from(new Uint8Array(digest));
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `0x${hex}` as `0x${string}`;
}

function normalizeRawDerInput(value: ArrayBuffer | number[]): ArrayBuffer {
  if (value instanceof ArrayBuffer) {
    return value;
  }

  return Uint8Array.from(value).buffer;
}

function parseValidityTimestamp(value?: string | number): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") {
    return value;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : Math.floor(timestamp / 1000);
}

async function deriveCertHash(certificate: RawFirefoxCertificate): Promise<`0x${string}`> {
  if (certificate.rawDER) {
    return sha256Hex(normalizeRawDerInput(certificate.rawDER));
  }

  const sha256 =
    certificate.fingerprints?.sha256 ?? certificate.fingerprint?.sha256;

  if (sha256) {
    return normalizeFingerprintHex(sha256);
  }

  throw new Error("Unable to derive certificate fingerprint from Firefox security info.");
}

function buildCertificateChain(
  certificates: RawFirefoxCertificate[]
): CertificateChainEntry[] {
  return certificates.map((certificate, index) => ({
    role:
      index === 0
        ? "leaf"
        : index === certificates.length - 1
          ? "root"
          : "intermediate",
    subject: certificate.subject ?? "Unknown subject",
    issuer: certificate.issuer ?? "Unknown issuer"
  }));
}

export async function extractLeafCertificateObservation(
  securityInfo: RawFirefoxSecurityInfo
): Promise<CertificateObservation> {
  const certificates = securityInfo.certificates ?? [];
  const [leafCertificate] = certificates;

  if (!leafCertificate) {
    throw new Error("Leaf certificate was not present in Firefox security info.");
  }

  return {
    certHash: await deriveCertHash(leafCertificate),
    issuer: leafCertificate.issuer ?? "Unknown issuer",
    subject: leafCertificate.subject ?? "Unknown subject",
    serialNumber: leafCertificate.serialNumber ?? "Unknown serial",
    validFrom: parseValidityTimestamp(leafCertificate.validity?.start),
    validTo: parseValidityTimestamp(leafCertificate.validity?.end),
    fingerprintAlgorithm: "SHA-256",
    chain: buildCertificateChain(certificates)
  };
}
