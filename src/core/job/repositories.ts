import type { Job, JobKind } from "../../data";

export interface JobRepository<TKind extends JobKind> {
  readonly kind: TKind;
  accepts(job: Job): job is Job & { jobKind: TKind };
  list(jobs: Job[]): Array<Job & { jobKind: TKind }>;
}

const repository = <TKind extends JobKind>(kind: TKind): JobRepository<TKind> => ({
  kind,
  accepts(job): job is Job & { jobKind: TKind } {
    return job.jobKind === kind;
  },
  list(jobs) {
    return jobs.filter((job): job is Job & { jobKind: TKind } => job.jobKind === kind);
  },
});

export const VerifiedJobRepository = repository("verified-job");
export const ImportedJdRepository = repository("imported-jd");
export const CareerDirectionRepository = repository("career-direction");

const repositories = [VerifiedJobRepository, ImportedJdRepository, CareerDirectionRepository] as const;

export type JobCatalog = Record<JobKind, Job[]>;

export const buildJobCatalog = (jobs: Job[]): JobCatalog => {
  const catalog: JobCatalog = {
    "verified-job": [],
    "imported-jd": [],
    "career-direction": [],
  };
  const seen = new Set<string>();
  jobs.forEach((job) => {
    const key = `${job.jobKind}|${job.companyScenario}|${job.title}|${job.city}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const target = repositories.find((item) => item.accepts(job));
    if (target) catalog[target.kind].push(job);
  });
  return catalog;
};

export const isVerifiedActiveJob = (job: Job) => job.jobKind === "verified-job"
  && job.sourceMetadata?.sourceType === "official-career-site"
  && job.sourceMetadata.status === "active"
  && Boolean(job.sourceMetadata.sourceUrl);
