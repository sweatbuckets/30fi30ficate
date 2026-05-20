import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wallet2 } from "lucide-react";
import { useAccount, useChainId } from "wagmi";
import { rainbowKitConfigState } from "../../lib/wagmi/config";
import { registryChainId } from "../../lib/chain/contract";

export function WalletPanel(props: { compact?: boolean }) {
  const { address } = useAccount();
  const chainId = useChainId();
  const onExpectedChain = chainId === registryChainId;
  const compact = props.compact ?? false;

  if (compact) {
    return (
      <section className="wallet-compact glass p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Wallet
            </p>
            <div className="module-title-row">
              <span className="module-icon-badge">
                <Wallet2 size={16} strokeWidth={2.2} />
              </span>
              <h2 className="m-0 text-lg font-semibold">Connection</h2>
            </div>
          </div>

          <ConnectButton />
        </div>

        <div className="mt-4 grid gap-3">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white/70 p-3">
            <div>
              <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">Network</p>
              <p className="text-sm">{onExpectedChain ? "Ethereum Sepolia" : "Network not detected"}</p>
            </div>
            <span className={`status-chip ${onExpectedChain ? "status-approved" : "status-pending"}`}>
              {onExpectedChain ? "Sepolia" : "Wrong"}
            </span>
          </div>
        </div>

        {!rainbowKitConfigState.walletConnectProjectIdConfigured && (
          <div className="mt-4 rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 p-4 text-sm text-amber-900">
            `admin-web/.env`에 `VITE_WALLETCONNECT_PROJECT_ID`를 넣어야 RainbowKit wallet UX가 완전히 활성화됩니다.
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="glass p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Wallet
          </p>
          <div className="module-title-row">
            <span className="module-icon-badge">
              <Wallet2 size={18} strokeWidth={2.2} />
            </span>
            <h2 className="m-0 text-2xl font-semibold">MetaMask Connection</h2>
          </div>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
            RainbowKit 기반 지갑 연결 UI입니다. Ethereum Sepolia에서 `CertificateRegistry`를 읽고 씁니다.
          </p>
        </div>

        <ConnectButton />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
          <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">Address</p>
          <p className="mono text-sm">{address ?? "Not connected"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
          <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">Chain</p>
          <p className="text-sm">{chainId ? `Chain ID ${chainId}` : "Unknown"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
          <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">Network Gate</p>
          <span className={`status-chip ${onExpectedChain ? "status-approved" : "status-pending"}`}>
            {onExpectedChain ? "Ethereum Sepolia" : "Wrong Network"}
          </span>
        </div>
      </div>

      {!rainbowKitConfigState.walletConnectProjectIdConfigured && (
        <div className="mt-4 rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 p-4 text-sm text-amber-900">
          `admin-web/.env`에 `VITE_WALLETCONNECT_PROJECT_ID`를 넣어야 RainbowKit wallet UX가 완전히 활성화됩니다.
        </div>
      )}
    </section>
  );
}
