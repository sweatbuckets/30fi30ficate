# 30ficate

Firefox 기반 온체인 TLS 인증서 검증 보조 시스템

---

# 🇰🇷 Korean

## 프로젝트 개요

30ficate는 Firefox 기반 온체인 TLS 인증서 검증 보조 시스템입니다.

브라우저가 실제 TLS 연결에서 받은 인증서 fingerprint를 기반으로, 도메인 owner가 온체인에 승인한 인증서인지 추가 검증합니다.

즉, 30ficate Firefox Extension은 현재 접속한 사이트의 HTTPS 인증서가 도메인 관리자(owner)에게 온체인 승인되었는지를 확인하는 브라우저 보조 보안 레이어입니다.

브라우저 확장은 현재 탭의 leaf certificate fingerprint를 읽고, on-chain certificate registry와 비교하여 승인 여부를 경고 UI로 표시합니다.

또한 Certificate Transparency(CT) 생태계 기반 인증서 검색 소스를 조회하여 특정 도메인에 발급된 인증서를 발견하고, owner가 해당 인증서를 승인 또는 검토할 수 있는 기능을 제공합니다.

기존 PKI를 대체하지 않고, CA 오발급 및 승인되지 않은 인증서 사용을 탐지하기 위한 보안 보조 레이어를 제공합니다.

---

## 프로젝트 동기

기존 웹 PKI는 다음 구조를 사용합니다.

```text
CA가 인증서를 발급
→ 브라우저가 신뢰
```

하지만 다음과 같은 문제가 발생할 수 있습니다.

- CA 오발급
- DNS 일시 탈취 후 인증서 발급
- 폐기 지연
- 도메인 owner가 승인하지 않은 인증서 사용

30ficate는 다음 구조를 추가합니다.

```text
CA가 인증서를 발급
+ CT 로그에 인증서 기록
+ 도메인 owner가 certHash를 온체인 승인
→ Firefox Extension이 추가 검증
```

즉, CA가 발급했더라도 도메인 owner가 승인하지 않은 인증서는 위험 신호로 표시합니다.

---

## 핵심 기능

- Firefox TLS certificate inspection
- SHA-256 certificate fingerprint verification
- On-chain approved certificate registry
- Revoked certificate detection
- Certificate Transparency 기반 certificate discovery
- Browser warning UI
- Smart contract auditability
- Domain owner approval workflow

---

## 시스템 구조

```text
Firefox Browser
 └─ 30ficate Extension
      ├─ TLS certificate fingerprint extraction
      ├─ On-chain certificate verification
      └─ Warning UI

Admin Web
 ├─ Domain registration
 ├─ CT certificate discovery
 ├─ Certificate approval
 └─ Certificate revocation

Ethereum Sepolia
 └─ CertificateRegistry Smart Contract
```

---

## 인증서 검증 흐름

```text
1. 사용자가 HTTPS 사이트 접속
2. Firefox가 기본 TLS 검증 수행
3. 30ficate가 TLS certificate fingerprint 추출
4. 온체인 approved certHash 조회
5. 현재 certHash와 approved certHash 비교
6. 결과 UI 표시
```

---

## CT 검색 연동

30ficate는 CT 검색 API를 사용하여 등록된 도메인과 관련된 인증서를 발견합니다.

```text
1. 도메인 owner가 도메인 등록
2. Admin Web이 인증서 검색 API 조회
3. 검색 결과에서 owner가 승인할 인증서를 선택
4. 선택한 인증서를 approve 흐름으로 연결
5. approve 시 온체인 등록
```

현재 구현은 검색 결과를 approval flow에 연결하는 구조이며, 실시간 자동 모니터링은 future work로 남겨두었습니다.

---

## 위협 모델

### 방어 대상

- CA 오발급
- 승인되지 않은 인증서 발급
- DNS 탈취 기반 인증서 발급
- 폐기된 인증서 재사용
- 도메인 owner가 승인하지 않은 인증서

### 방어하지 못하는 대상

- 피싱 도메인
- 서버 자체 해킹
- 사용자 단말 악성코드
- Root CA 저장소 오염
- TLS가 없는 HTTP 연결

---

## 확장프로그램 상태 UI

### Approved
🟢 온체인 승인 인증서

### Unapproved
🔴 온체인 미승인 인증서

### Revoked
🔴 폐기된 인증서 감지

### HTTP
⚪ HTTPS 인증서 검증 대상 아님

### RPC Failure
🟡 온체인 상태 확인 불가

### TLS Observation Failure
🟠 현재 요청에서 인증서 security info를 읽지 못함

---

## 기술 스택

### Blockchain

- Solidity
- Foundry
- Forge test
- Forge script
- OpenZeppelin
- Ethereum Sepolia

### Frontend

- React
- TypeScript
- Vite
- TailwindCSS
- wagmi
- viem

### Browser Extension

- Firefox WebExtension API
- TypeScript
- web-ext
- browser.webRequest.getSecurityInfo()

### CT Integration

- SSLMate Certificate Search API
- CertStream

---

## 스마트컨트랙트

### Contract

```text
CertificateRegistry
```

### Core Functions

- registerDomain()
- approveCertificate()
- revokeCertificate()
- getCertificateStatus()
- getDomainOwner()

### Stored Metadata

- domainHash
- ownerAddress
- certHash
- issuer
- subject
- serialNumber
- validFrom
- validTo
- revoked status

---

## 왜 블록체인을 사용하는가

30ficate는 다음 이유로 블록체인을 사용합니다.

- 인증서 승인/폐기 기록 위변조 방지
- 공개 감사 가능성
- 탈중앙 검증
- append-only 성격 제공
- 도메인 owner 승인 이력 공개 검증 가능

---

## 현재 한계

- TLS 연결 전 차단 불가
- Firefox-only MVP
- 자동 DNS ownership verification 미구현
- RPC availability 의존
- 인증서 검색은 외부 CT 검색 API 의존
- CertStream 기반 실시간 자동 모니터링 미구현

30ficate는 브라우저 TLS 검증을 대체하는 시스템이 아니라, 사후 검증 및 경고 레이어입니다.

---

## 향후 확장 방향

- DNS TXT ownership verification
- Chromium support
- Local proxy pre-connection verification
- Multi-owner approval
- Hardware wallet signing
- CertStream 기반 real-time certificate monitoring
- Slack/Discord certificate alerts
- SIEM integration
- Auto certificate discovery worker
- Local node/light client support

---

## 연구 목표

30ficate는 기존 Web PKI 생태계를 대체하지 않고, 도메인 owner의 온체인 인증서 승인 모델이 기존 TLS 신뢰 모델을 얼마나 강화할 수 있는지 탐구하는 연구 프로젝트입니다.

---

# 🇺🇸 English

## Overview

30ficate is a Firefox-based browser security extension that performs additional verification on TLS certificates using on-chain approval records.

The extension extracts the actual TLS certificate fingerprint received during an HTTPS connection and compares it against certificate fingerprints approved by the domain owner on-chain.

30ficate also integrates with Certificate Transparency logs to automatically discover certificates issued for registered domains and allows domain owners to approve or review those certificates.

30ficate does not replace the existing PKI model. Instead, it adds an additional trust layer designed to mitigate risks such as CA mis-issuance and unauthorized certificate usage.

---

## Motivation

Traditional Web PKI follows the model below:

```text
CA issues certificate
→ Browser trusts certificate
```

However, this model can still suffer from:

- CA mis-issuance
- DNS hijack-based certificate issuance
- Delayed revocation propagation
- Certificates not approved by the domain owner

30ficate introduces an additional trust layer:

```text
CA issues certificate
+ Certificate appears in CT logs
+ Domain owner approves certHash on-chain
→ Firefox Extension performs additional verification
```

In other words, even if a certificate is validly issued by a CA, 30ficate warns users when the certificate has not been approved by the domain owner.

---

## Core Features

- Firefox TLS certificate inspection
- SHA-256 certificate fingerprint verification
- On-chain approved certificate registry
- Revoked certificate detection
- Certificate Transparency-based certificate discovery
- Browser warning UI
- Smart contract auditability
- Domain owner approval workflow

---

## Architecture

```text
Firefox Browser
 └─ 30ficate Extension
      ├─ TLS certificate fingerprint extraction
      ├─ On-chain certificate verification
      └─ Warning UI

Admin Web
 ├─ Domain registration
 ├─ CT certificate discovery
 ├─ Certificate approval
 └─ Certificate revocation

Ethereum Sepolia
 └─ CertificateRegistry Smart Contract
```

---

## Verification Flow

```text
1. User accesses HTTPS website
2. Firefox performs default TLS validation
3. 30ficate extracts TLS certificate fingerprint
4. Extension queries on-chain approved certHash
5. Compare current certHash with approved certHash
6. Show verification result to user
```

---

## Certificate Transparency Integration

30ficate integrates with CT APIs to discover certificates issued for registered domains.

```text
1. Domain owner registers domain
2. Admin Web queries CT logs
3. Newly discovered certificates appear as Pending
4. Domain owner approves or rejects certificates
5. Approved certificates are registered on-chain
```

This allows 30ficate to act as a domain-owner approval layer on top of existing CT infrastructure.

---

## Threat Model

### Defends Against

- CA mis-issuance
- Unauthorized certificate issuance
- DNS hijack-based certificate issuance
- Revoked certificate reuse
- Certificates not approved by the domain owner

### Does NOT Defend Against

- Phishing domains
- Server compromise
- Malware on user devices
- Root CA store compromise
- HTTP connections without TLS

---

## Extension Status UI

### Approved
🟢 On-chain approved certificate

### Unapproved
🔴 Certificate not approved on-chain

### Revoked
🔴 Revoked certificate detected

### HTTP
⚪ Not an HTTPS verification target

### RPC Failure
🟡 Unable to verify on-chain state

---

## Tech Stack

### Blockchain

- Solidity
- Foundry
- Forge test
- Forge script
- OpenZeppelin
- Ethereum Sepolia

### Frontend

- React
- TypeScript
- Vite
- TailwindCSS
- wagmi
- viem

### Browser Extension

- Firefox WebExtension API
- TypeScript
- web-ext
- browser.webRequest.getSecurityInfo()

### CT Integration

- crt.sh API
- CertStream

---

## Smart Contract

### Contract

```text
CertificateRegistry
```

### Core Functions

- registerDomain()
- approveCertificate()
- revokeCertificate()
- getCertificateStatus()
- getDomainOwner()

### Stored Metadata

- domainHash
- ownerAddress
- certHash
- issuer
- subject
- serialNumber
- validFrom
- validTo
- revoked status

---

## Why Blockchain?

30ficate uses blockchain to provide:

- Immutable certificate approval and revocation history
- Public auditability
- Decentralized verification
- Append-only trust records
- Transparent domain-owner approval history

---

## Current Limitations

- Does not block TLS connections before handshake
- Firefox-only MVP
- No automatic DNS ownership verification
- Depends on RPC availability
- CT discovery relies on external CT APIs

30ficate is designed as a post-verification warning layer, not a replacement for browser TLS validation.

---

## Future Work

- DNS TXT ownership verification
- Chromium support
- Local proxy pre-connection verification
- Multi-owner approval
- Hardware wallet signing
- Certificate monitoring dashboard
- Slack/Discord certificate alerts
- SIEM integration
- Auto certificate discovery worker
- Local node/light client support

---

## Research Goal

30ficate explores whether domain-owner-controlled on-chain certificate approval can strengthen trust in the existing Web PKI ecosystem without replacing browsers’ native TLS validation systems
