import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wallet2 } from "lucide-react";
import { useAccount, useChainId } from "wagmi";
import { rainbowKitConfigState } from "../../lib/wagmi/config";
import { registryAddress, registryChainId } from "../../lib/chain/contract";

function shortenAddress(address?: string) {
  if (!address) {
    return "지갑 연결 필요";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletPanel(props: { compact?: boolean }) {
  const { address } = useAccount();
  const chainId = useChainId();
  const onExpectedChain = chainId === registryChainId;
  const compact = props.compact ?? false;

  if (compact) {
    return (
      <section className="wallet-sidebar-card">
        <div className="wallet-sidebar-contract">
          <p className="wallet-sidebar-section-title">ON-CHAIN CONTRACT</p>
          <span className="wallet-sidebar-network-pill">Sepolia Network</span>
          <p className="wallet-sidebar-contract-name">CertificateRegistry</p>
          <p className="wallet-sidebar-contract-address mono">{shortenAddress(registryAddress)}</p>
        </div>

        {address ? (
          <div className="wallet-sidebar-gate-card">
            <p className="wallet-sidebar-gate-title">Owner Wallet</p>
            <p className="wallet-sidebar-address wallet-sidebar-address-full mono">{address}</p>
          </div>
        ) : (
          <ConnectButton.Custom>
            {({ account, chain, mounted, openConnectModal, openChainModal }) => {
              const ready = mounted;
              const connected = ready && account && chain;

              if (connected) {
                return (
                  <button
                    className="wallet-sidebar-gate-card wallet-sidebar-gate-card-button"
                    onClick={chain.unsupported ? openChainModal : undefined}
                    type="button"
                  >
                    <p className="wallet-sidebar-gate-title">Owner Wallet</p>
                    <p className="wallet-sidebar-address wallet-sidebar-address-full mono">
                      {account.address}
                    </p>
                  </button>
                );
              }

              return (
                <button
                  className="wallet-sidebar-gate-card wallet-sidebar-gate-card-button"
                  onClick={openConnectModal}
                  type="button"
                >
                  <p className="wallet-sidebar-gate-empty">지갑 연결 필요</p>
                </button>
              );
            }}
          </ConnectButton.Custom>
        )}

        {!rainbowKitConfigState.walletConnectProjectIdConfigured && (
          <div className="wallet-sidebar-warning">
            `admin-web/.env`에 `VITE_WALLETCONNECT_PROJECT_ID`를 넣어야 wallet UX가 완전히 활성화됩니다.
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
