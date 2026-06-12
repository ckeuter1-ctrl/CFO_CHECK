const REQUEST_TIMEOUT_MS = 10_000;

export class BitrixError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BitrixError";
  }
}

type BitrixResponse<T> = {
  result?: T;
  error?: string;
  error_description?: string;
};

function getWebhookBaseUrl(): string {
  const value = process.env.BITRIX_WEBHOOK_BASE_URL?.trim();

  if (!value) {
    throw new BitrixError("BITRIX_WEBHOOK_BASE_URL не настроен на сервере.");
  }

  return value.endsWith("/") ? value : `${value}/`;
}

async function callBitrix<T>(method: string, formData: FormData): Promise<T> {
  const response = await fetch(`${getWebhookBaseUrl()}${method}.json`, {
    method: "POST",
    body: formData,
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  let payload: BitrixResponse<T>;

  try {
    payload = (await response.json()) as BitrixResponse<T>;
  } catch {
    throw new BitrixError(`Битрикс24 вернул некорректный ответ (HTTP ${response.status}).`);
  }

  if (!response.ok || payload.error || payload.result === undefined) {
    throw new BitrixError(
      payload.error_description || payload.error || `Ошибка Битрикс24 (HTTP ${response.status}).`,
    );
  }

  return payload.result;
}

export type CreateLeadInput = {
  email: string;
  name?: string;
  company?: string;
  role?: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
};

export async function createLead(input: CreateLeadInput): Promise<string> {
  const formData = new FormData();
  const comments = [
    "Источник: лид-магнит “10 признаков теневой Excel-системы”",
    "Фокус проверки: пока не выбран",
    `UTM source: ${input.utm_source}`,
    `UTM medium: ${input.utm_medium}`,
    `UTM campaign: ${input.utm_campaign}`,
    `UTM content: ${input.utm_content}`,
  ].join("\n");

  formData.set("fields[TITLE]", "Лид-магнит: 10 признаков теневой Excel-системы");
  formData.set("fields[NAME]", input.name || "");
  formData.set("fields[COMPANY_TITLE]", input.company || "");
  formData.set("fields[POST]", input.role || "");
  formData.set("fields[EMAIL][0][VALUE]", input.email);
  formData.set("fields[EMAIL][0][VALUE_TYPE]", "WORK");
  formData.set("fields[COMMENTS]", comments);
  formData.set("fields[UTM_SOURCE]", input.utm_source);
  formData.set("fields[UTM_MEDIUM]", input.utm_medium);
  formData.set("fields[UTM_CAMPAIGN]", input.utm_campaign);
  formData.set("fields[UTM_CONTENT]", input.utm_content);

  const result = await callBitrix<number | string>("crm.lead.add", formData);
  return String(result);
}

export async function addTimelineComment(leadId: string, comment: string): Promise<void> {
  const formData = new FormData();
  formData.set("fields[ENTITY_ID]", leadId);
  formData.set("fields[ENTITY_TYPE]", "lead");
  formData.set("fields[COMMENT]", comment);
  await callBitrix<unknown>("crm.timeline.comment.add", formData);
}

export async function updateLead(leadId: string, fields: Record<string, string>): Promise<void> {
  const formData = new FormData();
  formData.set("id", leadId);

  for (const [key, value] of Object.entries(fields)) {
    formData.set(`fields[${key}]`, value);
  }

  await callBitrix<boolean>("crm.lead.update", formData);
}

export async function appendLeadFocus(leadId: string, focus: string): Promise<void> {
  const getFormData = new FormData();
  getFormData.set("id", leadId);
  const lead = await callBitrix<{ COMMENTS?: string }>("crm.lead.get", getFormData);
  const existingComments = lead.COMMENTS?.trim();
  const focusLine = `Фокус проверки: ${focus}`;
  const comments = existingComments ? `${existingComments}\n${focusLine}` : focusLine;
  await updateLead(leadId, { COMMENTS: comments });
}
