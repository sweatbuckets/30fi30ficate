import {
  BADGE_COLORS,
  BADGE_LABELS,
  ETHEREUM_SEPOLIA_CHAIN_ID,
  POPUP_RECHECK_REQUEST,
  POPUP_STATE_REQUEST,
  STATE_UPDATED_EVENT
} from "../shared/constants";
import type {
  BrowserRequestContext,
  PopupRecheckRequest,
  PopupStateRequest,
  VerificationResult
} from "../shared/types";
import { deriveDomainHash, normalizeDomain } from "./domain";
import { extractLeafCertificateObservation } from "./fingerprint";
import { getCertificateStatus, getRegistryConfigState } from "./registry-client";
import { getSecurityInfo } from "./security-info";
import {
  buildHttpResult,
  buildRpcFailureResult,
  buildTlsObservationFailureResult,
  buildVerificationResult
} from "./verification-state";
import {
  applyCachedVerificationStateToTab,
  clearLatestVerificationState,
  getLatestVerificationState,
  setLatestVerificationState
} from "./state-store";

async function updateBrowserAction(result: VerificationResult): Promise<void> {
  const badgeText =
    result.status === "Approved"
      ? BADGE_LABELS.approved
      : result.status === "Unapproved"
        ? BADGE_LABELS.unapproved
        : result.status === "Revoked"
          ? BADGE_LABELS.revoked
          : result.status === "HTTP"
            ? BADGE_LABELS.http
            : result.status === "TLSObservationFailure"
              ? BADGE_LABELS.tlsObservationFailure
            : result.status === "RPCFailure"
              ? BADGE_LABELS.rpcFailure
              : BADGE_LABELS.unknown;

  const badgeColor =
    result.status === "Approved"
      ? BADGE_COLORS.approved
      : result.status === "Unapproved"
        ? BADGE_COLORS.unapproved
        : result.status === "Revoked"
          ? BADGE_COLORS.revoked
          : result.status === "HTTP"
            ? BADGE_COLORS.http
            : result.status === "TLSObservationFailure"
              ? BADGE_COLORS.tlsObservationFailure
            : result.status === "RPCFailure"
              ? BADGE_COLORS.rpcFailure
              : BADGE_COLORS.unknown;

  await browser.browserAction.setBadgeText({
    tabId: result.tabId,
    text: badgeText
  });
  await browser.browserAction.setBadgeBackgroundColor({
    tabId: result.tabId,
    color: badgeColor
  });
  await browser.browserAction.setTitle({
    tabId: result.tabId,
    title: `30ficate: ${result.message}`
  });
}

async function publishResult(result: VerificationResult): Promise<void> {
  setLatestVerificationState(result);
  await updateBrowserAction(result);
  try {
    await browser.runtime.sendMessage({
      type: STATE_UPDATED_EVENT,
      payload: result
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Could not establish connection")
    ) {
      return;
    }

    throw error;
  }
}

async function applyCachedStateForNavigation(tabId: number, url?: string): Promise<void> {
  if (typeof tabId !== "number" || !url) {
    return;
  }

  const cachedResult = applyCachedVerificationStateToTab(tabId, url);
  if (!cachedResult) {
    console.debug("[30ficate] no cached state for navigation", { tabId, url });
    return;
  }

  console.debug("[30ficate] applied cached state for navigation", {
    tabId,
    url,
    status: cachedResult.status
  });
  await publishResult(cachedResult);
}

function shouldPublishFailureResult(context: BrowserRequestContext): boolean {
  if (context.requestType === "main_frame") {
    return true;
  }

  const latestState = getLatestVerificationState(context.tabId);
  if (!latestState) {
    return true;
  }

  return latestState.status === "Unknown";
}

async function shouldVerifyRequestForTab(
  tabId: number,
  requestUrl: string
): Promise<boolean> {
  if (tabId < 0) {
    return false;
  }

  try {
    const tab = await browser.tabs.get(tabId);
    if (!tab.url?.startsWith("http")) {
      return false;
    }

    const tabUrl = new URL(tab.url);
    const candidateUrl = new URL(requestUrl);

    if (tabUrl.protocol !== "https:" || candidateUrl.protocol !== "https:") {
      return false;
    }

    const tabHostname = normalizeDomain(tabUrl.hostname);
    const candidateHostname = normalizeDomain(candidateUrl.hostname);
    return tabHostname === candidateHostname;
  } catch (error) {
    console.error("[30ficate] shouldVerifyRequestForTab:error", {
      tabId,
      requestUrl,
      error
    });
    return false;
  }
}

async function verifyRequest(context: BrowserRequestContext): Promise<void> {
  console.debug("[30ficate] verifyRequest:start", context);

  if (context.scheme !== "https") {
    await publishResult(buildHttpResult(context));
    return;
  }

  const { rpcConfigured } = getRegistryConfigState();
  const domainHash = deriveDomainHash(
    ETHEREUM_SEPOLIA_CHAIN_ID,
    context.normalizedDomain
  );

  let certificate;

  try {
    const securityInfo = await getSecurityInfo(context);
    console.debug("[30ficate] verifyRequest:securityInfo", {
      tabId: context.tabId,
      url: context.url,
      certificates: securityInfo.certificates?.length ?? 0,
      state: securityInfo.state
    });
    certificate = await extractLeafCertificateObservation(securityInfo);
    console.debug("[30ficate] verifyRequest:certificate", {
      tabId: context.tabId,
      url: context.url,
      certHash: certificate.certHash,
      issuer: certificate.issuer,
      subject: certificate.subject
    });
  } catch (error) {
    console.error("[30ficate] verifyRequest:tlsObservationError", {
      tabId: context.tabId,
      url: context.url,
      error
    });
    if (shouldPublishFailureResult(context)) {
      await publishResult(
        buildTlsObservationFailureResult(context, domainHash, rpcConfigured)
      );
    }
    return;
  }

  let onChainStatus = null;

  try {
    onChainStatus = await getCertificateStatus(domainHash, certificate.certHash);
  } catch (error) {
    console.error("[30ficate] verifyRequest:rpcError", {
      tabId: context.tabId,
      url: context.url,
      certHash: certificate.certHash,
      error
    });
    if (shouldPublishFailureResult(context)) {
      await publishResult(
        buildRpcFailureResult(context, certificate, domainHash, rpcConfigured)
      );
    }
    return;
  }

  if (!onChainStatus) {
    console.debug("[30ficate] verifyRequest:rpcFailure", {
      tabId: context.tabId,
      url: context.url,
      certHash: certificate.certHash
    });
    if (shouldPublishFailureResult(context)) {
      await publishResult(
        buildRpcFailureResult(context, certificate, domainHash, rpcConfigured)
      );
    }
    return;
  }

  console.debug("[30ficate] verifyRequest:onChainStatus", {
    tabId: context.tabId,
    url: context.url,
    certHash: certificate.certHash,
    approved: onChainStatus.approved,
    revoked: onChainStatus.revoked,
    exists: onChainStatus.exists
  });
  await publishResult(
    buildVerificationResult(
      context,
      certificate,
      domainHash,
      onChainStatus,
      rpcConfigured
    )
  );
}

browser.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.tabId < 0) return;

    void (async () => {
      const shouldVerify = await shouldVerifyRequestForTab(details.tabId, details.url);
      console.debug("[30ficate] onHeadersReceived", {
        requestId: details.requestId,
        tabId: details.tabId,
        url: details.url,
        type: details.type,
        shouldVerify
      });

      if (!shouldVerify) {
        return;
      }

      if (details.type === "main_frame") {
        clearLatestVerificationState(details.tabId);
      }

      const url = new URL(details.url);
      const context: BrowserRequestContext = {
        requestId: details.requestId,
        tabId: details.tabId,
        url: details.url,
        hostname: url.hostname,
        normalizedDomain: normalizeDomain(url.hostname),
        scheme: url.protocol === "https:" ? "https" : "http",
        requestType: details.type
      };

      await verifyRequest(context);
    })();
  },
  {
    urls: ["<all_urls>"],
    types: ["main_frame", "sub_frame", "xmlhttprequest", "other"]
  },
  ["blocking"]
);

browser.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0 || details.tabId < 0) {
    return;
  }

  console.debug("[30ficate] onHistoryStateUpdated", details);
  void applyCachedStateForNavigation(details.tabId, details.url);
});

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    clearLatestVerificationState(tabId);
  }

  if (!changeInfo.url) {
    return;
  }

  console.debug("[30ficate] tabs.onUpdated", { tabId, url: changeInfo.url });
  void applyCachedStateForNavigation(tabId, changeInfo.url);
});

browser.runtime.onMessage.addListener(
  async (message: PopupStateRequest | PopupRecheckRequest, sender) => {
    if (message?.type === POPUP_RECHECK_REQUEST) {
      const tabId = message.tabId ?? sender.tab?.id;
      if (typeof tabId !== "number") {
        return false;
      }

      clearLatestVerificationState(tabId);
      await browser.tabs.reload(tabId);
      return true;
    }

    if (message?.type !== POPUP_STATE_REQUEST) {
      return undefined;
    }

    const tabId = message.tabId ?? sender.tab?.id;
    if (typeof tabId !== "number") {
      return null;
    }

    return getLatestVerificationState(tabId, message.url);
  }
);
