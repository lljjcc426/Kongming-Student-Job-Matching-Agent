const STRUCTURED_JOB_SOURCES = [
  {
    id: "tencent-social",
    company: "腾讯",
    adapter: "tencent",
    sourceType: "official-api",
    domains: ["careers.tencent.com"],
  },
  {
    id: "moka-cyou-campus",
    company: "搜狐畅游",
    adapter: "moka",
    sourceType: "official-ats",
    orgId: "cyou-inc",
    mode: "campus",
    careersUrl: "https://app.mokahr.com/campus-recruitment/cyou-inc/42233",
    domains: ["app.mokahr.com"],
  },
  {
    id: "moka-sina-campus",
    company: "新浪与微博",
    adapter: "moka",
    sourceType: "official-ats",
    orgId: "sina",
    mode: "campus",
    careersUrl: "https://app.mokahr.com/campus-recruitment/sina/43536",
    domains: ["app.mokahr.com"],
  },
  {
    id: "moka-pwrd-campus",
    company: "完美世界",
    adapter: "moka",
    sourceType: "official-ats",
    orgId: "pwrd",
    mode: "campus",
    careersUrl: "https://app.mokahr.com/campus-recruitment/pwrd/144582",
    domains: ["app.mokahr.com"],
  },
  {
    id: "moka-threatbook-campus",
    company: "微步在线",
    adapter: "moka",
    sourceType: "official-ats",
    orgId: "threatbook",
    mode: "campus",
    careersUrl: "https://app.mokahr.com/campus-recruitment/threatbook/39679",
    domains: ["app.mokahr.com"],
  },
  {
    id: "moka-gaotu-campus",
    company: "高途",
    adapter: "moka",
    sourceType: "official-ats",
    orgId: "bjhl",
    mode: "campus",
    careersUrl: "https://app.mokahr.com/campus-recruitment/bjhl/102145",
    domains: ["app.mokahr.com"],
  },
  {
    id: "greenhouse-cloudflare",
    company: "Cloudflare",
    adapter: "greenhouse",
    sourceType: "official-ats",
    boardToken: "cloudflare",
    domains: ["boards.greenhouse.io", "job-boards.greenhouse.io"],
  },
  {
    id: "greenhouse-figma",
    company: "Figma",
    adapter: "greenhouse",
    sourceType: "official-ats",
    boardToken: "figma",
    domains: ["boards.greenhouse.io", "job-boards.greenhouse.io"],
  },
  {
    id: "lever-palantir",
    company: "Palantir",
    adapter: "lever",
    sourceType: "official-ats",
    site: "palantir",
    domains: ["jobs.lever.co"],
  },
  {
    id: "ashby-linear",
    company: "Linear",
    adapter: "ashby",
    sourceType: "official-ats",
    boardName: "linear",
    domains: ["jobs.ashbyhq.com"],
  },
  {
    id: "ashby-replit",
    company: "Replit",
    adapter: "ashby",
    sourceType: "official-ats",
    boardName: "replit",
    domains: ["jobs.ashbyhq.com"],
  },
];

const OFFICIAL_CAREER_SOURCES = [
  { id: "bytedance", company: "字节跳动", domains: ["jobs.bytedance.com"] },
  { id: "tencent", company: "腾讯", domains: ["join.qq.com", "careers.tencent.com"] },
  { id: "alibaba", company: "阿里巴巴", domains: ["talent.alibaba.com", "campus.alibaba.com"] },
  { id: "antgroup", company: "蚂蚁集团", domains: ["talent.antgroup.com"] },
  { id: "baidu", company: "百度", domains: ["talent.baidu.com"] },
  { id: "meituan", company: "美团", domains: ["zhaopin.meituan.com"] },
  { id: "jd", company: "京东", domains: ["campus.jd.com", "zhaopin.jd.com"] },
  { id: "xiaomi", company: "小米", domains: ["hr.xiaomi.com"] },
  { id: "netease", company: "网易", domains: ["campus.163.com", "hr.163.com"] },
  { id: "kuaishou", company: "快手", domains: ["zhaopin.kuaishou.cn"] },
  { id: "huawei", company: "华为", domains: ["career.huawei.com"] },
  { id: "didi", company: "滴滴", domains: ["talent.didiglobal.com"] },
  { id: "bilibili", company: "哔哩哔哩", domains: ["jobs.bilibili.com"] },
  { id: "xiaohongshu", company: "小红书", domains: ["job.xiaohongshu.com"] },
  { id: "ctrip", company: "携程", domains: ["jobs.ctrip.com"] },
  { id: "360", company: "360", domains: ["hr.360.cn"] },
  { id: "sohu", company: "搜狐", domains: ["hr.sohu.com"] },
  { id: "lenovo", company: "联想", domains: ["jobs.lenovo.com"] },
  { id: "oppo", company: "OPPO", domains: ["careers.oppo.com"] },
  { id: "vivo", company: "vivo", domains: ["hr.vivo.com"] },
  { id: "dji", company: "大疆", domains: ["we.dji.com"] },
];

const parseExtraSources = () => {
  const raw = process.env.JOB_SOURCE_CONFIG_JSON?.trim();
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter((source) => source && source.id && source.company && source.adapter)
      : [];
  } catch {
    return [];
  }
};

export const getStructuredJobSources = () => [...STRUCTURED_JOB_SOURCES, ...parseExtraSources()];

export const getOfficialCareerSources = () => OFFICIAL_CAREER_SOURCES;

export const listJobSources = () => [
  ...getStructuredJobSources(),
  {
    id: "official-search-discovery",
    company: "互联网企业官网",
    adapter: "search-discovery",
    sourceType: "search-index",
    companies: OFFICIAL_CAREER_SOURCES.length,
    domains: [...new Set(OFFICIAL_CAREER_SOURCES.flatMap((source) => source.domains))],
  },
];

export { OFFICIAL_CAREER_SOURCES, STRUCTURED_JOB_SOURCES };
