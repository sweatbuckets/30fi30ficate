import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { sepolia } from "wagmi/chains";

const walletConnectProjectId =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "YOUR_WALLETCONNECT_PROJECT_ID";

const sepoliaRpcUrl =
  import.meta.env.VITE_ETHEREUM_SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";

export const config = getDefaultConfig({
  appName: "30ficate Admin",
  projectId: walletConnectProjectId,
  chains: [sepolia],
  transports: { [sepolia.id]: http(sepoliaRpcUrl) }
});

export const rainbowKitConfigState = {
  walletConnectProjectIdConfigured:
    walletConnectProjectId !== "YOUR_WALLETCONNECT_PROJECT_ID"
};
