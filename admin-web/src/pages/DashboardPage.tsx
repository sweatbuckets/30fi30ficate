import { useEffect, useState } from "react";
import { Ban, Globe2, House, Info, LayoutDashboard, Lock, Search, ShieldCheck } from "lucide-react";
import { useAccount } from "wagmi";
import { WalletPanel } from "../features/wallet/WalletPanel";
import { DomainRegistrationForm } from "../features/domains/DomainRegistrationForm";
import { CertificateApprovalForm } from "../features/certificates/CertificateApprovalForm";
import { CertificateDashboard } from "../features/certificates/CertificateDashboard";
import { RevocationPanel } from "../features/registry/RevocationPanel";
import thirtyficateLogo from "../../../extension/assets/icons/30ficate_icon.png";

const figmaSidebarLogo =
  "https://www.figma.com/api/mcp/asset/91dc30f2-9cd6-4e01-9cff-f92d185d25e4";
const figmaHeroLogo =
  "https://www.figma.com/api/mcp/asset/049924c5-c1b2-41cb-a3b7-b80e81ea0ecc";

type AdminSection = "home" | "domain-registration" | "certificate-approval" | "certificate-dashboard" | "revocation";

const sections: Array<{
  id: AdminSection;
  label: string;
  eyebrow: string;
  description: string;
  icon: typeof Globe2;
}> = [
  {
    id: "home",
    label: "홈",
    eyebrow: "Home",
    description: "30ficate 프로젝트 개요와 향후 발전 방향을 확인합니다.",
    icon: House
  },
  {
    id: "domain-registration",
    label: "도메인 등록",
    eyebrow: "Domain Registration",
    description: "도메인 owner를 온체인에 등록하는 단계입니다.",
    icon: Globe2
  },
  {
    id: "certificate-approval",
    label: "인증서 승인",
    eyebrow: "Certificate Approval",
    description: "승인할 인증서 메타데이터와 certHash를 직접 입력해 온체인 approve 하는 단계입니다.",
    icon: ShieldCheck
  },
  {
    id: "certificate-dashboard",
    label: "승인 대시보드",
    eyebrow: "Approved Certificate Dashboard",
    description: "이미 승인되거나 조회 가능한 인증서 상태를 확인합니다.",
    icon: LayoutDashboard
  },
  {
    id: "revocation",
    label: "인증 취소",
    eyebrow: "Revocation",
    description: "이미 승인한 인증서를 revoke 하는 단계입니다.",
    icon: Ban
  }
];

export function DashboardPage() {
  const { isConnected } = useAccount();
  const [activeSection, setActiveSection] = useState<AdminSection>("home");

  useEffect(() => {
    if (!isConnected && activeSection !== "home") {
      setActiveSection("home");
    }
  }, [activeSection, isConnected]);

  if (activeSection === "home") {
    return (
      <ConsoleScreen
        activeSection={activeSection}
        isConnected={isConnected}
        onSelectSection={setActiveSection}
      >
        <HomePanel />
      </ConsoleScreen>
    );
  }

  return (
    <ConsoleScreen
      activeSection={activeSection}
      isConnected={isConnected}
      onSelectSection={setActiveSection}
    >
      {activeSection === "domain-registration" && <DomainRegistrationForm />}
      {activeSection === "certificate-approval" && <CertificateApprovalForm />}
      {activeSection === "certificate-dashboard" && <CertificateDashboard />}
      {activeSection === "revocation" && <RevocationPanel />}
    </ConsoleScreen>
  );
}

function HomePanel() {
  return (
    <section className="home-screen-content">
      <div className="home-screen-section-copy">
        <p className="home-screen-eyebrow">Overview</p>
        <h1 className="home-screen-title">프로젝트 소개</h1>
        <p className="home-screen-subtitle">
          30ficate의 검증 목적과 구현 범위, 이후 확장 방향을 확인하세요.
        </p>
      </div>

      <div className="home-screen-overview-grid">
        <article className="home-card home-card-large">
          <div className="home-card-header">
            <h2 className="home-card-title">What 30ficate Does</h2>
            <span className="home-pill home-pill-primary">CORE PURPOSE</span>
          </div>
          <p className="home-card-body">
            30ficate는 기존 TLS 검증 위에서 브라우저가 받은 leaf certificate가 도메인 owner에게
            온체인 승인되었는지를 추가로 확인하는 보안 레이어입니다.
          </p>
          <div className="home-trust-flow">
            <p className="home-trust-flow-label">TRUST-CHECK FLOW</p>
            <div className="home-trust-flow-steps">
              <span className="home-step-pill">
                <span className="home-step-index">1</span>
                Certificate
              </span>
              <span className="home-step-arrow">›</span>
              <span className="home-step-pill">
                <span className="home-step-index">2</span>
                Approval
              </span>
              <span className="home-step-arrow">›</span>
              <span className="home-step-pill">
                <span className="home-step-index">3</span>
                Trust status
              </span>
            </div>
          </div>
        </article>

        <div className="home-side-stack">
          <article className="home-brand-card">
            <img alt="30ficate logo" className="home-brand-logo" src={figmaHeroLogo} />
            <div>
              <p className="home-brand-title">30ficate</p>
              <p className="home-brand-subtitle">Onchain certificate trust layer</p>
            </div>
          </article>

          <article className="home-card">
            <div className="home-card-header">
              <h2 className="home-card-title">Current Limits</h2>
              <span className="home-pill home-pill-warning">LIMITS</span>
            </div>
            <p className="home-card-body home-card-body-tight">
              Firefox-only, TLS 연결 전 차단 불가, DNS ownership verification 미구현, 외부 RPC / CT
              소스 의존성이 현재 한계입니다.
            </p>
          </article>
        </div>
      </div>

      <div className="home-screen-future-header">
        <div>
          <p className="home-screen-eyebrow home-screen-eyebrow-secondary">Future Work</p>
          <h2 className="home-screen-future-title">향후 발전 방향</h2>
        </div>
      </div>

      <div className="future-grid">
        <div className="home-roadmap-card">
          <span className="home-pill home-pill-secondary">ROADMAP</span>
          <strong>DNS TXT ownership verification</strong>
          <span>도메인 제어권을 TXT challenge 기반으로 검증</span>
        </div>
        <div className="home-roadmap-card">
          <span className="home-pill home-pill-secondary">ROADMAP</span>
          <strong>CertStream monitoring</strong>
          <span>실시간 인증서 발급 감시와 알림 자동화</span>
        </div>
        <div className="home-roadmap-card">
          <span className="home-pill home-pill-secondary">ROADMAP</span>
          <strong>Chromium support</strong>
          <span>Firefox MVP 이후 브라우저 지원 확대</span>
        </div>
        <div className="home-roadmap-card">
          <span className="home-pill home-pill-secondary">ROADMAP</span>
          <strong>Pre-connection verification</strong>
          <span>local proxy 기반 선제 차단 레이어 실험</span>
        </div>
        <div className="home-roadmap-card">
          <span className="home-pill home-pill-secondary">ROADMAP</span>
          <strong>Multi-owner approval</strong>
          <span>여러 승인 주체와 운영 정책 확장</span>
        </div>
        <div className="home-roadmap-card">
          <span className="home-pill home-pill-secondary">ROADMAP</span>
          <strong>Monitoring integrations</strong>
          <span>Slack, Discord, SIEM, dashboard 연계</span>
        </div>
      </div>

      <div className="home-wallet-gate-banner">
        <div className="home-wallet-gate-message">
          <Info size={16} strokeWidth={2.2} />
          <span>
            지갑 연결 후에만 도메인 등록, 인증서 승인, 상태 조회, 인증 취소 기능을 사용할 수
            있습니다.
          </span>
        </div>
        <span className="home-pill home-pill-warning">WALLET GATE</span>
      </div>
    </section>
  );
}

function ConsoleScreen(props: {
  activeSection: AdminSection;
  isConnected: boolean;
  onSelectSection: (section: AdminSection) => void;
  children: React.ReactNode;
}) {
  return (
    <main className="home-screen-shell">
      <aside className="home-sidebar">
        <a className="home-sidebar-brand" href="#top">
          <img alt="30ficate logo" className="home-sidebar-brand-logo" src={figmaSidebarLogo} />
          <div>
            <p className="home-sidebar-brand-title">30ficate</p>
            <p className="home-sidebar-brand-subtitle">Certificate trust console</p>
          </div>
        </a>

        <nav className="home-sidebar-nav">
          {sections.map((section) => {
            const SectionIcon = section.icon;
            const locked = !props.isConnected && section.id !== "home";

            return (
              <button
                key={section.id}
                className={`home-sidebar-tab ${section.id === props.activeSection ? "home-sidebar-tab-active" : ""}`}
                onClick={() => {
                  if (!locked) props.onSelectSection(section.id);
                }}
                type="button"
              >
                <SectionIcon size={15} strokeWidth={2.1} />
                <span>{section.label}</span>
                {locked && <Lock size={13} strokeWidth={2.1} />}
              </button>
            );
          })}
        </nav>

        <WalletPanel compact />
      </aside>

      <section className="home-main">
        <header className="home-topbar">
          <button className="home-topbar-search" type="button">
            <Search size={14} strokeWidth={2.2} />
            검색
          </button>
          <span className="home-pill home-pill-warning">
            {props.isConnected ? "OWNER" : "LOCKED"}
          </span>
          <button className="home-topbar-menu" type="button">⋮</button>
        </header>

        {props.children}
      </section>
    </main>
  );
}
