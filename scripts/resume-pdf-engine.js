import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { NativeResumeLayoutService } from '../harmony/entry/src/main/ets/common/NativeResumeLayoutService.ets';

export async function buildResumePdf(fontBytes, input) {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const font = await document.embedFont(new Uint8Array(fontBytes), { subset: true });
  const characterSet = new Set(font.getCharacterSet());
  for (const character of `${input.name}${input.contact}求职意向：${input.jobTitle}${input.content}`) {
    if (!/\s/.test(character) && !characterSet.has(character.codePointAt(0))) throw new Error('FONT_UNSUPPORTED_CHAR');
  }
  const layout = new NativeResumeLayoutService();
  const pages = layout.layout(input, (text, size) => font.widthOfTextAtSize(text, size));
  document.setTitle(`${input.name} - ${input.jobTitle}`);
  document.setAuthor(input.name);
  for (const model of pages) {
    const page = document.addPage([layout.width, layout.height]);
    for (const line of model.lines) {
      page.drawText(line.text, {
        x: line.left, y: line.baseline, size: line.size, font,
        color: rgb(((line.color >> 16) & 255) / 255, ((line.color >> 8) & 255) / 255, (line.color & 255) / 255),
      });
    }
  }
  const bytes = await document.save();
  return { bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), pages };
}
