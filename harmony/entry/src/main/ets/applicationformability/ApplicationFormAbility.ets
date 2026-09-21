import { formInfo, FormExtensionAbility } from '@kit.FormKit';
import { Want } from '@kit.AbilityKit';
import { defaultCareerFormData, forgetFormId, rememberFormId, toFormBindingData, updateCareerForm } from '../common/CareerFormStore';

const FORM_ID_KEY: string = 'ohos.extra.param.key.form_identity';

export default class ApplicationFormAbility extends FormExtensionAbility {
  private runFormTask(label: string, task: Promise<void>): void {
    void task.catch((error: Error) => {
      console.error(`${label}: ${String(error)}`);
    });
  }

  onAddForm(want: Want) {
    const formId = String(want.parameters?.[FORM_ID_KEY] || '');
    this.runFormTask('Application form add failed',
      rememberFormId(this.context, formId).then(() => updateCareerForm(this.context, formId)));
    return toFormBindingData(defaultCareerFormData());
  }

  onUpdateForm(formId: string) {
    this.runFormTask('Application form update failed', updateCareerForm(this.context, formId));
  }

  onRemoveForm(formId: string) {
    this.runFormTask('Application form removal failed', forgetFormId(this.context, formId));
  }

  onAcquireFormState(want: Want) {
    return formInfo.FormState.READY;
  }
}
