import { Context } from '@kit.AbilityKit';
import { formBindingData, formProvider } from '@kit.FormKit';
import { preferences } from '@kit.ArkData';

const STORE_NAME: string = 'career_form_store';
const FORM_IDS_KEY: string = 'form_ids';
const MAX_FORM_IDS: number = 100;
const FORM_ROUTE_PAGES: string[] = ['home', 'resume', 'jobs', 'interview', 'growth'];

function boundedInteger(value: number, fallback: number, maximum: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(0, Math.floor(value)));
}

function boundedText(value: string, fallback: string, maximumLength: number): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maximumLength) : fallback;
}

function normalizedRoutePage(value: string): string {
  const routePage = boundedText(value, 'home', 20);
  return FORM_ROUTE_PAGES.includes(routePage) ? routePage : 'home';
}

function normalizedFormData(source: CareerFormData): CareerFormData {
  const data = new CareerFormData();
  data.trackedCount = boundedInteger(source.trackedCount, 0, 9999);
  data.pendingCount = boundedInteger(source.pendingCount, 0, 9999);
  data.applicationStage = boundedText(source.applicationStage, data.applicationStage, 20);
  data.nextAction = boundedText(source.nextAction, data.nextAction, 100);
  data.jobTitle = boundedText(source.jobTitle, data.jobTitle, 60);
  data.empiricalCoverage = boundedInteger(source.empiricalCoverage, data.empiricalCoverage, 100);
  data.growthCompletedCount = boundedInteger(source.growthCompletedCount, 0, 999);
  data.growthTaskCount = boundedInteger(source.growthTaskCount, 0, 999);
  data.routePage = normalizedRoutePage(source.routePage);
  data.updatedAt = boundedText(source.updatedAt, data.updatedAt, 40);
  return data;
}

function normalizedFormIds(source: string[]): string[] {
  if (!Array.isArray(source)) return [];
  const ids: string[] = [];
  for (const rawId of source) {
    if (typeof rawId !== 'string') continue;
    const formId = rawId.trim();
    if (!/^\d{1,32}$/.test(formId) || ids.includes(formId)) continue;
    ids.push(formId);
    if (ids.length >= MAX_FORM_IDS) break;
  }
  return ids;
}

export class CareerFormData {
  trackedCount: number = 0;
  pendingCount: number = 0;
  applicationStage: string = '待追踪';
  nextAction: string = '添加岗位后生成今日行动';
  jobTitle: string = '孔明职配';
  empiricalCoverage: number = 42;
  growthCompletedCount: number = 0;
  growthTaskCount: number = 0;
  routePage: string = 'jobs';
  updatedAt: string = '尚未同步';
}

export function defaultCareerFormData(): CareerFormData {
  return new CareerFormData();
}

export async function loadCareerFormData(context: Context): Promise<CareerFormData> {
  const store = await preferences.getPreferences(context, STORE_NAME);
  const data = new CareerFormData();
  data.trackedCount = await store.get('tracked_count', 0) as number;
  data.pendingCount = await store.get('pending_count', 0) as number;
  data.applicationStage = await store.get('application_stage', data.applicationStage) as string;
  data.nextAction = await store.get('next_action', data.nextAction) as string;
  data.jobTitle = await store.get('job_title', data.jobTitle) as string;
  data.empiricalCoverage = await store.get('empirical_coverage', data.empiricalCoverage) as number;
  data.growthCompletedCount = await store.get('growth_completed_count', data.growthCompletedCount) as number;
  data.growthTaskCount = await store.get('growth_task_count', data.growthTaskCount) as number;
  data.routePage = await store.get('route_page', data.routePage) as string;
  data.updatedAt = await store.get('updated_at', data.updatedAt) as string;
  return normalizedFormData(data);
}

export async function saveCareerFormData(context: Context, data: CareerFormData): Promise<void> {
  const store = await preferences.getPreferences(context, STORE_NAME);
  const normalized = normalizedFormData(data);
  await store.put('tracked_count', normalized.trackedCount);
  await store.put('pending_count', normalized.pendingCount);
  await store.put('application_stage', normalized.applicationStage);
  await store.put('next_action', normalized.nextAction);
  await store.put('job_title', normalized.jobTitle);
  await store.put('empirical_coverage', normalized.empiricalCoverage);
  await store.put('growth_completed_count', normalized.growthCompletedCount);
  await store.put('growth_task_count', normalized.growthTaskCount);
  await store.put('route_page', normalized.routePage);
  await store.put('updated_at', normalized.updatedAt);
  await store.flush();
}

async function getFormIds(context: Context): Promise<string[]> {
  const store = await preferences.getPreferences(context, STORE_NAME);
  return normalizedFormIds(await store.get(FORM_IDS_KEY, []) as string[]);
}

export async function rememberFormId(context: Context, formId: string): Promise<void> {
  if (!/^\d{1,32}$/.test(formId)) return;
  const store = await preferences.getPreferences(context, STORE_NAME);
  const ids = await getFormIds(context);
  if (!ids.includes(formId)) ids.unshift(formId);
  if (ids.length > MAX_FORM_IDS) ids.length = MAX_FORM_IDS;
  await store.put(FORM_IDS_KEY, ids);
  await store.flush();
}

export async function forgetFormId(context: Context, formId: string): Promise<void> {
  const store = await preferences.getPreferences(context, STORE_NAME);
  const ids = (await getFormIds(context)).filter((id) => id !== formId);
  await store.put(FORM_IDS_KEY, ids);
  await store.flush();
}

export function toFormBindingData(data: CareerFormData): formBindingData.FormBindingData {
  return formBindingData.createFormBindingData(normalizedFormData(data));
}

export async function updateCareerForm(context: Context, formId: string): Promise<void> {
  if (!formId) return;
  await formProvider.updateForm(formId, toFormBindingData(await loadCareerFormData(context)));
}

export async function updateAllCareerForms(context: Context): Promise<number> {
  let ids: string[] = [];
  let data: formBindingData.FormBindingData;
  try {
    ids = await getFormIds(context);
    data = toFormBindingData(await loadCareerFormData(context));
  } catch (error) {
    console.error(`Application form synchronization preparation failed: ${String(error)}`);
    return 0;
  }
  let updated = 0;
  for (const formId of ids) {
    try {
      await formProvider.updateForm(formId, data);
      updated += 1;
    } catch (error) {
      console.error(`Application form update failed: ${formId}`);
    }
  }
  return updated;
}
