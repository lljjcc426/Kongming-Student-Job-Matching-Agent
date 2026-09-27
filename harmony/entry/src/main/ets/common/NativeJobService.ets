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
  employmentType?: string;
  education?: string;
  salary?: string;
  keywords?: string[];
  confidence?: number;
  market?: string;
  employerPriority?: number;
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
  employmentType: string;
  education: string;
  salary: string;
  keywords: string[];
  confidence: number;
  market: string;
  employerPriority: number;
  matchScore: number;
  matchLabel: string;
  matchMode: string;
  matchedSkills: string[];
  missingSkills: string[];
  matchReasons: string[];
  matchGaps: string[];
  preferenceReasons: string[];
  preferenceConflicts: string[];
  feedbackState: string;
  freshnessLabel: string;

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
    this.employmentType = record.employmentType || '';
    this.education = record.education || '';
    this.salary = record.salary || '';
    this.keywords = Array.isArray(record.keywords) ? record.keywords.slice(0, 12) : [];
    this.confidence = typeof record.confidence === 'number' ? Math.max(0, Math.min(1, record.confidence)) : 0.5;
    this.market = record.market || 'unknown';
    this.employerPriority = typeof record.employerPriority === 'number'
      ? Math.max(0, Math.min(100, record.employerPriority))
      : 0;
    this.matchScore = 0;
    this.matchLabel = '待分析';
    this.matchMode = 'target-only';
    this.matchedSkills = [];
    this.missingSkills = [];
    this.matchReasons = [];
    this.matchGaps = [];
    this.preferenceReasons = [];
    this.preferenceConflicts = [];
    this.feedbackState = '';
    this.freshnessLabel = '发布时间待确认';
  }
}

export class NativeJobFeed {
  configured: boolean;
  failed: boolean;
  jobs: NativePublicJob[];
  total: number;
  stale: boolean;
  message: string;

  constructor(configured: boolean, failed: boolean, jobs: NativePublicJob[], total: number, stale: boolean,
    message: string) {
    this.configured = configured;
    this.failed = failed;
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
      return this.context.resourceManager.getStringByNameSync('gateway_service_url').trim();
    } catch (error) {
      console.error(`Native gateway endpoint read failed: ${String(error)}`);
      return '';
    }
  }

  private buildUrl(endpoint: string, query: string, city: string, company: string): string {
    const separator = endpoint.includes('?') ? '&' : '?';
    let url = `${endpoint}${separator}operation=jobs&limit=20&market=cn`;
    if (query.trim()) url += `&q=${encodeURIComponent(query.trim())}`;
    if (city.trim()) url += `&city=${encodeURIComponent(city.trim())}`;
    if (company.trim()) url += `&company=${encodeURIComponent(company.trim())}`;
    return url;
  }

  private isDomesticJob(job: NativePublicJob): boolean {
    if (job.market.toLowerCase() === 'global') return false;
    const location = job.city.toLowerCase();
    const overseas = /日本|東京|东京|大阪|京都|横滨|横浜|japan|tokyo|osaka|美国|美國|纽约|紐約|西雅图|洛杉矶|旧金山|波士顿|united states|new york|seattle|los angeles|san francisco|boston|英国|英國|伦敦|倫敦|united kingdom|london|新加坡|singapore|加拿大|canada|多伦多|toronto|温哥华|vancouver|澳大利亚|澳洲|australia|悉尼|sydney|墨尔本|melbourne|印度|india|班加罗尔|bengaluru|德国|germany|柏林|berlin|法国|france|巴黎|paris|荷兰|netherlands|韩国|韓國|首尔|首爾|south korea|seoul|阿联酋|阿聯酋|迪拜|杜拜|united arab emirates|dubai|\buae\b|泰国|泰國|曼谷|thailand|bangkok|马来西亚|馬來西亞|吉隆坡|malaysia|kuala lumpur|印度尼西亚|印度尼西亞|印尼|雅加达|雅加達|indonesia|jakarta|越南|河内|河內|胡志明市|vietnam|hanoi|ho chi minh|菲律宾|菲律賓|马尼拉|馬尼拉|philippines|manila|爱尔兰|愛爾蘭|都柏林|ireland|dublin|瑞士|苏黎世|蘇黎世|switzerland|zurich|西班牙|马德里|馬德里|巴塞罗那|巴塞羅那|spain|madrid|barcelona|意大利|義大利|米兰|米蘭|罗马|羅馬|italy|milan|rome|波兰|波蘭|华沙|華沙|poland|warsaw|以色列|特拉维夫|特拉維夫|israel|tel aviv|沙特|沙特阿拉伯|利雅得|saudi arabia|riyadh|卡塔尔|卡塔爾|多哈|qatar|doha|新西兰|新西蘭|奥克兰|奧克蘭|new zealand|auckland|巴西|圣保罗|聖保羅|brazil|sao paulo|墨西哥|墨西哥城|mexico|mexico city|南非|约翰内斯堡|約翰內斯堡|south africa|johannesburg|俄罗斯|俄羅斯|莫斯科|russia|moscow/i;
    if (overseas.test(location)) return false;
    const domestic = /中国|china|全国|国内|内地|大陆|北京|上海|天津|重庆|河北|山西|辽宁|吉林|黑龙江|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|海南|四川|贵州|云南|陕西|甘肃|青海|台湾|内蒙古|广西|西藏|宁夏|新疆|香港|澳门|深圳|广州|杭州|成都|武汉|南京|西安|苏州|长沙|厦门|珠海|合肥|青岛|济南|郑州|东莞|佛山|无锡|宁波|沈阳|大连|长春|哈尔滨|福州|泉州|南昌|烟台|潍坊|洛阳|宜昌|襄阳|南宁|海口|三亚|贵阳|昆明|拉萨|兰州|西宁|银川|乌鲁木齐|石家庄|太原|呼和浩特|包头|温州|嘉兴|绍兴|金华|常州|南通|徐州|扬州|镇江|泰州|惠州|中山|江门|湛江|绵阳|hong kong|macau|beijing|shanghai|shenzhen|guangzhou|hangzhou|chengdu|wuhan|nanjing|xian|xi'an|suzhou|changsha|chongqing|tianjin|xiamen|zhuhai|hefei|qingdao|jinan|zhengzhou|dongguan|foshan|wuxi|ningbo/i;
    if (domestic.test(location)) return true;
    if (!/^(?:地点见原岗位页|地点待确认|地点不限|未注明|待确认|暂无)?$/i.test(location.trim())) return false;
    return job.market.toLowerCase() === 'cn' ||
      /腾讯|字节跳动|阿里巴巴|蚂蚁集团|百度|美团|京东|小米|网易|快手|华为|滴滴|哔哩哔哩|小红书|携程|搜狐|新浪|微博|联想|大疆|oppo|vivo|完美世界|高途|微步在线/i.test(job.company);
  }

  private normalizeJobs(records: NativePublicJobRecord[]): NativePublicJob[] {
    const jobs: NativePublicJob[] = [];
    const seenKeys: string[] = [];
    for (const record of records) {
      const job = new NativePublicJob(record);
      if (!job.id || !job.title || !job.company) continue;
      if (!this.isDomesticJob(job)) continue;
      if (!job.sourceUrl.startsWith('https://') && !job.sourceUrl.startsWith('http://')) continue;
      const duplicateKey = `${job.company}|${job.title}|${job.city}`.toLowerCase().replace(/\s+/g, '');
      if (seenKeys.includes(duplicateKey)) continue;
      seenKeys.push(duplicateKey);
      jobs.push(job);
      if (jobs.length >= 12) break;
    }
    return jobs;
  }

  async fetchJobs(query: string, city: string, company: string = ''): Promise<NativeJobFeed> {
    const endpoint = this.getEndpoint();
    if (!endpoint) {
      return new NativeJobFeed(false, true, [], 0, false, '在线岗位搜索暂时不可用，你仍可手动添加目标岗位。');
    }

    const request = http.createHttp();
    try {
      const response = await request.request(this.buildUrl(endpoint, query, city, company), {
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
        console.error(`Native job response failed with status ${responseCode}: ${payload.error || 'unknown error'}`);
        return new NativeJobFeed(true, true, [], 0, false, '暂时无法搜索岗位，请稍后重试。');
      }
      const jobs = this.normalizeJobs(payload.jobs || []);
      const total = typeof payload.pagination?.total === 'number' ? payload.pagination.total : jobs.length;
      const collected = payload.collection?.collected || 0;
      const emptyMessage = collected > 0
        ? '当前筛选条件没有匹配岗位，请减少关键词、企业或城市限制后重试。'
        : '暂时没有找到可投递岗位，请稍后重试或手动添加目标岗位。';
      return new NativeJobFeed(true, false, jobs, total, payload.stale === true,
        jobs.length > 0 ? `已找到 ${total} 个相关岗位，当前展示 ${jobs.length} 个。` : emptyMessage);
    } catch (error) {
      const businessError = error as BusinessError;
      console.error(`Native job request failed: ${businessError.code} ${businessError.message}`);
      return new NativeJobFeed(true, true, [], 0, false, '暂时无法搜索岗位，请检查网络后重试。');
    } finally {
      request.destroy();
    }
  }
}
