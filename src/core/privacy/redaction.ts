export type PrivacyPreferences = {
  hidePhone: boolean;
  hideEmail: boolean;
  hideAddress: boolean;
  hideIdNumber: boolean;
  hideName: boolean;
};

export const defaultPrivacyPreferences: PrivacyPreferences = {
  hidePhone: true,
  hideEmail: true,
  hideAddress: true,
  hideIdNumber: true,
  hideName: false,
};

export type RedactionResult = {
  text: string;
  redactedFields: Array<keyof PrivacyPreferences>;
};

const redact = (value: string, pattern: RegExp, replacement: string) => value.replace(pattern, replacement);

export const redactSensitiveText = (source: string, preferences: PrivacyPreferences): RedactionResult => {
  let text = String(source || "");
  const redactedFields: Array<keyof PrivacyPreferences> = [];
  const apply = (field: keyof PrivacyPreferences, pattern: RegExp, replacement: string) => {
    if (!preferences[field] || !pattern.test(text)) return;
    pattern.lastIndex = 0;
    text = redact(text, pattern, replacement);
    redactedFields.push(field);
  };

  apply("hidePhone", /(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d{9}(?!\d)/g, "[手机号已隐藏]");
  apply("hideEmail", /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[邮箱已隐藏]");
  apply("hideIdNumber", /(?<!\d)\d{6}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)/g, "[身份证号已隐藏]");
  apply("hideAddress", /(?:现居住地|家庭住址|通信地址|地址)\s*[:：]\s*[^\n。；]{4,80}/g, "地址：[详细地址已隐藏]");
  apply("hideName", /(?:姓名|Name)\s*[:：]\s*[\u4e00-\u9fa5·A-Za-z\s]{2,30}/gi, "姓名：[姓名已隐藏]");

  return { text, redactedFields: [...new Set(redactedFields)] };
};

export const redactUnknownPayload = (value: unknown, preferences: PrivacyPreferences, key = ""): unknown => {
  if (typeof value === "string") {
    const shouldRedact = /resume|profile|message|answer|text|content/i.test(key);
    return shouldRedact ? redactSensitiveText(value, preferences).text : value;
  }
  if (Array.isArray(value)) return value.map((item) => redactUnknownPayload(item, preferences, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [
      childKey,
      redactUnknownPayload(childValue, preferences, childKey),
    ]));
  }
  return value;
};
