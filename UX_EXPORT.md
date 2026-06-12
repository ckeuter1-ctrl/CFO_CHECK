# UX Export

Полные финальные версии файлов UX-изменений для ручного применения через GitHub-коннектор.

## `components/LeadForm.tsx`

```tsx
"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Checklist from "@/components/Checklist";
import ThankYouScreen from "@/components/ThankYouScreen";
import { DIRECT_UTM, readUtm, type UtmData } from "@/lib/utm";

const LEAD_ID_KEY = "excel_shadow_lead_id";
const LEAD_EMAIL_KEY = "excel_shadow_lead_email";
const OTHER_ROLE = "Другое";

const ROLE_OPTIONS = [
  "CFO / финансовый директор",
  "Финансовый контролер",
  "Собственник / CEO",
  "Руководитель казначейства",
  "Главный бухгалтер",
  "Руководитель проектного офиса",
  OTHER_ROLE,
];

type ApiResult = {
  ok: boolean;
  leadId?: string;
  error?: string;
  [key: string]: unknown;
};

export default function LeadForm() {
  const [hydrated, setHydrated] = useState(false);
  const [leadId, setLeadId] = useState("");
  const [leadCreated, setLeadCreated] = useState(false);
  const [utm, setUtm] = useState<UtmData>(DIRECT_UTM);
  const [debug, setDebug] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");
  const [error, setError] = useState("");
  const [focus, setFocus] = useState("");
  const [focusPending, setFocusPending] = useState(false);
  const [focusMessage, setFocusMessage] = useState("");
  const [diagnosisRequested, setDiagnosisRequested] = useState(false);
  const [diagnosisPending, setDiagnosisPending] = useState(false);
  const [lastCRMAction, setLastCRMAction] = useState("—");
  const [lastApiResponse, setLastApiResponse] = useState<ApiResult | null>(null);
  const submittingRef = useRef(false);
  const checklistActionPending = useRef(false);
  const focusRequestsPending = useRef(0);
  const selectedFocusRef = useRef("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const storedLeadId = localStorage.getItem(LEAD_ID_KEY) || "";
    const storedFocus = storedLeadId ? localStorage.getItem(`excel_shadow_focus_${storedLeadId}`) || "" : "";
    setUtm(readUtm(params));
    setDebug(params.get("debug") === "1");
    setLeadId(storedLeadId);
    setFocus(storedFocus);
    selectedFocusRef.current = storedFocus;
    setDiagnosisRequested(
      storedLeadId ? localStorage.getItem(`excel_shadow_diagnosis_${storedLeadId}`) === "true" : false,
    );
    setHydrated(true);
  }, []);

  const recordResult = useCallback((action: string, result: ApiResult) => {
    setLastCRMAction(action);
    setLastApiResponse(result);
  }, []);

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const existingLeadId = localStorage.getItem(LEAD_ID_KEY);
    if (existingLeadId) {
      setLeadId(existingLeadId);
      setLeadCreated(false);
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") || "").trim();
    const role = String(formData.get("role") || "").trim();
    const customRole = String(formData.get("customRole") || "").trim();
    const finalRole = role === OTHER_ROLE ? customRole || OTHER_ROLE : role;

    submittingRef.current = true;
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: String(formData.get("name") || "").trim(),
          company: String(formData.get("company") || "").trim(),
          role: finalRole,
          ...utm,
        }),
      });
      const result = (await response.json()) as ApiResult;
      recordResult("lead_created", result);

      if (!response.ok || !result.ok || !result.leadId) {
        setError(result.error || "Не удалось отправить форму. Попробуйте ещё раз.");
        return;
      }

      localStorage.setItem(LEAD_ID_KEY, result.leadId);
      localStorage.setItem(LEAD_EMAIL_KEY, email);
      setLeadId(result.leadId);
      setLeadCreated(true);
    } catch {
      const result = { ok: false, error: "Сетевая ошибка. Проверьте соединение и попробуйте ещё раз." };
      setError(result.error);
      recordResult("lead_created", result);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const postAction = useCallback(
    async (payload: Record<string, unknown>): Promise<ApiResult> => {
      try {
        const response = await fetch("/api/lead/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId, ...payload }),
        });
        return (await response.json()) as ApiResult;
      } catch {
        return { ok: false, error: "Сетевая ошибка." };
      }
    },
    [leadId],
  );

  async function openChecklist() {
    document.getElementById("checklist")?.scrollIntoView({ behavior: "smooth", block: "start" });
    const openedKey = `excel_shadow_checklist_opened_${leadId}`;
    if (checklistActionPending.current || localStorage.getItem(openedKey) === "true") return;

    checklistActionPending.current = true;
    const result = await postAction({ action: "checklist_opened" });
    checklistActionPending.current = false;
    recordResult("checklist_opened", result);
    if (result.ok) localStorage.setItem(openedKey, "true");
  }

  async function updateFocus(nextFocus: string) {
    if (nextFocus === selectedFocusRef.current) return;

    selectedFocusRef.current = nextFocus;
    setFocus(nextFocus);
    setFocusMessage("");
    localStorage.setItem(`excel_shadow_focus_${leadId}`, nextFocus);
    focusRequestsPending.current += 1;
    setFocusPending(true);

    const result = await postAction({ action: "focus_updated", focus: nextFocus });
    recordResult("focus_updated", result);
    focusRequestsPending.current -= 1;
    setFocusPending(focusRequestsPending.current > 0);

    if (!result.ok) {
      setFocusMessage("Выбор сохранён на странице, но CRM сейчас не ответила. Можно продолжить работу с чек-листом.");
    }
  }

  async function requestDiagnosis(phone: string) {
    if (diagnosisRequested || diagnosisPending) return;
    setDiagnosisPending(true);
    const result = await postAction({ action: "diagnosis_requested", phone: phone.trim() || undefined });
    recordResult("diagnosis_requested", result);
    if (result.ok) {
      setDiagnosisRequested(true);
      localStorage.setItem(`excel_shadow_diagnosis_${leadId}`, "true");
    }
    setDiagnosisPending(false);
  }

  function resetDebugSession() {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith("excel_shadow_")) localStorage.removeItem(key);
    }

    submittingRef.current = false;
    checklistActionPending.current = false;
    focusRequestsPending.current = 0;
    selectedFocusRef.current = "";
    setLeadId("");
    setLeadCreated(false);
    setSelectedRole("");
    setError("");
    setFocus("");
    setFocusPending(false);
    setFocusMessage("");
    setDiagnosisRequested(false);
    setDiagnosisPending(false);
    setLastCRMAction("session_reset");
    setLastApiResponse({ ok: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!hydrated) {
    return <div className="min-h-[560px] animate-pulse rounded-[2rem] bg-white/70 shadow-soft" aria-hidden="true" />;
  }

  return (
    <>
      <div className="self-start lg:sticky lg:top-8">
        {leadId ? (
          <ThankYouScreen
            focus={focus}
            focusPending={focusPending}
            focusMessage={focusMessage}
            diagnosisRequested={diagnosisRequested}
            diagnosisPending={diagnosisPending}
            onOpenChecklist={openChecklist}
            onFocusChange={updateFocus}
            onDiagnosisRequest={requestDiagnosis}
          />
        ) : (
          <form onSubmit={submitLead} className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-soft backdrop-blur sm:p-9">
            <div className="mb-7">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-copper">Доступ сразу</p>
              <h2 className="mt-2 font-serif text-3xl text-ink">Получить чек-лист</h2>
              <p className="mt-2 text-sm leading-6 text-ink/55">Оставьте рабочий email — материал откроется на этой странице.</p>
            </div>

            <div className="space-y-4">
              <label className="form-label">
                Рабочий email <span className="text-copper">*</span>
                <input className="form-input" type="email" name="email" autoComplete="email" required maxLength={254} placeholder="name@company.ru" />
              </label>
              <label className="form-label">
                Имя
                <input className="form-input" type="text" name="name" autoComplete="name" maxLength={100} placeholder="Александр" />
              </label>
              <label className="form-label">
                Компания
                <input className="form-input" type="text" name="company" autoComplete="organization" maxLength={180} placeholder="Название компании" />
              </label>
              <label className="form-label">
                Роль / должность
                <select
                  className="form-input appearance-none"
                  name="role"
                  value={selectedRole}
                  onChange={(event) => setSelectedRole(event.target.value)}
                >
                  <option value="">Выберите роль</option>
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </label>
              {selectedRole === OTHER_ROLE && (
                <label className="form-label">
                  Уточните роль
                  <input
                    className="form-input"
                    type="text"
                    name="customRole"
                    autoComplete="organization-title"
                    maxLength={180}
                    placeholder="Например, руководитель FP&A"
                  />
                </label>
              )}
            </div>

            {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}

            <button type="submit" disabled={submitting} className="button-primary mt-6 w-full bg-forest text-white hover:bg-ink disabled:cursor-wait disabled:opacity-70">
              {submitting ? "Отправляем…" : "Получить чек-лист"}
            </button>
            <p className="mt-4 text-center text-xs leading-5 text-ink/45">
              Материал откроется сразу после отправки. Без спама и навязчивых звонков.
            </p>
          </form>
        )}

        {debug && (
          <aside className="mt-4 overflow-auto rounded-2xl border border-amber-300 bg-amber-50 p-4 font-mono text-xs leading-5 text-amber-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <strong>Debug (?debug=1)</strong>
              <button
                type="button"
                onClick={resetDebugSession}
                className="rounded-lg border border-amber-500/50 bg-white/60 px-3 py-1.5 font-sans text-xs font-semibold transition hover:bg-white"
              >
                Сбросить тестовую сессию
              </button>
            </div>
            <pre className="mt-2 whitespace-pre-wrap">{JSON.stringify({ leadId: leadId || null, leadCreated, lastCRMAction, utm, lastApiResponse }, null, 2)}</pre>
          </aside>
        )}
      </div>

      {leadId && (
        <div className="col-span-full -mx-5 sm:-mx-8 lg:-mx-12">
          <Checklist leadId={leadId} onActionResult={recordResult} />
        </div>
      )}
    </>
  );
}
```

## `components/ThankYouScreen.tsx`

```tsx
"use client";

import { FormEvent, useState } from "react";

type ThankYouScreenProps = {
  focus: string;
  focusPending: boolean;
  focusMessage: string;
  diagnosisRequested: boolean;
  diagnosisPending: boolean;
  onOpenChecklist: () => void;
  onFocusChange: (focus: string) => void;
  onDiagnosisRequest: (phone: string) => void;
};

const FOCUS_OPTIONS = [
  "БДР",
  "БДДС",
  "Казначейство",
  "Управленческий отчет",
  "Пока просто заберу чек-лист",
];

export default function ThankYouScreen({
  focus,
  focusPending,
  focusMessage,
  diagnosisRequested,
  diagnosisPending,
  onOpenChecklist,
  onFocusChange,
  onDiagnosisRequest,
}: ThankYouScreenProps) {
  const [diagnosisFormVisible, setDiagnosisFormVisible] = useState(false);
  const [phone, setPhone] = useState("");

  function submitDiagnosis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onDiagnosisRequest(phone);
  }

  return (
    <section className="rounded-[2rem] bg-forest p-6 text-white shadow-soft sm:p-9" aria-live="polite">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl">✓</span>
      <h2 className="mt-6 font-serif text-4xl leading-tight">Чек-лист уже у вас</h2>
      <p className="mt-4 leading-7 text-white/75">Спасибо. Вы можете открыть чек-лист сразу ниже.</p>
      <p className="mt-3 leading-7 text-white/75">
        Если у вас совпало 3+ признака, это уже сигнал, что управленческий факт в компании частично собирается вручную и зависит не только от системы.
      </p>

      <div className="mt-7 grid gap-3">
        <button type="button" className="button-primary bg-white text-forest hover:bg-cream" onClick={onOpenChecklist}>
          Открыть / скачать чек-лист
        </button>

        {!diagnosisFormVisible && !diagnosisRequested && (
          <button
            type="button"
            className="button-secondary border-white/25 text-white hover:bg-white/10"
            onClick={() => setDiagnosisFormVisible(true)}
          >
            Запросить диагностику
          </button>
        )}

        {diagnosisFormVisible && !diagnosisRequested && (
          <form onSubmit={submitDiagnosis} className="rounded-2xl border border-white/15 bg-white/[0.06] p-4">
            <label className="block text-sm font-medium text-white/85">
              Телефон <span className="font-normal text-white/55">(необязательно)</span>
              <input
                className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-base text-white outline-none transition placeholder:text-white/35 focus:border-white/45 focus:bg-white/15 focus:ring-2 focus:ring-white/10"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
                maxLength={40}
                placeholder="+7 999 000-00-00"
              />
            </label>
            <p className="mt-2 text-xs leading-5 text-white/55">Оставьте номер, если удобнее обсудить диагностику по телефону.</p>
            <button
              type="submit"
              className="button-primary mt-4 w-full bg-white text-forest hover:bg-cream disabled:cursor-wait disabled:opacity-70"
              disabled={diagnosisPending}
            >
              {diagnosisPending ? "Отправляем заявку…" : "Отправить запрос"}
            </button>
          </form>
        )}

        {diagnosisRequested && (
          <button type="button" className="button-secondary border-white/25 text-white/70" disabled>
            Заявка принята. Свяжемся с вами.
          </button>
        )}
      </div>

      <fieldset className="mt-9 border-t border-white/15 pt-7">
        <legend className="text-sm font-semibold uppercase tracking-[0.11em] text-white/85">
          Если хотите, выберите, что проверить первым
        </legend>
        <div className="mt-4 flex flex-wrap gap-2">
          {FOCUS_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={focus === option}
              onClick={() => onFocusChange(option)}
              className={`rounded-full border px-4 py-2.5 text-left text-sm transition ${
                focus === option
                  ? "border-white bg-white text-forest"
                  : "border-white/20 text-white/75 hover:border-white/50 hover:text-white"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        {focusPending && <p className="mt-3 text-xs text-white/50">Сохраняем выбор в CRM…</p>}
        {focusMessage && <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-xs leading-5 text-white/75">{focusMessage}</p>}
      </fieldset>
    </section>
  );
}
```

## `app/api/lead/action/route.ts`

```ts
import { NextResponse } from "next/server";
import { addTimelineComment, appendLeadFocus, BitrixError, updateLead } from "@/lib/bitrix";

export const runtime = "nodejs";

const ACTIONS = ["checklist_opened", "focus_updated", "diagnosis_requested", "score_updated"] as const;
type LeadAction = (typeof ACTIONS)[number];

const ALLOWED_FOCUS = new Set([
  "БДР",
  "БДДС",
  "Казначейство",
  "Управленческий отчет",
  "Пока просто заберу чек-лист",
]);

function isAction(value: unknown): value is LeadAction {
  return typeof value === "string" && ACTIONS.includes(value as LeadAction);
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный формат запроса." }, { status: 400 });
  }

  const leadId = typeof body.leadId === "string" ? body.leadId.trim() : "";

  if (!/^\d+$/.test(leadId)) {
    return NextResponse.json({ ok: false, error: "Некорректный leadId." }, { status: 400 });
  }

  if (!isAction(body.action)) {
    return NextResponse.json({ ok: false, error: "Неизвестное действие." }, { status: 400 });
  }

  try {
    switch (body.action) {
      case "checklist_opened":
        await addTimelineComment(leadId, "Пользователь открыл чек-лист.");
        break;

      case "focus_updated": {
        const focus = typeof body.focus === "string" ? body.focus.trim() : "";
        if (!ALLOWED_FOCUS.has(focus)) {
          return NextResponse.json({ ok: false, error: "Некорректный фокус проверки." }, { status: 400 });
        }
        await appendLeadFocus(leadId, focus);
        await addTimelineComment(leadId, `Пользователь уточнил фокус проверки: ${focus}.`);
        break;
      }

      case "score_updated": {
        const score = typeof body.score === "number" ? body.score : Number.NaN;
        if (!Number.isInteger(score) || score < 0 || score > 10) {
          return NextResponse.json({ ok: false, error: "Score должен быть целым числом от 0 до 10." }, { status: 400 });
        }
        await addTimelineComment(leadId, `Пользователь отметил ${score} признаков теневой Excel-системы.`);
        break;
      }

      case "diagnosis_requested": {
        const phone = typeof body.phone === "string" ? body.phone.trim() : "";
        if (phone.length > 40) {
          return NextResponse.json({ ok: false, error: "Телефон указан в некорректном формате." }, { status: 400 });
        }
        await updateLead(
          leadId,
          { TITLE: "MQL: запрос диагностики — 10 признаков теневой Excel-системы" },
          phone || undefined,
        );
        await addTimelineComment(leadId, "Пользователь запросил диагностику контура факта.");
        break;
      }
    }

    return NextResponse.json({ ok: true, action: body.action });
  } catch (error) {
    const message = error instanceof BitrixError ? error.message : "Не удалось обновить лид. Попробуйте позже.";
    console.error(`Bitrix lead action failed (${body.action}):`, error);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
```

## `lib/bitrix.ts`

```ts
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

export async function updateLead(leadId: string, fields: Record<string, string>, phone?: string): Promise<void> {
  const formData = new FormData();
  formData.set("id", leadId);

  for (const [key, value] of Object.entries(fields)) {
    formData.set(`fields[${key}]`, value);
  }

  if (phone) {
    formData.set("fields[PHONE][0][VALUE]", phone);
    formData.set("fields[PHONE][0][VALUE_TYPE]", "WORK");
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
```

## `app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light;
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background:
    linear-gradient(135deg, rgba(220, 232, 223, 0.38), transparent 40%),
    #f5f2e9;
  color: #17201d;
  font-family: Arial, Helvetica, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.font-serif {
  font-family: Georgia, "Times New Roman", serif;
}

@layer components {
  .form-label {
    @apply block text-sm font-semibold text-ink/75;
  }

  .form-input {
    @apply mt-2 w-full rounded-xl border border-forest/10 bg-white/65 px-4 py-3 text-base font-normal text-ink outline-none transition placeholder:text-ink/30 hover:border-forest/20 focus:border-forest/45 focus:bg-white focus:ring-2 focus:ring-forest/10;
  }

  .button-primary,
  .button-secondary {
    @apply inline-flex min-h-12 items-center justify-center rounded-xl border border-transparent px-5 py-3 text-center text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-copper focus:ring-offset-2;
  }

  .button-secondary {
    @apply border-current;
  }
}

@media print {
  body {
    background: white;
  }

  header,
  main > section:first-of-type > :not(.col-span-full),
  .print-hidden {
    display: none !important;
  }

  .checklist-print {
    max-width: none;
    padding: 0;
  }

  .checklist-print > div {
    border: 0;
    box-shadow: none;
    padding: 0;
  }
}
```

## `app/page.tsx`

```tsx
import LeadForm from "@/components/LeadForm";

const insideItems = [
  "Специфика закрытия отчетных периодов вручную без системного следа.",
  "Оценка зависимости финансового учета от ухода ключевых лиц.",
  "Разбор мнимой интеграции, когда BI красивый, а реестр факта всё равно ручной.",
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-6 sm:px-8 lg:px-12">
        <div>
          <p className="font-serif text-lg font-semibold tracking-[0.13em] text-forest">TABULA CONSULTING</p>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-ink/55">
            Анализ и оптимизация контуров управленческого факта
          </p>
        </div>
        <p className="hidden rounded-full border border-forest/10 bg-white/45 px-4 py-2 text-xs font-medium tracking-wide text-forest/65 sm:block">
          Управленческий факт · без ручного хаоса
        </p>
      </header>

      <section className="relative mx-auto grid w-full max-w-7xl gap-10 px-5 pb-20 pt-8 sm:px-8 lg:grid-cols-[1.12fr_0.88fr] lg:gap-16 lg:px-12 lg:pb-28 lg:pt-14">
        <div className="pointer-events-none absolute -left-40 top-10 -z-10 h-96 w-96 rounded-full bg-sage/65 blur-3xl" />
        <div className="flex flex-col justify-center">
          <span className="mb-7 w-fit rounded-full border border-forest/15 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-forest">
            CFO инструмент · 2026
          </span>
          <h1 className="max-w-3xl font-serif text-5xl font-medium leading-[0.98] tracking-[-0.04em] text-ink sm:text-6xl lg:text-7xl">
            10 признаков теневой <span className="text-copper">Excel-системы</span>
          </h1>
          <p className="mt-7 max-w-2xl text-xl leading-relaxed text-forest sm:text-2xl">
            Проверьте, где у вас на самом деле живёт управленческий факт: в системе, в таблице или в голове ключевого сотрудника.
          </p>
          <p className="mt-6 max-w-2xl text-base leading-7 text-ink/65">
            Короткий self-check для CFO, финансового контролера и собственника. Помогает быстро понять, где факт собирается вручную, насколько компания зависит от одного файла или одного человека, и стал ли Excel рабочим инструментом или уже теневой системой управления.
          </p>

          <div className="mt-10 border-t border-forest/15 pt-7">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-forest">Что внутри чек-листа</h2>
            <ul className="mt-5 space-y-4">
              {insideItems.map((item, index) => (
                <li key={item} className="flex gap-4 text-sm leading-6 text-ink/70 sm:text-base">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest text-xs text-white">
                    {index + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <LeadForm />
      </section>
    </main>
  );
}
```
