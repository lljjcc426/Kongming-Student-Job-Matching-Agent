import { Context } from '@kit.AbilityKit';
import { formBindingData, formProvider } from '@kit.FormKit';
import { preferences } from '@kit.ArkData';

const STORE_NAME: string = 'career_form_store';
const FORM_IDS_KEY: string = 'form_ids';

export class CareerFormData {
  trackedCount: number = 0;
  pendingCount: number = 0;
  nextAction: string = '添加岗位后生成今日行动';
  jobTitle: string = '孔明职配';
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
  data.nextAction = await store.get('next_action', data.nextAction) as string;
  data.jobTitle = await store.get('job_title', data.jobTitle) as string;
  data.updatedAt = await store.get('updated_at', data.updatedAt) as string;
  return data;
}

export async function saveCareerFormData(context: Context, data: CareerFormData): Promise<void> {
  const store = await preferences.getPreferences(context, STORE_NAME);
  await store.put('tracked_count', Math.max(0, data.trackedCount));
  await store.put('pending_count', Math.max(0, data.pendingCount));
  await store.put('next_action', data.nextAction.slice(0, 100));
  await store.put('job_title', data.jobTitle.slice(0, 60));
  await store.put('updated_at', data.updatedAt.slice(0, 40));
  await store.flush();
}

async function getFormIds(context: Context): Promise<string[]> {
  const store = await preferences.getPreferences(context, STORE_NAME);
  return await store.get(FORM_IDS_KEY, []) as string[];
}

export async function rememberFormId(context: Context, formId: string): Promise<void> {
  if (!formId) return;
  const store = await preferences.getPreferences(context, STORE_NAME);
  const ids = await getFormIds(context);
  if (!ids.includes(formId)) ids.push(formId);
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
  return formBindingData.createFormBindingData(data);
}

export async function updateCareerForm(context: Context, formId: string): Promise<void> {
  if (!formId) return;
  await formProvider.updateForm(formId, toFormBindingData(await loadCareerFormData(context)));
}

export async function updateAllCareerForms(context: Context): Promise<number> {
  const ids = await getFormIds(context);
  const data = toFormBindingData(await loadCareerFormData(context));
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
