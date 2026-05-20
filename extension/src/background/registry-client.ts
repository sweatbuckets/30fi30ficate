import { createPublicClient, getContract, http } from "viem";
import { sepolia } from "viem/chains";
import {
  ETHEREUM_SEPOLIA_RPC_URL,
  REGISTRY_CONTRACT_ADDRESS
} from "../shared/constants";
import type { CertificateStatusView } from "../shared/types";

const certificateRegistryAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "getCertificateStatus",
    inputs: [
      { name: "domainHash", type: "bytes32" },
      { name: "certHash", type: "bytes32" }
    ],
    outputs: [
      {
        name: "status",
        type: "tuple",
        components: [
          { name: "exists", type: "bool" },
          { name: "approved", type: "bool" },
          { name: "revoked", type: "bool" },
          { name: "approvedAt", type: "uint256" },
          { name: "revokedAt", type: "uint256" },
          { name: "issuer", type: "string" },
          { name: "subject", type: "string" },
          { name: "serialNumber", type: "string" },
          { name: "validFrom", type: "uint256" },
          { name: "validTo", type: "uint256" },
          { name: "fingerprintAlgorithm", type: "string" },
          { name: "memo", type: "string" }
        ]
      }
    ]
  }
] as const;

function isRegistryConfigured(): boolean {
  return !/^0x0{40}$/i.test(REGISTRY_CONTRACT_ADDRESS);
}

export async function getCertificateStatus(
  domainHash: `0x${string}`,
  certHash: `0x${string}`
): Promise<CertificateStatusView | null> {
  if (!isRegistryConfigured()) {
    return null;
  }

  const client = createPublicClient({
    chain: sepolia,
    transport: http(ETHEREUM_SEPOLIA_RPC_URL)
  });

  const contract = getContract({
    address: REGISTRY_CONTRACT_ADDRESS,
    abi: certificateRegistryAbi,
    client
  });

  const status = await contract.read.getCertificateStatus([domainHash, certHash]);

  return {
    exists: status.exists,
    approved: status.approved,
    revoked: status.revoked,
    approvedAt: status.approvedAt,
    revokedAt: status.revokedAt,
    issuer: status.issuer,
    subject: status.subject,
    serialNumber: status.serialNumber,
    validFrom: status.validFrom,
    validTo: status.validTo,
    fingerprintAlgorithm: status.fingerprintAlgorithm,
    memo: status.memo
  };
}

export function getRegistryConfigState(): { rpcConfigured: boolean } {
  return {
    rpcConfigured: isRegistryConfigured()
  };
}
