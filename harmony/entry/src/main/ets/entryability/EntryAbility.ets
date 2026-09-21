import { AbilityConstant, UIAbility, Want } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';

interface PageStorage {
  ShareUIAbilityWant: Want;
}

interface FormRoutePayload {
  page?: string;
}

const FORM_ROUTE_PAGES: string[] = ['home', 'resume', 'jobs', 'interview', 'growth'];

export default class EntryAbility extends UIAbility {
  private startupWant: Want = {};
  private pageStorage: LocalStorage | undefined = undefined;
  private routeSequence: number = 0;

  private formRoutePage(want: Want): string {
    let page = String(want.parameters?.['page'] || '').trim();
    const serializedParams = want.parameters?.['params'];
    if (!page && typeof serializedParams === 'string') {
      try {
        const payload = JSON.parse(serializedParams) as FormRoutePayload;
        page = String(payload.page || '').trim();
      } catch (error) {
        console.warn(`Ignored invalid service card route parameters: ${String(error)}`);
      }
    }
    return FORM_ROUTE_PAGES.includes(page) ? page : '';
  }

  private buildFormRouteRequest(want: Want): string {
    const page = this.formRoutePage(want);
    if (!page) return '';
    this.routeSequence += 1;
    return `${page}|${Date.now()}|${this.routeSequence}`;
  }

  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    this.startupWant = want;
  }

  onNewWant(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    this.startupWant = want;
    if (this.pageStorage) {
      this.pageStorage.setOrCreate('ShareUIAbilityWant', want);
    }
    AppStorage.setOrCreate('FormRouteRequest', this.buildFormRouteRequest(want));
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    const values: PageStorage = {
      ShareUIAbilityWant: this.startupWant,
    };
    const storage = new LocalStorage(values);
    this.pageStorage = storage;
    AppStorage.setOrCreate('FormRouteRequest', this.buildFormRouteRequest(this.startupWant));
    try {
      windowStage.loadContent('pages/NativeIndex', storage).catch((error: Error) => {
        console.error(`Failed to load the main page: ${error.message}`);
      });
    } catch (error) {
      console.error(`Failed to schedule the main page: ${String(error)}`);
    }
  }
}
