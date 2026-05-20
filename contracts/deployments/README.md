# Deployments

이 디렉토리는 네트워크별 배포 아티팩트를 저장한다.

현재 고정 구조:

- `ethereum-sepolia.json`
- `ethereum-sepolia.update-template.json`
- `DEPLOYMENT_CHECKLIST.md`

필드:

- `network`
- `chainId`
- `contractName`
- `address`
- `deployedAtBlock`
- `deployTxHash`
- `abiPath`
- `artifactSourcePath`
- `notes`

의도:

- 3차 Firefox Extension과 4차 Admin Web이 같은 contract address와 chain metadata를 참조한다.
- ABI는 [../abi/CertificateRegistry.json](/Users/jeong-yoonho/vscode/30ficate/contracts/abi/CertificateRegistry.json:1) 경로를 기준으로 고정한다.
- 실제 배포 후에는 placeholder 값을 실배포 정보로 교체한다.

환경변수 템플릿:

- [../.env.example](/Users/jeong-yoonho/vscode/30ficate/contracts/.env.example:1)

원칙:

- 배포용 비밀값은 `contracts/.env`에 둔다.
- Foundry script는 `vm.env*`로 `.env` 값을 직접 읽는다.
- shell `export`는 필수 전제가 아니다.
