import { url } from '@kit.ArkTS';
import { BusinessError } from '@kit.BasicServicesKit';
import { connection, http } from '@kit.NetworkKit';

export class NativeEvidenceSourceResult {
  ok: boolean;
  sourceUrl: string;
  sourceHost: string;
  checkedAt: string;
  responseCode: number;
  checkMethod: string;
  message: string;

  constructor(
    ok: boolean,
    sourceUrl: string,
    sourceHost: string,
    checkedAt: string,
    responseCode: number,
    checkMethod: string,
    message: string,
  ) {
    this.ok = ok;
    this.sourceUrl = sourceUrl;
    this.sourceHost = sourceHost;
    this.checkedAt = checkedAt;
    this.responseCode = responseCode;
    this.checkMethod = checkMethod;
    this.message = message;
  }
}

export class NativeEvidenceService {
  private isPublicHostname(hostname: string): boolean {
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (!host || (!host.includes('.') && !host.includes(':'))) return false;
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.lan')) return false;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) {
      return this.isPublicNetworkAddress(host);
    }
    return true;
  }

  private isPublicNetworkAddress(addressValue: string): boolean {
    const address = addressValue.toLowerCase().replace(/^\[|\]$/g, '');
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(address)) {
      const segments = address.split('.');
      const octets: number[] = [];
      for (const segment of segments) {
        const value = Number(segment);
        if (!Number.isInteger(value) || value < 0 || value > 255) return false;
        octets.push(value);
      }
      const first = octets[0];
      const second = octets[1];
      if (first === 0 || first === 10 || first === 127 || first >= 224) return false;
      if (first === 100 && second >= 64 && second <= 127) return false;
      if (first === 169 && second === 254) return false;
      if (first === 172 && second >= 16 && second <= 31) return false;
      if (first === 192 && (second === 0 || second === 168)) return false;
      if (first === 198 && (second === 18 || second === 19 || second === 51)) return false;
      if (first === 203 && second === 0) return false;
      return true;
    }
    if (!address.includes(':')) return false;
    if (address === '::' || address === '::1' || address.startsWith('::ffff:')) return false;
    if (/^(fc|fd|fe8|fe9|fea|feb|fec|fed|fee|fef|ff)/.test(address)) return false;
    if (address.startsWith('2001:db8:') || address.startsWith('64:ff9b:')) return false;
    return true;
  }

  private async resolvesToPublicAddresses(hostname: string): Promise<boolean> {
    try {
      const addresses = await connection.getAddressesByName(hostname);
      if (addresses.length === 0) return false;
      for (const address of addresses) {
        if (!this.isPublicNetworkAddress(address.address)) return false;
      }
      return true;
    } catch (error) {
      const businessError = error as BusinessError;
      console.error(`Evidence DNS check failed: ${businessError.code} ${businessError.message}`);
      return false;
    }
  }

  private isReachableStatus(responseCode: number): boolean {
    return responseCode >= 200 && responseCode < 400;
  }

  private shouldFallbackToGet(responseCode: number): boolean {
    return responseCode === 400 || responseCode === 403 || responseCode === 405 ||
      responseCode === 406 || responseCode === 501;
  }

  private async requestHead(sourceUrl: string): Promise<number> {
    const request = http.createHttp();
    try {
      const response = await request.request(sourceUrl, {
        method: http.RequestMethod.HEAD,
        expectDataType: http.HttpDataType.STRING,
        header: {
          Accept: '*/*',
          'User-Agent': 'KongMing-HarmonyOS-Evidence-Check/1.1',
        },
        usingCache: false,
        connectTimeout: 10000,
        readTimeout: 15000,
        maxRedirects: 0,
      });
      return Number(response.responseCode);
    } finally {
      request.destroy();
    }
  }

  private async requestRangeGet(sourceUrl: string): Promise<number> {
    const request = http.createHttp();
    try {
      return await request.requestInStream(sourceUrl, {
        method: http.RequestMethod.GET,
        header: {
          Accept: '*/*',
          Range: 'bytes=0-0',
          'Accept-Encoding': 'identity',
          'User-Agent': 'KongMing-HarmonyOS-Evidence-Check/1.1',
        },
        usingCache: false,
        connectTimeout: 10000,
        readTimeout: 15000,
        maxRedirects: 0,
      });
    } finally {
      request.destroy();
    }
  }

  async verifyPublicHttps(sourceValue: string): Promise<NativeEvidenceSourceResult> {
    const checkedAt = new Date().toLocaleString('zh-CN');
    let parsed: url.URL;
    try {
      parsed = url.URL.parseURL(sourceValue.trim());
    } catch (error) {
      console.error(`Evidence URL parse failed: ${String(error)}`);
      return new NativeEvidenceSourceResult(false, sourceValue, '', checkedAt, 0, '', '证据来源不是有效的 HTTPS 地址。');
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
        '',
        '仅允许不含账号信息的公开 HTTPS 地址，不能使用本机、内网或自定义端口。',
      );
    }

    const sourceUrl = parsed.toString();
    if (!await this.resolvesToPublicAddresses(sourceHost)) {
      return new NativeEvidenceSourceResult(
        false,
        sourceUrl,
        sourceHost,
        checkedAt,
        0,
        'DNS',
        '证据来源未解析到公开网络地址，或域名解析暂时不可用。',
      );
    }
    let headResponseCode = 0;
    try {
      headResponseCode = await this.requestHead(sourceUrl);
      if (this.isReachableStatus(headResponseCode)) {
        return new NativeEvidenceSourceResult(
          true,
          sourceUrl,
          sourceHost,
          checkedAt,
          headResponseCode,
          'HEAD',
          `来源可访问，HEAD 返回 HTTP ${headResponseCode}。`,
        );
      }
      if (!this.shouldFallbackToGet(headResponseCode)) {
        return new NativeEvidenceSourceResult(
          false,
          sourceUrl,
          sourceHost,
          checkedAt,
          headResponseCode,
          'HEAD',
          `证据来源 HEAD 返回 HTTP ${headResponseCode}，未更新实证覆盖。`,
        );
      }
    } catch (error) {
      const businessError = error as BusinessError;
      if (businessError.code === 2300047) {
        return new NativeEvidenceSourceResult(
          false,
          sourceUrl,
          sourceHost,
          checkedAt,
          0,
          'HEAD',
          '证据来源发生重定向，请提交跳转后的最终公开 HTTPS 地址。',
        );
      }
      console.warn(`Evidence source HEAD failed, trying range GET: ${businessError.code} ${businessError.message}`);
    }

    try {
      const responseCode = await this.requestRangeGet(sourceUrl);
      if (this.isReachableStatus(responseCode)) {
        return new NativeEvidenceSourceResult(
          true,
          sourceUrl,
          sourceHost,
          checkedAt,
          responseCode,
          'GET_RANGE',
          `HEAD 受限，已通过流式小范围 GET 核验，HTTP ${responseCode}。`,
        );
      }
      return new NativeEvidenceSourceResult(
        false,
        sourceUrl,
        sourceHost,
        checkedAt,
        responseCode,
        'GET_RANGE',
        `证据来源 GET 返回 HTTP ${responseCode}，未更新实证覆盖。`,
      );
    } catch (error) {
      const businessError = error as BusinessError;
      console.error(`Evidence source range GET failed: ${businessError.code} ${businessError.message}`);
      if (businessError.code === 2300047) {
        return new NativeEvidenceSourceResult(
          false,
          sourceUrl,
          sourceHost,
          checkedAt,
          0,
          'GET_RANGE',
          '证据来源发生重定向，请提交跳转后的最终公开 HTTPS 地址。',
        );
      }
      const headDetail = headResponseCode > 0 ? `HEAD HTTP ${headResponseCode}，` : '';
      return new NativeEvidenceSourceResult(
        false,
        sourceUrl,
        sourceHost,
        checkedAt,
        0,
        'GET_RANGE',
        `${headDetail}当前无法通过受限 GET 访问证据来源，未更新实证覆盖。`,
      );
    }
  }
}
