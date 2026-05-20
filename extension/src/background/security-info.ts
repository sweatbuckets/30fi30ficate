import type {
  RawFirefoxSecurityInfo,
  BrowserRequestContext
} from "../shared/types";

interface FirefoxBrowserWithSecurityInfo {
  webRequest: {
    getSecurityInfo(
      requestId: string,
      options: { certificateChain: boolean; rawDER: boolean }
    ): Promise<RawFirefoxSecurityInfo>;
  };
}

const firefoxBrowser = browser as typeof browser & FirefoxBrowserWithSecurityInfo;

export async function getSecurityInfo(
  context: BrowserRequestContext
): Promise<RawFirefoxSecurityInfo> {
  return firefoxBrowser.webRequest.getSecurityInfo(context.requestId, {
    certificateChain: true,
    rawDER: true
  });
}
