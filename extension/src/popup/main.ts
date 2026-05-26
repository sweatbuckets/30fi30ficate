import {
  POPUP_RECHECK_REQUEST,
  POPUP_STATE_REQUEST,
  STATE_UPDATED_EVENT
} from "../shared/constants";
import type {
  CertificateChainEntry,
  PopupRecheckRequest,
  PopupStateRequest,
  PopupStateUpdate,
  VerificationResult
} from "../shared/types";

const statusCard = document.getElementById("status-card") as HTMLElement;
const statusLabel = document.getElementById("status-label") as HTMLElement;
const statusMessage = document.getElementById("status-message") as HTMLElement;
const popupTabChip = document.querySelector(".popup-tab-chip") as HTMLElement;
const domainValue = document.getElementById("domain-value") as HTMLElement;
const domainHashValue = document.getElementById("domain-hash-value") as HTMLElement;
const certHashValue = document.getElementById("cert-hash-value") as HTMLElement;
const checkedAtValue = document.getElementById("checked-at-value") as HTMLElement;
const chainList = document.getElementById("chain-list") as HTMLElement;
const warningBanner = document.getElementById("warning-banner") as HTMLElement;
const recheckButton = document.getElementById("recheck-button") as HTMLButtonElement;

function statusClassName(status: VerificationResult["status"]): string {
  return `status-card status-${status.toLowerCase()}`;
}

function shouldShowRecheckButton(result: VerificationResult | null): boolean {
  return (
    !result ||
    result.status === "Unknown" ||
    result.status === "TLSObservationFailure" ||
    result.status === "RPCFailure"
  );
}

function tlsChipLabel(result: VerificationResult | null): string {
  if (!result) {
    return "TLS uncaptured";
  }

  return result.evidence.tlsObserved ? "TLS captured" : "TLS uncaptured";
}

function renderWarning(result: VerificationResult | null): void {
  if (result?.status === "TLSObservationFailure") {
    warningBanner.hidden = false;
    warningBanner.textContent =
      "인증서 정보를 다시 읽지 못했습니다. 인증서 다시 읽기를 실행하면 현재 탭을 새로고침하여 certificate security info를 다시 시도합니다. 다음 시도에서 인증서를 읽을 수 있어야 상태가 갱신됩니다.";
    return;
  }

  if (result?.status === "RPCFailure") {
    warningBanner.hidden = false;
    warningBanner.textContent =
      "인증서는 읽었지만 온체인 조회에 실패했습니다. 인증서 다시 읽기는 새 요청을 만들어 재시도하지만, 결과가 바로 Unapproved나 Approved로 바뀌는 것은 RPC 상태에 달려 있습니다.";
    return;
  }

  warningBanner.hidden = true;
  warningBanner.textContent = "";
}

function chainRoleLabel(role: CertificateChainEntry["role"]): string {
  if (role === "leaf") {
    return "Leaf";
  }

  if (role === "intermediate") {
    return "Intermediate CA";
  }

  return "Root CA";
}

function issuedByLabel(nextEntry?: CertificateChainEntry): string {
  if (!nextEntry) {
    return "Trust anchor";
  }

  return `Issued by ${chainRoleLabel(nextEntry.role)}`;
}

function formatDate(value?: number): string {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("ko-KR");
}

function parseDistinguishedName(value: string): Array<{ key: string; value: string }> {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex < 0) {
        return { key: "DN", value: part };
      }

      return {
        key: part.slice(0, separatorIndex).trim(),
        value: part.slice(separatorIndex + 1).trim()
      };
    });
}

function renderDistinguishedNameChips(
  container: HTMLElement,
  distinguishedName: string
): void {
  const attributes = parseDistinguishedName(distinguishedName);

  if (!attributes.length) {
    const empty = document.createElement("span");
    empty.className = "dn-chip";
    empty.textContent = distinguishedName || "-";
    container.append(empty);
    return;
  }

  for (const attribute of attributes) {
    const chip = document.createElement("span");
    chip.className = "dn-chip";

    const key = document.createElement("span");
    key.className = "dn-chip-key";
    key.textContent = attribute.key;

    const value = document.createElement("span");
    value.className = "dn-chip-value";
    value.textContent = attribute.value;

    chip.append(key, value);
    container.append(chip);
  }
}

function renderChain(
  chain: CertificateChainEntry[] | undefined,
  validFrom?: number,
  validTo?: number
): void {
  chainList.replaceChildren();

  if (!chain?.length) {
    const empty = document.createElement("p");
    empty.className = "chain-empty";
    empty.textContent = "-";
    chainList.append(empty);
    return;
  }

  for (const [index, entry] of chain.entries()) {
    const item = document.createElement("div");
    item.className = "chain-item";

    const card = document.createElement("div");
    card.className = "chain-card";

    const role = document.createElement("p");
    role.className = "chain-role";
    role.textContent = chainRoleLabel(entry.role);

    const subject = document.createElement("div");
    subject.className = "chain-subject";
    renderDistinguishedNameChips(subject, entry.subject);

    const issuer = document.createElement("p");
    issuer.className = "chain-issuer";
    issuer.textContent = issuedByLabel(chain[index + 1]);

    card.append(role, subject);

    if (entry.role === "leaf") {
      const validity = document.createElement("div");
      validity.className = "chain-validity";

      const issuedMeta = document.createElement("div");
      issuedMeta.className = "chain-validity-item";
      const issuedLabel = document.createElement("span");
      issuedLabel.className = "chain-validity-label";
      issuedLabel.textContent = "발급 날짜";
      const issuedValue = document.createElement("span");
      issuedValue.className = "chain-validity-value";
      issuedValue.textContent = formatDate(validFrom);
      issuedMeta.append(issuedLabel, issuedValue);

      const expiresMeta = document.createElement("div");
      expiresMeta.className = "chain-validity-item";
      const expiresLabel = document.createElement("span");
      expiresLabel.className = "chain-validity-label";
      expiresLabel.textContent = "만료 날짜";
      const expiresValue = document.createElement("span");
      expiresValue.className = "chain-validity-value";
      expiresValue.textContent = formatDate(validTo);
      expiresMeta.append(expiresLabel, expiresValue);

      validity.append(issuedMeta, expiresMeta);
      card.append(validity);
    }

    card.append(issuer);
    item.append(card);
    chainList.append(item);
  }
}

function renderState(result: VerificationResult | null): void {
  if (!result) {
    statusCard.className = "status-card status-unknown";
    popupTabChip.textContent = tlsChipLabel(null);
    statusLabel.textContent = "Unknown";
    statusMessage.textContent =
      "아직 이 탭의 검증 결과가 없습니다. 인증서 다시 읽기를 실행해 주세요.";
    domainValue.textContent = "-";
    domainHashValue.textContent = "-";
    certHashValue.textContent = "-";
    checkedAtValue.textContent = "-";
    renderChain(undefined);
    renderWarning(null);
    recheckButton.hidden = !shouldShowRecheckButton(null);
    return;
  }

  statusCard.className = statusClassName(result.status);
  popupTabChip.textContent = tlsChipLabel(result);
  statusLabel.textContent = result.status;
  statusMessage.textContent = result.message;
  domainValue.textContent =
    result.matchedDomain ?? result.normalizedDomain ?? result.hostname;
  domainHashValue.textContent = result.domainHash ?? "-";
  certHashValue.textContent = result.certHash ?? "-";
  checkedAtValue.textContent = new Date(result.checkedAt).toLocaleString();
  renderChain(result.certificateChain, result.validFrom, result.validTo);
  renderWarning(result);
  recheckButton.hidden = !shouldShowRecheckButton(result);
}

async function loadCurrentTabState(): Promise<void> {
  const [activeTab] = await browser.tabs.query({
    active: true,
    currentWindow: true
  });

  const stateRequest: PopupStateRequest = {
    type: POPUP_STATE_REQUEST,
    tabId: activeTab?.id,
    url: activeTab?.url
  };
  const result = await browser.runtime.sendMessage(stateRequest);

  renderState(result as VerificationResult | null);
}

async function recheckCurrentTab(): Promise<void> {
  const [activeTab] = await browser.tabs.query({
    active: true,
    currentWindow: true
  });

  if (typeof activeTab?.id !== "number") {
    return;
  }

  statusMessage.textContent =
    "현재 탭을 새로고침하여 HTTPS 인증서 정보를 다시 읽습니다.";
  recheckButton.disabled = true;

  const recheckRequest: PopupRecheckRequest = {
    type: POPUP_RECHECK_REQUEST,
    tabId: activeTab.id
  };
  await browser.runtime.sendMessage(recheckRequest);
}

browser.runtime.onMessage.addListener((message: PopupStateUpdate) => {
  if (message?.type !== STATE_UPDATED_EVENT) {
    return;
  }

  recheckButton.disabled = false;
  renderState(message.payload);
});

recheckButton.addEventListener("click", () => {
  void recheckCurrentTab();
});

void loadCurrentTabState();
