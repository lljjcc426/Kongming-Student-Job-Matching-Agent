import { common } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { http } from '@kit.NetworkKit';

interface NativePublicJobRecord {
  id?: string;
  title?: string;
  company?: string;
  city?: string;
  level?: string;
  summary?: string;
  description?: string;
  sourceName?: string;
  sourceUrl?: string;
  applyUrl?: string;
  verification?: string;
  publishedAt?: string;
}

interface NativeJobsPagination {
  total?: number;
}

interface NativeJobsCollection {
  attempted?: number;
  succeeded?: number;
  collected?: number;
}

interface NativeJobsResponse {
  ok?: boolean;
  stale?: boolean;
  jobs?: NativePublicJobRecord[];
  pagination?: NativeJobsPagination;
  collection?: NativeJobsCollection;
  error?: string;
}

export class NativePublicJob {
  id: string;
  title: string;
  company: string;
  city: string;
  level: string;
  summary: string;
  description: string;
  sourceName: string;
  sourceUrl: string;
  applyUrl: string;
  verification: string;
  publishedAt: string;

  constructor(record: NativePublicJobRecord) {
    this.id = record.id || '';
    this.title = record.title || '';
    this.company = record.company || '';
    this.city = record.city || '地点待确认';
    this.level = record.level || '岗位';
    this.summary = record.summary || '请进入企业官方岗位页查看完整说明。';
    this.description = record.description || this.summary;
    this.sourceName = record.sourceName || this.company;
    this.sourceUrl = record.sourceUrl || '';
    this.applyUrl = record.applyUrl || this.sourceUrl;
    this.verification = record.verification || 'source-unverified';
    this.publishedAt = record.publishedAt || '';
  }
}

export class NativeJobFeed {
  configured: boolean;
  jobs: NativePublicJob[];
  total: number;
  stale: boolean;
  message: string;

  constructor(configured: boolean, jobs: NativePublicJob[], total: number, stale: boolean, message: string) {
    this.configured = configured;
    this.jobs = jobs;
    this.total = total;
    this.stale = stale;
    this.message = message;
  }
}

export class NativeJobService {
  private context: common.UIAbilityContext;

  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  private getEndpoint(): string {
    try {
      return this.context.resourceManager.getStringByNameSync('job_service_url').trim();
    } catch (error) {
      console.error(`Native job endpoint read failed: ${String(error)}`);
      return '';
    }
  }

  private buildUrl(endpoint: string, query: string, city: string): string {
    const separator = endpoint.includes('?') ? '&' : '?';
    let url = `${endpoint}${separator}limit=12`;
    if (query.trim()) url += `&q=${encodeURIComponent(query.trim())}`;
    if (city.trim()) url += `&city=${encodeURIComponent(city.trim())}`;
    return url;
  }

  private normalizeJobs(records: NativePublicJobRecord[]): NativePublicJob[] {
    const jobs: NativePublicJob[] = [];
    for (const record of records) {
      const job = new NativePublicJob(record);
      if (!job.id || !job.title || !job.company) continue;
      if (!job.sourceUrl.startsWith('https://') && !job.sourceUrl.startsWith('http://')) continue;
      jobs.push(job);
      if (jobs.length >= 12) break;
    }
    return jobs;
  }

  async fetchJobs(query: string, city: string): Promise<NativeJobFeed> {
    const endpoint = this.getEndpoint();
    if (!endpoint) {
      return new NativeJobFeed(false, [], 0, false, '当前 HAP 未配置岗位服务，请继续使用本机真实岗位录入。');
    }

    const request = http.createHttp();
    try {
      const response = await request.request(this.buildUrl(endpoint, query, city), {
        method: http.RequestMethod.GET,
        expectDataType: http.HttpDataType.STRING,
        header: { Accept: 'application/json' },
        connectTimeout: 10000,
        readTimeout: 35000,
      });
      const responseCode = Number(response.responseCode);
      const responseText = typeof response.result === 'string' ? response.result : JSON.stringify(response.result);
      const payload = JSON.parse(responseText) as NativeJobsResponse;
      if (responseCode < 200 || responseCode >= 300 || payload.ok !== true) {
        return new NativeJobFeed(true, [], 0, false, payload.error || `岗位服务返回状态 ${responseCode}。`);
      }
      const jobs = this.normalizeJobs(payload.jobs || []);
      const total = typeof payload.pagination?.total === 'number' ? payload.pagination.total : jobs.length;
      const attempted = payload.collection?.attempted || 0;
      const succeeded = payload.collection?.succeeded || 0;
      const collected = payload.collection?.collected || 0;
      const sourceMessage = attempted > 0
        ? `${succeeded}/${attempted} 个官方来源可用，本次收集 ${collected} 条。`
        : '已读取岗位缓存。';
      return new NativeJobFeed(true, jobs, total, payload.stale === true,
        jobs.length > 0 ? `${sourceMessage} 当前展示 ${jobs.length} 条。` : '岗位服务可用，但当前筛选没有结果。');
    } catch (error) {
      const businessError = error as BusinessError;
      console.error(`Native job request failed: ${businessError.code} ${businessError.message}`);
      return new NativeJobFeed(true, [], 0, false, '岗位服务暂时不可用，已保留本机岗位录入。');
    } finally {
      request.destroy();
    }
  }
}
