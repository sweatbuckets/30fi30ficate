# Admin Web

4차 단계에서 `Admin Web` 구현을 추가했다.

구성:

- [package.json](/Users/jeong-yoonho/vscode/30ficate/admin-web/package.json:1)
- [src/app/App.tsx](/Users/jeong-yoonho/vscode/30ficate/admin-web/src/app/App.tsx:1)
- [src/pages/DashboardPage.tsx](/Users/jeong-yoonho/vscode/30ficate/admin-web/src/pages/DashboardPage.tsx:1)
- [src/lib/wagmi/config.ts](/Users/jeong-yoonho/vscode/30ficate/admin-web/src/lib/wagmi/config.ts:1)
- [src/lib/chain/contract.ts](/Users/jeong-yoonho/vscode/30ficate/admin-web/src/lib/chain/contract.ts:1)
- [src/features/domains/DomainRegistrationForm.tsx](/Users/jeong-yoonho/vscode/30ficate/admin-web/src/features/domains/DomainRegistrationForm.tsx:1)
- [src/features/certificates/CertificateApprovalForm.tsx](/Users/jeong-yoonho/vscode/30ficate/admin-web/src/features/certificates/CertificateApprovalForm.tsx:1)
- [src/features/certificates/CertificateDashboard.tsx](/Users/jeong-yoonho/vscode/30ficate/admin-web/src/features/certificates/CertificateDashboard.tsx:1)
- [src/features/registry/RevocationPanel.tsx](/Users/jeong-yoonho/vscode/30ficate/admin-web/src/features/registry/RevocationPanel.tsx:1)
- [src/features/ct-discovery/CtDiscoveryPanel.tsx](/Users/jeong-yoonho/vscode/30ficate/admin-web/src/features/ct-discovery/CtDiscoveryPanel.tsx:1)
- [src/lib/ct-api/crtsh.ts](/Users/jeong-yoonho/vscode/30ficate/admin-web/src/lib/ct-api/crtsh.ts:1)
- [src/lib/ct-api/normalize.ts](/Users/jeong-yoonho/vscode/30ficate/admin-web/src/lib/ct-api/normalize.ts:1)

핵심 구현 범위:

- RainbowKit 기반 wallet UX
- domain registration
- approveCertificate form
- revokeCertificate flow
- getApprovedCertificates 기반 dashboard
- crt.sh 기반 CT discovery pending queue
- local approve/reject review state

환경값:

- [admin-web/.env.example](/Users/jeong-yoonho/vscode/30ficate/admin-web/.env.example:1) 의 `VITE_WALLETCONNECT_PROJECT_ID`

이 단계에서는 Firefox extension, smart contract 수정, 실제 CT API 연동을 포함하지 않는다.
