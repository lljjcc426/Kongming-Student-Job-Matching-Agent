export class NativeResumePdfInput {
  name: string;
  contact: string;
  jobTitle: string;
  content: string;

  constructor(name: string, contact: string, jobTitle: string, content: string) {
    this.name = name;
    this.contact = contact;
    this.jobTitle = jobTitle;
    this.content = content;
  }
}

export class NativeResumePdfLine {
  text: string;
  size: number;
  bold: boolean;
  left: number;
  baseline: number;
  color: number;

  constructor(
    text: string, size: number, bold: boolean, left: number, baseline: number, color: number,
  ) {
    this.text = text;
    this.size = size;
    this.bold = bold;
    this.left = left;
    this.baseline = baseline;
    this.color = color;
  }
}

export class NativeResumePdfPage {
  lines: NativeResumePdfLine[] = [];
}

export class NativeResumeLayoutService {
  readonly width: number = 595.28;
  readonly height: number = 841.89;
  readonly margin: number = 46;

  wrap(text: string, size: number, bold: boolean, measure: (text: string, size: number, bold: boolean) => number): string[] {
    const characters = Array.from(text);
    const lines: string[] = [];
    const availableWidth = this.width - this.margin * 2;
    let start = 0;
    while (start < characters.length) {
      let low = 1;
      let high = Math.min(64, characters.length - start);
      let fit = 0;
      while (high < characters.length - start) {
        const width = measure(characters.slice(start, start + high).join(''), size, bold);
        if (!Number.isFinite(width) || width < 0) throw new Error('Invalid text measurement');
        if (width > availableWidth) break;
        fit = high;
        low = high + 1;
        high = Math.min(high * 2, characters.length - start);
      }
      while (low <= high) {
        const length = Math.floor((low + high) / 2);
        const width = measure(characters.slice(start, start + length).join(''), size, bold);
        if (!Number.isFinite(width) || width < 0) throw new Error('Invalid text measurement');
        if (width <= availableWidth) {
          fit = length;
          low = length + 1;
        } else high = length - 1;
      }
      if (fit === 0) throw new Error('Text does not fit on page');
      if (start + fit < characters.length && /[A-Za-z0-9]/.test(characters[start + fit - 1]) &&
        /[A-Za-z0-9]/.test(characters[start + fit])) {
        const lastSpace = characters.slice(start, start + fit).lastIndexOf(' ');
        if (lastSpace >= fit / 2) fit = lastSpace + 1;
      }
      lines.push(characters.slice(start, start + fit).join(''));
      start += fit;
    }
    return lines;
  }

  layout(input: NativeResumePdfInput, measure: (text: string, size: number, bold: boolean) => number): NativeResumePdfPage[] {
    if (!input.content.trim() || input.content.length > 12000) throw new Error('Invalid resume length');
    const pages: NativeResumePdfPage[] = [new NativeResumePdfPage()];
    let cursor = this.height - 64;
    const add = (text: string, size: number, bold: boolean, color: number, spacing: number): void => {
      for (const line of this.wrap(text, size, bold, measure)) {
        if (cursor < this.margin + 18) {
          pages.push(new NativeResumePdfPage());
          cursor = this.height - 56;
        }
        pages[pages.length - 1].lines.push(new NativeResumePdfLine(line, size, bold, this.margin, cursor, color));
        cursor -= spacing;
      }
    };
    add(input.name.trim(), 24, true, 0x18212F, 30);
    cursor -= 8;
    if (input.contact.trim()) add(input.contact.trim(), 10.5, false, 0x4B5563, 17);
    add(`求职意向：${input.jobTitle.trim()}`, 11, false, 0x3156D3, 18);
    cursor -= 22;
    const paragraphs = input.content.replace(/\r\n?/g, '\n').split('\n');
    for (let index = 0; index < paragraphs.length; index += 1) {
      const paragraph = paragraphs[index].trim();
      if (!paragraph) {
        cursor -= 8;
        continue;
      }
      const heading = /^(?:【)?(?:教育背景|教育经历|个人简介|专业技能|技术技能|项目经历|项目经验|实习经历|工作经历|校园经历|获奖经历|荣誉奖项|自我评价)(?:】|[:：])?$/.test(paragraph);
      const nextParagraph = (paragraphs[index + 1] || '').trim();
      const shortTitle = !heading && paragraph.length <= 40 && nextParagraph.length > paragraph.length + 40;
      if (heading) {
        cursor -= 8;
      }
      if (heading || shortTitle) {
        const nextLines = nextParagraph ? Math.min(3, this.wrap(nextParagraph, 11, false, measure).length) : 1;
        if (cursor < this.margin + 18 + (heading ? 24 : 23) + nextLines * 18) cursor = 0;
      }
      add(paragraph, heading ? 13 : 11, heading, 0x18212F, heading ? 24 : 18);
      if (!heading) cursor -= 5;
    }
    for (let index = 0; index < pages.length; index += 1) {
      pages[index].lines.push(new NativeResumePdfLine(`${index + 1} / ${pages.length}`, 9, false, this.margin, 28, 0x6B7280));
    }
    return pages;
  }
}
