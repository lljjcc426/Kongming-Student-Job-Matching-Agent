import { url } from '@kit.ArkTS';
import { BusinessError } from '@kit.BasicServicesKit';
import { http } from '@kit.NetworkKit';

export class NativeEvidenceSourceResult {
  ok: boolean;
  sourceUrl: string;
  sourceHost: string;
  checkedAt: string;
  responseCode: number;
  message: string;

  constructor(
    ok: boolean,
    sourceUrl: string,
    sourceHost: string,
    checkedAt: string,
    responseCode: number,
    message: string,
  ) {
    this.ok = ok;
    this.sourceUrl = sourceUrl;
    this.sourceHost = sourceHost;
    this.checkedAt = checkedAt;
    this.responseCode = responseCode;
    this.message = message;
  }
}

export class NativeEvidenceService {
  private isPublicHostname(hostname: string): boolean {
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (!host || !host.includes('.')) return false;
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.lan')) return false;
    if (/^(0|10|127)\./.test(host)) return false;
    if (/^169\.254\./.test(host) || /^192\.168\./.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)) return false;
    if (host === '::1' || /^(fc|fd|fe8|fe9|fea|feb)/.test(host)) return false;
    return true;
  }

  async verifyPublicHttps(sourceValue: string): Promise<NativeEvidenceSourceResult> {
    const checkedAt = new Date().toLocaleString('zh-CN');
    let parsed: url.URL;
    try {
      parsed = url.URL.parseURL(sourceValue.trim());
    } catch (error) {
      console.error(`Evidence URL parse failed: ${String(error)}`);
      return new NativeEvidenceSourceResult(false, sourceValue, '', checkedAt, 0, '证据来源不是有效的 HTTPS 地址。');
    }

    const sourceHost = parsed.hostname.toLowerCase();
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || (parsed.port && parsed.port !== '443') ||
      !this.isPublicHostname(sourceHost)) {
      return new NativeEvidenceSourceResult(
        false,
        sourceValue,
        sourceHost,
        checkedAt,
        0,
        '仅允许不含账号信息的公开 HTTPS 地址，不能使用本机、内网或自定义端口。',
      );
    }

    const sourceUrl = parsed.toString();
    const request = http.createHttp();
    try {
      const response = await request.request(sourceUrl, {
        method: http.RequestMethod.HEAD,
        expectDataType: http.HttpDataType.STRING,
        header: {
          Accept: '*/*',
          'User-Agent': 'KongMing-HarmonyOS-Evidence-Check/1.0',
        },
        usingCache: false,
        connectTimeout: 10000,
        readTimeout: 15000,
        maxRedirects: 4,
      });
      const responseCode = Number(response.responseCode);
      if (responseCode >= 200 && responseCode < 400) {
        return new NativeEvidenceSourceResult(
          true,
          sourceUrl,
          sourceHost,
          checkedAt,
          responseCode,
          `来源可访问，HTTP ${responseCode}。`,
        );
      }
      return new NativeEvidenceSourceResult(
        false,
        sourceUrl,
        sourceHost,
        checkedAt,
        responseCode,
        `证据来源返回 HTTP ${responseCode}，未更新实证覆盖。`,
      );
    } catch (error) {
      const businessError = error as BusinessError;
      console.error(`Evidence source request failed: ${businessError.code} ${businessError.message}`);
      return new NativeEvidenceSourceResult(
        false,
        sourceUrl,
        sourceHost,
        checkedAt,
        0,
        '当前无法访问证据来源，未更新实证覆盖。',
      );
    } finally {
      request.destroy();
    }
  }
}
