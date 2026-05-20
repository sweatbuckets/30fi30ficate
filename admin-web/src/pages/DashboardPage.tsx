import { useEffect, useState } from "react";
import { Ban, Globe2, House, LayoutDashboard, Lock, ShieldCheck } from "lucide-react";
import { useAccount } from "wagmi";
import { WalletPanel } from "../features/wallet/WalletPanel";
import { DomainRegistrationForm } from "../features/domains/DomainRegistrationForm";
import { CertificateApprovalForm } from "../features/certificates/CertificateApprovalForm";
import { CertificateDashboard } from "../features/certificates/CertificateDashboard";
import { RevocationPanel } from "../features/registry/RevocationPanel";
import thirtyficateLogo from "../../../extension/assets/icons/30ficate_icon.png";

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
    label: "승인 인증서 대시보드",
    eyebrow: "Approved Certificate Dashboard",
    description: "이미 승인되거나 조회 가능한 인증서 상태를 확인합니다.",
    icon: LayoutDashboard
  },
  {
    id: "revocation",
    label: "폐기",
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

  return (
    <main className="page-shell" id="top">
      <section className="hero-wrap">
        <div className="hero-shell">
          <div className="hero-topbar">
            <a className="hero-home-link" href="#top">
              <img alt="30ficate logo" className="hero-home-logo" src={thirtyficateLogo} />
              <span className="hero-home-wordmark">30ficate</span>
            </a>
          </div>

          <div className="hero-main">
            <div className="hero-copy hero-copy-inline">
              <p className="hero-kicker">Ethereum Sepolia Certificate Governance</p>
              <h1 className="m-0 text-3xl font-semibold leading-tight">
                On-chain Certificate Registry Console
              </h1>
              <p className="hero-description">
                도메인 등록, 인증서 승인, 폐기, 승인 상태 조회를 한 흐름으로 관리하는 관리자 콘솔입니다.
              </p>
            </div>

            <WalletPanel compact />
          </div>
        </div>
      </section>

      <div className="content-shell">
        <section className="floating-nav floating-nav-hero p-4 md:p-5">
          <div className="menu-bar menu-bar-grid">
            {sections.map((section) => {
              const SectionIcon = section.icon;
              const locked = !isConnected && section.id !== "home";
              return (
                <button
                  key={section.id}
                  className={`menu-tab ${section.id === activeSection ? "menu-tab-active" : ""} ${locked ? "menu-tab-locked" : ""}`}
                  onClick={() => {
                    if (!locked) setActiveSection(section.id);
                  }}
                  type="button"
                >
                  <SectionIcon size={16} strokeWidth={2.2} />
                  {section.label}
                  {locked && <Lock size={14} strokeWidth={2.2} />}
                </button>
              );
            })}
          </div>
        </section>

        <div className="floating-panel-stack">
          {activeSection === "home" && <HomePanel />}
          {activeSection === "domain-registration" && <DomainRegistrationForm />}
          {activeSection === "certificate-approval" && <CertificateApprovalForm />}
          {activeSection === "certificate-dashboard" && <CertificateDashboard />}
          {activeSection === "revocation" && <RevocationPanel />}
        </div>
      </div>
    </main>
  );
}

function HomePanel() {
  return (
    <section className="home-grid">
      <section className="glass p-6">
        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Overview
          </p>
          <div className="module-title-row">
            <span className="module-icon-badge">
              <House size={18} strokeWidth={2.2} />
            </span>
            <h2 className="m-0 text-xl font-semibold">프로젝트 소개</h2>
          </div>
        </div>

        <div className="home-copy-grid">
          <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-5">
            <p className="mb-2 text-sm font-semibold text-slate-900">What 30ficate Does</p>
            <p className="m-0 text-sm leading-7 text-slate-600">
              30ficate는 기존 TLS 검증을 대체하지 않고, 브라우저가 받은 leaf certificate가
              도메인 owner에게 온체인 승인되었는지를 추가로 확인하는 보안 레이어입니다.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-5">
            <p className="mb-2 text-sm font-semibold text-slate-900">Current Limits</p>
            <p className="m-0 text-sm leading-7 text-slate-600">
              Firefox-only MVP, TLS 연결 전 차단 불가, DNS ownership verification 미구현, 외부
              RPC/CT 소스 의존성이 현재 한계입니다.
            </p>
          </div>
        </div>
      </section>

      <section className="glass p-6">
        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Future Work
          </p>
          <div className="module-title-row">
            <span className="module-icon-badge">
              <LayoutDashboard size={18} strokeWidth={2.2} />
            </span>
            <h2 className="m-0 text-xl font-semibold">향후 발전 방향</h2>
          </div>
        </div>

        <div className="future-grid">
          <div className="future-card">
            <strong>DNS TXT ownership verification</strong>
            <span>도메인 제어권을 TXT challenge 기반으로 검증</span>
          </div>
          <div className="future-card">
            <strong>CertStream monitoring</strong>
            <span>실시간 인증서 발급 감시와 알림 자동화</span>
          </div>
          <div className="future-card">
            <strong>Chromium support</strong>
            <span>Firefox MVP 이후 브라우저 지원 확대</span>
          </div>
          <div className="future-card">
            <strong>Pre-connection verification</strong>
            <span>local proxy 기반 선제 차단 레이어 실험</span>
          </div>
          <div className="future-card">
            <strong>Multi-owner approval</strong>
            <span>여러 승인 주체와 운영 정책 확장</span>
          </div>
          <div className="future-card">
            <strong>Monitoring integrations</strong>
            <span>Slack, Discord, SIEM, dashboard 연계</span>
          </div>
        </div>
      </section>
    </section>
  );
}
