# Extension

3차 단계에서 Firefox WebExtension 구현을 추가했다.

구성:

- [manifest.json](/Users/jeong-yoonho/vscode/30ficate/extension/manifest.json:1)
- [src/background/index.ts](/Users/jeong-yoonho/vscode/30ficate/extension/src/background/index.ts:1)
- [src/background/fingerprint.ts](/Users/jeong-yoonho/vscode/30ficate/extension/src/background/fingerprint.ts:1)
- [src/background/registry-client.ts](/Users/jeong-yoonho/vscode/30ficate/extension/src/background/registry-client.ts:1)
- [src/popup/index.html](/Users/jeong-yoonho/vscode/30ficate/extension/src/popup/index.html:1)
- [src/popup/main.ts](/Users/jeong-yoonho/vscode/30ficate/extension/src/popup/main.ts:1)

핵심 구현 범위:

- `browser.webRequest.getSecurityInfo()` 기반 HTTPS 요청 관찰
- leaf certificate fingerprint 추출
- `domainHash` 계산
- `CertificateRegistry.getCertificateStatus()` 조회
- popup과 badge 상태 표시
- `esbuild` 기반 background/popup 번들링

현재 TODO:

- [src/shared/constants.ts](/Users/jeong-yoonho/vscode/30ficate/extension/src/shared/constants.ts:1) 의 `REGISTRY_CONTRACT_ADDRESS`를 실제 배포 주소로 교체해야 on-chain 조회가 동작한다.
- 배포 메타데이터 canonical path는 [contracts/deployments/ethereum-sepolia.json](/Users/jeong-yoonho/vscode/30ficate/contracts/deployments/ethereum-sepolia.json:1) 이고, ABI export path는 [contracts/abi/CertificateRegistry.json](/Users/jeong-yoonho/vscode/30ficate/contracts/abi/CertificateRegistry.json:1) 로 고정한다.

빌드:

- `pnpm install`
- `pnpm build`

이 단계에서는 admin web, CT API, smart contract 수정은 포함하지 않는다.
