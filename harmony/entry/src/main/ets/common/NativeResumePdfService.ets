import { common } from '@kit.AbilityKit';
import { taskpool } from '@kit.ArkTS';
import { fileIo } from '@kit.CoreFileKit';
import { buildResumePdf, ResumePdfBuild } from '../vendor/ResumePdfEngine';
import { NativeResumePdfInput, NativeResumePdfPage } from './NativeResumeLayoutService';

@Concurrent
async function createResumePdf(fontBytes: ArrayBuffer, serializedInput: string): Promise<ResumePdfBuild> {
  const input = JSON.parse(serializedInput) as NativeResumePdfInput;
  return await buildResumePdf(fontBytes, input);
}

export class NativeResumePdfResult {
  path: string;
  pages: NativeResumePdfPage[];

  constructor(path: string, pages: NativeResumePdfPage[]) {
    this.path = path;
    this.pages = pages;
  }
}

export class NativeResumePdfService {
  async create(context: common.UIAbilityContext, input: NativeResumePdfInput): Promise<NativeResumePdfResult> {
    const path = `${context.cacheDir}/kongming-resume-preview.pdf`;
    let fontFile: fileIo.File | undefined = undefined;
    let outputFile: fileIo.File | undefined = undefined;
    let saved = false;
    try {
      fontFile = await fileIo.open('/system/fonts/HarmonyOS_Sans_SC.ttf', fileIo.OpenMode.READ_ONLY);
      const fontLength = fileIo.statSync(fontFile.fd).size;
      const fontBytes = new ArrayBuffer(fontLength);
      let read = 0;
      while (read < fontLength) {
        const block = new ArrayBuffer(fontLength - read);
        const length = await fileIo.read(fontFile.fd, block, { offset: read });
        if (length === 0) throw new Error('Incomplete font read');
        new Uint8Array(fontBytes).set(new Uint8Array(block, 0, length), read);
        read += length;
      }
      const result = await taskpool.execute(createResumePdf, fontBytes, JSON.stringify(input)) as ResumePdfBuild;
      outputFile = await fileIo.open(path, fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.CREATE | fileIo.OpenMode.TRUNC);
      let written = 0;
      while (written < result.bytes.byteLength) {
        const length = await fileIo.write(outputFile.fd, result.bytes.slice(written), { offset: written });
        if (length === 0) throw new Error('Incomplete PDF write');
        written += length;
      }
      saved = true;
      return new NativeResumePdfResult(path, result.pages);
    } finally {
      if (fontFile) await fileIo.close(fontFile).catch(() => {});
      if (outputFile) await fileIo.close(outputFile).catch(() => {});
      if (!saved) await this.remove(path);
    }
  }

  async remove(path: string): Promise<void> {
    if (!path) return;
    try {
      await fileIo.unlink(path);
    } catch (error) {
      console.warn('Resume preview cleanup unavailable');
    }
  }
}
