export type RoleFamilyId = "software-development" | "ai-algorithm" | "data" | "product";

export type HardConstraintType =
  | "education"
  | "major"
  | "graduation-year"
  | "internship-duration"
  | "city"
  | "language"
  | "certificate"
  | "availability";

export type HardConstraint = {
  id: string;
  type: HardConstraintType;
  text: string;
  requiredValue: string;
};

export interface CareerDomainAdapter {
  id: string;
  displayName: string;
  supportedRoleFamilies: RoleFamilyId[];
  normalizeSkill(value: string): string;
  classifyJob(text: string): RoleFamilyId | null;
  extractHardConstraints(lines: string[]): HardConstraint[];
  buildInterviewTopics(roleFamily: RoleFamilyId | null): string[];
  validateResumeEvidence(sourceText: string, skill: string): boolean;
}
