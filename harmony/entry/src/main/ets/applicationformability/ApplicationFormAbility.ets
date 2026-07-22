import { formInfo, FormExtensionAbility } from '@kit.FormKit';
import { Want } from '@kit.AbilityKit';
import { defaultCareerFormData, forgetFormId, rememberFormId, toFormBindingData, updateCareerForm } from '../common/CareerFormStore';

const FORM_ID_KEY: string = 'ohos.extra.param.key.form_identity';

export default class ApplicationFormAbility extends FormExtensionAbility {
  onAddForm(want: Want) {
    const formId = String(want.parameters?.[FORM_ID_KEY] || '');
    void rememberFormId(this.context, formId).then(() => updateCareerForm(this.context, formId));
    return toFormBindingData(defaultCareerFormData());
  }

  onUpdateForm(formId: string) {
    void updateCareerForm(this.context, formId);
  }

  onRemoveForm(formId: string) {
    void forgetFormId(this.context, formId);
  }

  onAcquireFormState(want: Want) {
    return formInfo.FormState.READY;
  }
}
