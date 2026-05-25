import certificateRegistryAbi from "../../../../contracts/abi/CertificateRegistry.json";
import deployment from "../../../../contracts/deployments/ethereum-sepolia.json";

export const registryAbi = certificateRegistryAbi;
export const registryAddress = deployment.address as `0x${string}`;
export const registryChainId = deployment.chainId;
export const registryDeployedAtBlock = BigInt(deployment.deployedAtBlock);
