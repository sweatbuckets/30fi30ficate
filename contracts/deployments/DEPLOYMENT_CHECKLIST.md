# Ethereum Sepolia Deployment Checklist

## 1. Prepare Environment

```bash
cd /Users/jeong-yoonho/vscode/30ficate/contracts
cp .env.example .env
```

필수 값:

- `ETHEREUM_SEPOLIA_RPC_URL`
- `DEPLOYER_PRIVATE_KEY`
- `REGISTRY_ADMIN`

## 2. Deploy

```bash
forge script script/DeployCertificateRegistry.s.sol:DeployCertificateRegistry \
  --rpc-url "$(grep '^ETHEREUM_SEPOLIA_RPC_URL=' .env | cut -d '=' -f2-)" \
  --private-key "$(grep '^DEPLOYER_PRIVATE_KEY=' .env | cut -d '=' -f2-)" \
  --broadcast
```

## 3. Record Deployment Artifact

배포 후 아래 파일을 업데이트한다.

- [ethereum-sepolia.json](/Users/jeong-yoonho/vscode/30ficate/contracts/deployments/ethereum-sepolia.json:1)

채워야 할 값:

- `address`
- `deployedAtBlock`
- `deployTxHash`

참고 placeholder:

- [ethereum-sepolia.update-template.json](/Users/jeong-yoonho/vscode/30ficate/contracts/deployments/ethereum-sepolia.update-template.json:1)

## 4. Propagate to Consumers

3차/4차 단계 소비자 기준점:

- ABI export:
  [../abi/CertificateRegistry.json](/Users/jeong-yoonho/vscode/30ficate/contracts/abi/CertificateRegistry.json:1)
- deployment metadata:
  [ethereum-sepolia.json](/Users/jeong-yoonho/vscode/30ficate/contracts/deployments/ethereum-sepolia.json:1)

추가 반영:

- Firefox extension의 `REGISTRY_CONTRACT_ADDRESS`
- Admin web의 contract config

참고:

- `REGISTRY_ADMIN`은 [script/DeployCertificateRegistry.s.sol](/Users/jeong-yoonho/vscode/30ficate/contracts/script/DeployCertificateRegistry.s.sol:1) 에서 `vm.envAddress("REGISTRY_ADMIN")`로 직접 읽는다.

