import { useState } from "react";
import { Globe2 } from "lucide-react";
import { useAccount, useWriteContract } from "wagmi";
import { deriveDomainHash, normalizeDomain } from "../../lib/domain/hash";
import { registryAbi, registryAddress, registryChainId } from "../../lib/chain/contract";
import type { DomainFormState } from "../../types/admin";

const initialState: DomainFormState = {
  domain: "",
  ownerAddress: ""
};

export function DomainRegistrationForm() {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const [state, setState] = useState<DomainFormState>({
    ...initialState,
    ownerAddress: address ?? ""
  });

  const normalizedDomain = normalizeDomain(state.domain);
  const domainHash = normalizedDomain
    ? deriveDomainHash(registryChainId, normalizedDomain)
    : "";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await writeContractAsync({
      address: registryAddress,
      abi: registryAbi,
      functionName: "registerDomain",
      args: [normalizedDomain, domainHash as `0x${string}`, state.ownerAddress as `0x${string}`]
    });
  }

  return (
    <section className="glass p-6">
      <div className="mb-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          Register Domain
        </p>
        <div className="module-title-row">
          <span className="module-icon-badge">
            <Globe2 size={18} strokeWidth={2.2} />
          </span>
          <h2 className="m-0 text-xl font-semibold">Domain Registration</h2>
        </div>
      </div>

      <form className="grid gap-4" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="domain">Domain</label>
          <input
            id="domain"
            placeholder="example.com"
            value={state.domain}
            onChange={(event) => setState((prev) => ({ ...prev, domain: event.target.value }))}
          />
        </div>

        <div className="field">
          <label htmlFor="owner-address">Owner Address</label>
          <input
            id="owner-address"
            placeholder="0x..."
            value={state.ownerAddress}
            onChange={(event) =>
              setState((prev) => ({ ...prev, ownerAddress: event.target.value }))
            }
          />
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
          <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">Normalized</p>
          <p className="text-sm">{normalizedDomain || "-"}</p>
          <p className="mb-1 mt-4 text-xs uppercase tracking-[0.18em] text-slate-500">domainHash</p>
          <p className="mono text-sm break-all">{domainHash || "-"}</p>
        </div>

        <button className="btn btn-primary" disabled={isPending || !domainHash}>
          {isPending ? "Registering..." : "registerDomain()"}
        </button>
      </form>
    </section>
  );
}
