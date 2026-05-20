function pemToDerBytes(pem: string): Uint8Array {
  const base64 = pem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");

  return base64DerToBytes(base64);
}

function base64DerToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return bytes;
}

async function deriveSha256FromDerBytes(derBytes: Uint8Array): Promise<`0x${string}`> {
  const digestInput = Uint8Array.from(derBytes);
  const digest = await crypto.subtle.digest("SHA-256", digestInput);
  const hex = Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0")
  ).join("");

  return `0x${hex}` as `0x${string}`;
}

export async function deriveSha256CertHashFromPem(
  pemCertificate: string
): Promise<`0x${string}`> {
  const derBytes = pemToDerBytes(pemCertificate);
  return deriveSha256FromDerBytes(derBytes);
}

export async function deriveSha256CertHashFromBase64Der(
  base64Der: string
): Promise<`0x${string}`> {
  const derBytes = base64DerToBytes(base64Der.replace(/\s+/g, ""));
  return deriveSha256FromDerBytes(derBytes);
}
