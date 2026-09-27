import { NativePublicJob } from './NativeJobService';
import { NativeJobFeedbackRecord } from './NativeWorkspaceModel';

export class NativeJobPreferenceProfile {
  preferredCities: string[];
  employmentType: string;
  graduationYear: string;
  salaryExpectation: string;
  preferredIndustries: string[];
  preferredCompanies: string[];

  constructor(
    preferredCities: string[] = [],
    employmentType: string = '不限',
    graduationYear: string = '',
    salaryExpectation: string = '',
    preferredIndustries: string[] = [],
    preferredCompanies: string[] = [],
  ) {
    this.preferredCities = preferredCities;
    this.employmentType = employmentType;
    this.graduationYear = graduationYear;
    this.salaryExpectation = salaryExpectation;
    this.preferredIndustries = preferredIndustries;
    this.preferredCompanies = preferredCompanies;
  }
}

class NativeSkillSignal {
  label: string;
  aliases: string[];

  constructor(label: string, aliases: string[]) {
    this.label = label;
    this.aliases = aliases;
  }
}

class NativeRoleSignal {
  label: string;
  aliases: string[];

  constructor(label: string, aliases: string[]) {
    this.label = label;
    this.aliases = aliases;
  }
}

export class NativeJobRecommendation {
  score: number;
  label: string;
  mode: string;
  matchedSkills: string[];
  missingSkills: string[];
  reasons: string[];
  gaps: string[];

  constructor(score: number, label: string, mode: string, matchedSkills: string[], missingSkills: string[],
    reasons: string[], gaps: string[]) {
    this.score = score;
    this.label = label;
    this.mode = mode;
    this.matchedSkills = matchedSkills;
    this.missingSkills = missingSkills;
    this.reasons = reasons;
    this.gaps = gaps;
  }
}

export class NativeJobRecommendationService {
  private skillSignals: NativeSkillSignal[] = [
    new NativeSkillSignal('Python', ['python']),
    new NativeSkillSignal('Java', ['java']),
    new NativeSkillSignal('Go', ['golang', 'go']),
    new NativeSkillSignal('C++', ['c++']),
    new NativeSkillSignal('JavaScript', ['javascript']),
    new NativeSkillSignal('TypeScript', ['typescript']),
    new NativeSkillSignal('React', ['react']),
    new NativeSkillSignal('Vue', ['vue']),
    new NativeSkillSignal('Node.js', ['node.js', 'nodejs']),
    new NativeSkillSignal('NestJS', ['nestjs']),
    new NativeSkillSignal('SQL', ['sql']),
    new NativeSkillSignal('PostgreSQL', ['postgresql', 'postgres']),
    new NativeSkillSignal('Redis', ['redis']),
    new NativeSkillSignal('Docker', ['docker']),
    new NativeSkillSignal('Git', ['git']),
    new NativeSkillSignal('Linux', ['linux']),
    new NativeSkillSignal('机器学习', ['机器学习', 'machine learning']),
    new NativeSkillSignal('深度学习', ['深度学习', 'deep learning']),
    new NativeSkillSignal('大模型', ['大模型', 'llm', 'large language model']),
    new NativeSkillSignal('自然语言处理', ['自然语言处理', 'nlp']),
    new NativeSkillSignal('计算机视觉', ['计算机视觉', 'computer vision', 'cv']),
    new NativeSkillSignal('数据分析', ['数据分析', 'data analysis', 'analytics']),
    new NativeSkillSignal('算法', ['算法', 'algorithm']),
    new NativeSkillSignal('Three.js', ['three.js', 'threejs']),
    new NativeSkillSignal('WebSocket', ['websocket']),
  ];

  private roleSignals: NativeRoleSignal[] = [
    new NativeRoleSignal('算法与 AI', ['算法', '人工智能', 'ai', '机器学习', '深度学习', '大模型', '模型工程']),
    new NativeRoleSignal('数据', ['数据分析', '数据科学', 'data analyst', 'data scientist', '数据工程']),
    new NativeRoleSignal('前端', ['前端', 'frontend', 'front-end', 'react', 'vue']),
    new NativeRoleSignal('后端', ['后端', 'backend', 'back-end', '服务端', 'server', '系统开发', '系统研发',
      '软件开发', 'software engineer']),
    new NativeRoleSignal('全栈', ['全栈', 'full stack', 'full-stack']),
    new NativeRoleSignal('产品', ['产品经理', '产品运营', 'product manager', 'product']),
    new NativeRoleSignal('测试', ['测试开发', '软件测试', '质量保障', 'qa', 'test engineer']),
    new NativeRoleSignal('设计', ['交互设计', '视觉设计', 'ui', 'ux', 'designer']),
    new NativeRoleSignal('运营', ['内容运营', '用户运营', '增长运营', 'operation', 'marketing']),
  ];

  rankJobs(
    jobs: NativePublicJob[],
    resumeSummary: string,
    targetJob: string,
    searchQuery: string,
    profile: NativeJobPreferenceProfile = new NativeJobPreferenceProfile(),
    feedbackRecords: NativeJobFeedbackRecord[] = [],
  ): NativePublicJob[] {
    const ranked: NativePublicJob[] = [];
    for (const job of jobs) {
      const recommendation = this.evaluateJob(job, resumeSummary, targetJob, searchQuery, profile, feedbackRecords);
      job.matchScore = recommendation.score;
      job.matchLabel = recommendation.label;
      job.matchMode = recommendation.mode;
      job.matchedSkills = recommendation.matchedSkills;
      job.missingSkills = recommendation.missingSkills;
      job.matchReasons = recommendation.reasons;
      job.matchGaps = recommendation.gaps;
      ranked.push(job);
    }
    ranked.sort((left: NativePublicJob, right: NativePublicJob) => {
      const priorityDifference = this.rankingValue(right) - this.rankingValue(left);
      if (priorityDifference !== 0) return priorityDifference;
      if (right.matchScore !== left.matchScore) return right.matchScore - left.matchScore;
      if (right.confidence !== left.confidence) return right.confidence - left.confidence;
      const leftTime = this.timeValue(left.publishedAt);
      const rightTime = this.timeValue(right.publishedAt);
      return rightTime - leftTime;
    });
    return ranked;
  }

  private rankingValue(job: NativePublicJob): number {
    return job.matchScore + Math.round(job.employerPriority * 0.1);
  }

  evaluateJob(
    job: NativePublicJob,
    resumeSummary: string,
    targetJob: string,
    searchQuery: string,
    profile: NativeJobPreferenceProfile = new NativeJobPreferenceProfile(),
    feedbackRecords: NativeJobFeedbackRecord[] = [],
  ): NativeJobRecommendation {
    const resumeText = this.normalize(resumeSummary);
    const intentText = this.normalize(`${targetJob} ${searchQuery}`);
    const jobText = this.normalize([
      job.title,
      job.level,
      job.employmentType,
      job.education,
      job.summary,
      job.description,
      job.keywords.join(' '),
    ].join(' '));
    const hasResumeEvidence = resumeText.replace(/\s/g, '').length >= 30;
    const resumeSkills = this.detectSkills(resumeText);
    const jobSkills = this.detectSkills(jobText);
    const matchedSkills = this.intersection(jobSkills, resumeSkills);
    const missingSkills = this.difference(jobSkills, resumeSkills);
    const reasons: string[] = [];
    const gaps: string[] = [];

    let score = this.roleScore(intentText, job.title, jobText, reasons, gaps);
    score += this.skillScore(jobSkills, matchedSkills, hasResumeEvidence, reasons, gaps);
    score += this.constraintScore(jobText, resumeText, intentText, reasons, gaps);
    score += this.evidenceQualityScore(resumeText, hasResumeEvidence, reasons);
    const preferenceReasons: string[] = [];
    const preferenceConflicts: string[] = [];
    score += this.preferenceScore(job, jobText, profile, preferenceReasons, preferenceConflicts);
    score += this.freshnessScore(job);
    const feedbackState = this.feedbackState(job, feedbackRecords);
    score += this.feedbackScore(feedbackState, preferenceReasons, preferenceConflicts);
    score += this.learnedFeedbackScore(job, feedbackRecords, preferenceReasons, preferenceConflicts);

    job.preferenceReasons = preferenceReasons.slice(0, 4);
    job.preferenceConflicts = preferenceConflicts.slice(0, 4);
    job.feedbackState = feedbackState;

    if (!hasResumeEvidence) {
      gaps.unshift('简历画像不足 30 字，当前只按目标方向排序。');
    }
    const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
    return new NativeJobRecommendation(
      boundedScore,
      this.scoreLabel(boundedScore, hasResumeEvidence, feedbackState),
      hasResumeEvidence ? 'preference-evidence' : 'preference-target',
      matchedSkills.slice(0, 5),
      missingSkills.slice(0, 5),
      reasons.slice(0, 4),
      gaps.slice(0, 4),
    );
  }

  private preferenceScore(
    job: NativePublicJob,
    jobText: string,
    profile: NativeJobPreferenceProfile,
    reasons: string[],
    conflicts: string[],
  ): number {
    let score = 0;
    const city = this.normalize(job.city);
    if (profile.preferredCities.length > 0) {
      let cityMatched = false;
      for (const preferredCity of profile.preferredCities) {
        const normalizedCity = this.normalize(preferredCity);
        if (normalizedCity && city.includes(normalizedCity)) cityMatched = true;
      }
      if (cityMatched) {
        score += 8;
        reasons.push(`地点符合“${profile.preferredCities.slice(0, 2).join('、')}”偏好。`);
      } else if (!/待确认|不限|未注明|暂无/.test(city)) {
        score -= 10;
        conflicts.push(`岗位地点为“${job.city}”，与城市偏好不一致。`);
      }
    }

    const employmentType = this.normalize(profile.employmentType);
    const employmentText = this.normalize(`${job.employmentType} ${job.level} ${job.title} ${jobText}`);
    if (employmentType && employmentType !== '不限') {
      const employmentMatched = employmentType === '实习'
        ? /实习|intern/.test(employmentText)
        : (employmentType === '校招'
          ? /校招|校园|应届|毕业生|graduate/.test(employmentText)
          : /社招|社会招聘|有经验|experienced/.test(employmentText));
      if (employmentMatched) {
        score += 8;
        reasons.push(`招聘类型符合“${profile.employmentType}”偏好。`);
      } else if (job.employmentType || job.level) {
        score -= 8;
        conflicts.push(`岗位招聘类型未体现“${profile.employmentType}”，需要核对招募对象。`);
      }
    }

    if (profile.preferredCompanies.length > 0) {
      for (const company of profile.preferredCompanies) {
        if (this.normalize(job.company).includes(this.normalize(company))) {
          score += 6;
          reasons.push(`公司符合“${company}”偏好。`);
          break;
        }
      }
    }

    if (profile.preferredIndustries.length > 0) {
      const companyAndJob = this.normalize(`${job.company} ${jobText}`);
      for (const industry of profile.preferredIndustries) {
        if (companyAndJob.includes(this.normalize(industry))) {
          score += 5;
          reasons.push(`岗位信息命中“${industry}”行业偏好。`);
          break;
        }
      }
    }

    const graduationYear = profile.graduationYear.match(/20\d{2}/)?.[0] || '';
    const graduationYears: string[] = jobText.match(/20\d{2}/g) || new Array<string>();
    if (graduationYear && graduationYears.length > 0) {
      if (graduationYears.includes(graduationYear)) {
        score += 5;
        reasons.push(`招募届次包含 ${graduationYear} 届。`);
      } else if (/届|毕业/.test(jobText)) {
        score -= 8;
        conflicts.push(`岗位招募届次未包含 ${graduationYear} 届。`);
      }
    }

    const expectedSalary = this.salaryValue(profile.salaryExpectation);
    const jobSalaryUpper = this.salaryUpperValue(job.salary);
    if (expectedSalary > 0 && jobSalaryUpper > 0) {
      if (jobSalaryUpper >= expectedSalary) {
        score += 5;
        reasons.push('公开薪资上限覆盖当前期望。');
      } else {
        score -= 8;
        conflicts.push('公开薪资上限低于当前期望。');
      }
    } else if (expectedSalary > 0 && !job.salary) {
      conflicts.push('岗位未公开薪资，需要在投递前核对。');
    }
    return score;
  }

  private freshnessScore(job: NativePublicJob): number {
    const publishedAt = this.timeValue(job.publishedAt);
    if (publishedAt <= 0) {
      job.freshnessLabel = '发布时间待确认';
      return 0;
    }
    const ageDays = Math.max(0, Math.floor((Date.now() - publishedAt) / 86400000));
    if (ageDays <= 14) {
      job.freshnessLabel = '近 14 天发布';
      return 4;
    }
    if (ageDays <= 45) {
      job.freshnessLabel = '近 45 天发布';
      return 2;
    }
    if (ageDays > 120) {
      job.freshnessLabel = '发布时间较早';
      return -6;
    }
    job.freshnessLabel = '发布时间已核对';
    return 0;
  }

  private jobFeedbackKey(job: NativePublicJob): string {
    return (job.sourceUrl || job.id).trim().toLowerCase();
  }

  private feedbackState(job: NativePublicJob, records: NativeJobFeedbackRecord[]): string {
    const key = this.jobFeedbackKey(job);
    for (let index = records.length - 1; index >= 0; index -= 1) {
      if (records[index].jobKey === key) return records[index].feedback;
    }
    return '';
  }

  private feedbackScore(feedback: string, reasons: string[], conflicts: string[]): number {
    if (feedback === 'interested') {
      reasons.push('你已将相似岗位标记为更感兴趣。');
      return 10;
    }
    if (feedback === 'location_mismatch') {
      conflicts.push('你已标记该岗位地点不合适。');
      return -25;
    }
    if (feedback === 'too_senior') {
      conflicts.push('你已标记该岗位要求偏高。');
      return -20;
    }
    if (feedback === 'not_interested') {
      conflicts.push('你已标记对该岗位不感兴趣。');
      return -45;
    }
    return 0;
  }

  private learnedFeedbackScore(
    job: NativePublicJob,
    records: NativeJobFeedbackRecord[],
    reasons: string[],
    conflicts: string[],
  ): number {
    const jobKey = this.jobFeedbackKey(job);
    const jobRoles = this.detectRoles(job.title);
    let score = 0;
    let positiveRole = '';
    let negativeRole = '';
    let rejectedCity = '';
    for (const record of records) {
      if (record.jobKey === jobKey) continue;
      const sharedRoles = this.intersection(jobRoles, this.detectRoles(record.title || ''));
      if (record.feedback === 'interested' && sharedRoles.length > 0) {
        score += 3;
        positiveRole = sharedRoles[0];
      } else if ((record.feedback === 'not_interested' || record.feedback === 'too_senior') &&
        sharedRoles.length > 0) {
        score -= 3;
        negativeRole = sharedRoles[0];
      } else if (record.feedback === 'location_mismatch' && record.city &&
        this.normalize(job.city).includes(this.normalize(record.city))) {
        score -= 5;
        rejectedCity = record.city;
      }
    }
    if (positiveRole) reasons.push(`根据历史反馈，优先展示“${positiveRole}”方向岗位。`);
    if (negativeRole) conflicts.push(`根据历史反馈，已降低“${negativeRole}”相似岗位排序。`);
    if (rejectedCity) conflicts.push(`根据历史反馈，已降低“${rejectedCity}”岗位排序。`);
    return Math.max(-12, Math.min(9, score));
  }

  private salaryValue(value: string): number {
    const match = this.normalize(value).match(/(\d{1,3}(?:\.\d+)?)\s*(?:k|千)/);
    return match ? Number(match[1]) : 0;
  }

  private salaryUpperValue(value: string): number {
    const matches = this.normalize(value).match(/\d{1,3}(?:\.\d+)?\s*(?:k|千)/g) || [];
    let upper = 0;
    for (const match of matches) {
      const numeric = Number(match.replace(/[^\d.]/g, ''));
      if (numeric > upper) upper = numeric;
    }
    return upper;
  }

  private roleScore(intentText: string, jobTitle: string, jobText: string, reasons: string[], gaps: string[]): number {
    const intentRoles = this.detectRoles(intentText);
    const titleRoles = this.detectRoles(jobTitle);
    const sharedTitleRoles = this.intersection(intentRoles, titleRoles);
    if (sharedTitleRoles.length > 0) {
      reasons.push(`岗位标题与目标“${sharedTitleRoles.slice(0, 2).join('、')}”一致。`);
      return Math.min(35, 30 + (sharedTitleRoles.length - 1) * 5);
    }
    const compactIntent = this.compact(intentText);
    const compactTitle = this.compact(jobTitle);
    if (compactIntent && compactTitle.length >= 2 &&
      (compactIntent.includes(compactTitle) || compactTitle.includes(compactIntent))) {
      reasons.push('岗位标题与当前求职意向直接相关。');
      return 24;
    }
    if (!intentText) {
      reasons.push('尚未设置明确目标岗位，当前按岗位信息进行基础排序。');
      return 10;
    }
    if (intentRoles.length > 0 && titleRoles.length > 0) {
      gaps.push(`岗位标题偏“${titleRoles.slice(0, 2).join('、')}”，与当前目标方向不完全一致。`);
      return 6;
    }
    const jobRoles = this.detectRoles(jobText);
    const sharedBodyRoles = this.intersection(intentRoles, jobRoles);
    if (sharedBodyRoles.length > 0) {
      reasons.push(`岗位描述涉及“${sharedBodyRoles.slice(0, 2).join('、')}”，可作为方向关联线索。`);
      gaps.push('岗位标题未直接体现目标方向，需要结合核心职责人工核对。');
      return 18;
    }
    return 6;
  }

  private skillScore(jobSkills: string[], matchedSkills: string[], hasResumeEvidence: boolean,
    reasons: string[], gaps: string[]): number {
    if (jobSkills.length === 0) {
      gaps.push('官方 JD 的结构化技能较少，需要打开原岗位页人工核对。');
      return hasResumeEvidence ? 12 : 6;
    }
    if (!hasResumeEvidence) {
      gaps.push(`岗位出现 ${jobSkills.slice(0, 4).join('、')}，但尚无简历证据可比对。`);
      return 0;
    }
    if (matchedSkills.length > 0) {
      reasons.push(`简历发现 ${matchedSkills.slice(0, 4).join('、')} 等技能证据。`);
    }
    const ratio = matchedSkills.length / jobSkills.length;
    const score = Math.min(40, matchedSkills.length * 8 + Math.round(ratio * 16));
    const missingSkills = this.difference(jobSkills, matchedSkills);
    if (missingSkills.length > 0) {
      gaps.push(`待核对 ${missingSkills.slice(0, 4).join('、')} 等岗位技能。`);
    }
    return score;
  }

  private constraintScore(jobText: string, resumeText: string, intentText: string,
    reasons: string[], gaps: string[]): number {
    let score = 3;
    const wantsInternship = /实习|intern/.test(intentText);
    const isInternship = /实习|intern/.test(jobText);
    if (wantsInternship && isInternship) {
      score += 7;
      reasons.push('岗位阶段与当前实习求职目标一致。');
    } else if (wantsInternship && !isInternship) {
      score -= 9;
      gaps.push('岗位未标记为实习，需要先核对招募对象和到岗要求。');
    }

    if (/博士/.test(jobText) && !/博士/.test(resumeText)) {
      score -= 20;
      gaps.push('岗位出现博士学历要求，当前简历未发现对应证据。');
    } else if (/硕士/.test(jobText) && !/硕士/.test(resumeText)) {
      score -= 15;
      gaps.push('岗位出现硕士学历要求，当前简历未发现对应证据。');
    } else if (/本科|学士/.test(jobText) && /本科|学士|大学/.test(resumeText)) {
      score += 5;
      reasons.push('当前简历存在本科教育背景线索。');
    }

    if (wantsInternship && /[2-9]\s*年[^。；\n]{0,12}经验|经验[^。；\n]{0,12}[2-9]\s*年/.test(jobText)) {
      score -= 10;
      gaps.push('岗位包含多年经验要求，可能不适合当前实习阶段。');
    }
    return score;
  }

  private evidenceQualityScore(resumeText: string, hasResumeEvidence: boolean, reasons: string[]): number {
    if (!hasResumeEvidence) return 0;
    let score = resumeText.length >= 160 ? 4 : 2;
    if (/负责|设计|实现|构建|开发|分析|验证|优化|交付|上线|发布/.test(resumeText)) score += 3;
    if (/%|\d/.test(resumeText)) score += 3;
    if (score >= 8) reasons.push('简历包含个人行动和结果线索，可继续核验。');
    return Math.min(10, score);
  }

  private detectSkills(text: string): string[] {
    const detected: string[] = [];
    for (const signal of this.skillSignals) {
      if (this.hasAnyAlias(text, signal.aliases)) detected.push(signal.label);
    }
    return detected;
  }

  private detectRoles(text: string): string[] {
    const detected: string[] = [];
    for (const signal of this.roleSignals) {
      if (this.hasAnyAlias(text, signal.aliases)) detected.push(signal.label);
    }
    return detected;
  }

  private hasAnyAlias(text: string, aliases: string[]): boolean {
    for (const alias of aliases) {
      if (this.containsAlias(text, alias)) return true;
    }
    return false;
  }

  private containsAlias(text: string, alias: string): boolean {
    const normalizedText = this.normalize(text);
    const normalizedAlias = this.normalize(alias);
    if (!normalizedAlias) return false;
    if (/[^a-z0-9+#. -]/.test(normalizedAlias)) return normalizedText.includes(normalizedAlias);
    let offset = normalizedText.indexOf(normalizedAlias);
    while (offset >= 0) {
      const before = offset > 0 ? normalizedText.charAt(offset - 1) : '';
      const afterIndex = offset + normalizedAlias.length;
      const after = afterIndex < normalizedText.length ? normalizedText.charAt(afterIndex) : '';
      if (!this.isAsciiWordCharacter(before) && !this.isAsciiWordCharacter(after)) return true;
      offset = normalizedText.indexOf(normalizedAlias, offset + normalizedAlias.length);
    }
    return false;
  }

  private isAsciiWordCharacter(value: string): boolean {
    return value ? /[a-z0-9]/.test(value) : false;
  }

  private intersection(left: string[], right: string[]): string[] {
    const result: string[] = [];
    for (const item of left) {
      if (right.includes(item) && !result.includes(item)) result.push(item);
    }
    return result;
  }

  private difference(left: string[], right: string[]): string[] {
    const result: string[] = [];
    for (const item of left) {
      if (!right.includes(item) && !result.includes(item)) result.push(item);
    }
    return result;
  }

  private scoreLabel(score: number, hasResumeEvidence: boolean, feedbackState: string): string {
    if (feedbackState === 'not_interested' || feedbackState === 'location_mismatch' || feedbackState === 'too_senior') {
      return '已降低推荐';
    }
    if (!hasResumeEvidence) return '方向排序';
    if (score >= 80) return '优先核对';
    if (score >= 65) return '值得关注';
    if (score >= 50) return '补证后评估';
    return '谨慎评估';
  }

  private normalize(value: string): string {
    return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  private compact(value: string): string {
    return this.normalize(value).replace(/[^a-z0-9\u3400-\u9fff]/g, '');
  }

  private timeValue(value: string): number {
    if (!value) return 0;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
}
