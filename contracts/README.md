# Contracts

`contracts`는 30ficate의 on-chain certificate approval registry를 담당합니다.

핵심 컨트랙트는 `CertificateRegistry`이며, 도메인 owner 등록, 인증서 승인, 인증서 폐기, 상태 조회를 위한 canonical registry 역할을 합니다.

## 역할

이 모듈은 다음 역할을 담당합니다.

- 도메인 owner 등록
- 도메인별 승인된 인증서 기록
- 인증서 폐기 기록
- extension과 admin-web이 공통으로 참조하는 on-chain truth source 제공
- 이벤트 로그 기반 감사 추적

즉 실제 브라우저 검증 로직은 extension이 수행하지만, **무엇이 승인되었고 무엇이 폐기되었는지에 대한 최종 기준 데이터는 이 컨트랙트가 유지**합니다.

## 현재 구현 범위

현재 `contracts`에는 다음이 구현되어 있습니다.

- `CertificateRegistry` Solidity contract
- Foundry 테스트
- Forge deployment script
- ABI export
- Ethereum Sepolia deployment artifact

## 핵심 데이터 모델

대표 엔티티는 다음과 같습니다.

- `DomainRecord`
  - 도메인 등록 상태
  - `domain`, `domainHash`, `ownerAddress`, `registeredAt`

- `CertificateRecord`
  - 특정 도메인 아래 특정 인증서의 승인/폐기 상태
  - `certHash`, `issuer`, `subject`, `serialNumber`, `validFrom`, `validTo`, `memo` 등

- `CertificateStatusView`
  - extension과 admin-web이 공통으로 소비하는 read model

## 핵심 인터페이스

### Write

- `registerDomain()`
- `approveCertificate()`
- `revokeCertificate()`

### Read

- `getCertificateStatus()`
- `getDomainOwner()`
- `getApprovedCertificates()`

## 권한 모델

MVP 기준 권한 모델은 단순합니다.

- deploy 시 지정된 `admin`
- 각 `domainHash`에 대응하는 `domain owner`

이 둘만 domain registration, certificate approval, certificate revocation을 수행할 수 있습니다.

## 배포 상태

현재 컨트랙트는 `Ethereum Sepolia`에 배포되어 있습니다.

- Network: `ethereum-sepolia`
- Chain ID: `11155111`
- Contract: `CertificateRegistry`

정확한 주소와 배포 메타데이터는 `deployments/ethereum-sepolia.json`에 기록됩니다.

## 왜 온체인에 두는가

30ficate에서 컨트랙트는 다음 목적을 위해 사용됩니다.

- 승인/폐기 이력 위변조 방지
- 공개 감사 가능성
- extension과 admin-web 사이의 공통 truth source
- domain owner approval history의 공개 검증

## 현재 한계

- ownership transfer는 아직 없음
- multi-owner approval은 아직 없음
- DNS TXT 기반 owner verification은 아직 없음
- certHash와 domainHash derivation은 off-chain responsibility
