import { parseAbiItem, type Address, type PublicClient } from "viem";
import { normalizeDomain } from "../domain/hash";
import { registryAddress, registryDeployedAtBlock } from "./contract";

const LOG_BLOCK_RANGE = 10n;

const domainRegisteredEvent = parseAbiItem(
  "event DomainRegistered(bytes32 indexed domainHash, string domain, address indexed ownerAddress, address indexed actor, uint256 registeredAt)"
);

type RegisteredDomainEntry = {
  domainHash: string;
  domain: string;
};

const registeredDomainCache = new Map<string, RegisteredDomainEntry[]>();
const registeredDomainPending = new Map<string, Promise<RegisteredDomainEntry[]>>();

export async function fetchRegisteredDomainsForAddress(
  publicClient: PublicClient,
  address: Address,
  forceRefresh = false
): Promise<RegisteredDomainEntry[]> {
  const cacheKey = address.toLowerCase();

  if (!forceRefresh) {
    const cached = registeredDomainCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const pending = registeredDomainPending.get(cacheKey);
    if (pending) {
      return pending;
    }
  }

  const task = (async () => {
    const latestBlock = await publicClient.getBlockNumber();
    const uniqueDomains = new Map<string, string>();
    let fromBlock = registryDeployedAtBlock;

    while (fromBlock <= latestBlock) {
      const toBlock =
        fromBlock + LOG_BLOCK_RANGE - 1n > latestBlock
          ? latestBlock
          : fromBlock + LOG_BLOCK_RANGE - 1n;

      const [ownerLogs, actorLogs] = await Promise.all([
        publicClient.getLogs({
          address: registryAddress,
          event: domainRegisteredEvent,
          fromBlock,
          toBlock
        }),
        publicClient.getLogs({
          address: registryAddress,
          event: domainRegisteredEvent,
          fromBlock,
          toBlock
        })
      ]);

      for (const log of [...ownerLogs, ...actorLogs]) {
        if (!log.args.domainHash) {
          continue;
        }

        const ownerAddress = log.args.ownerAddress?.toLowerCase();
        const actorAddress = log.args.actor?.toLowerCase();
        if (ownerAddress !== cacheKey && actorAddress !== cacheKey) {
          continue;
        }

        uniqueDomains.set(
          log.args.domainHash,
          normalizeDomain(log.args.domain ?? log.args.domainHash)
        );
      }

      fromBlock = toBlock + 1n;
    }

    const domains = Array.from(uniqueDomains.entries()).map(([domainHash, domain]) => ({
      domainHash,
      domain
    }));

    registeredDomainCache.set(cacheKey, domains);
    return domains;
  })();

  registeredDomainPending.set(cacheKey, task);

  try {
    return await task;
  } finally {
    registeredDomainPending.delete(cacheKey);
  }
}
