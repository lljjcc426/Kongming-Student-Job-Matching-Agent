import { NativeResumePdfInput, NativeResumePdfPage } from '../common/NativeResumeLayoutService';

export interface ResumePdfBuild {
  bytes: ArrayBuffer;
  pages: NativeResumePdfPage[];
}

export declare function buildResumePdf(fontBytes: ArrayBuffer, input: NativeResumePdfInput): Promise<ResumePdfBuild>;
