import { AbilityConstant, UIAbility, Want } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';

interface PageStorage {
  ShareUIAbilityWant: Want;
}

export default class EntryAbility extends UIAbility {
  private startupWant: Want = {};

  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    this.startupWant = want;
  }

  onNewWant(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    this.startupWant = want;
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    const values: PageStorage = { ShareUIAbilityWant: this.startupWant };
    const storage = new LocalStorage(values);
    try {
      windowStage.loadContent('pages/NativeIndex', storage).catch((error: Error) => {
        console.error(`Failed to load the main page: ${error.message}`);
      });
    } catch (error) {
      console.error(`Failed to schedule the main page: ${String(error)}`);
    }
  }
}
