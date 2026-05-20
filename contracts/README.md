# Contracts

2차 단계에서 `CertificateRegistry` smart contract와 Foundry 자산을 추가했다.

구성:

- [src/CertificateRegistry.sol](/Users/jeong-yoonho/vscode/30ficate/contracts/src/CertificateRegistry.sol:1)
- [test/CertificateRegistry.t.sol](/Users/jeong-yoonho/vscode/30ficate/contracts/test/CertificateRegistry.t.sol:1)
- [script/DeployCertificateRegistry.s.sol](/Users/jeong-yoonho/vscode/30ficate/contracts/script/DeployCertificateRegistry.s.sol:1)

설계 고정 사항:

- contract 이름: `CertificateRegistry`
- 핵심 엔티티: `DomainRecord`, `CertificateRecord`, `CertificateStatusView`
- 핵심 쓰기 인터페이스: `registerDomain`, `approveCertificate`, `revokeCertificate`
- 핵심 읽기 인터페이스: `getCertificateStatus`, `getDomainOwner`, `getApprovedCertificates`
- 모든 승인/폐기 기록은 이벤트 로그로 남긴다

세부 설명은 [docs/contracts-phase2.md](/Users/jeong-yoonho/vscode/30ficate/docs/contracts-phase2.md:1) 를 따른다.
