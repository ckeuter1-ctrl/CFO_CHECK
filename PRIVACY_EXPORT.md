# Privacy Export

## components/LeadForm.tsx

```tsx
"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Checklist from "@/components/Checklist";
import ThankYouScreen from "@/components/ThankYouScreen";
import { DIRECT_UTM, readUtm, type UtmData } from "@/lib/utm";

const LEAD_ID_KEY = "excel_shadow_lead_id";
const LEAD_EMAIL_KEY = "excel_shadow_lead_email";
const OTHER_ROLE = "Другое";

const ROLE_OPTIONS = [
  "Собственник / CEO",
  "CFO / финансовый директор",
  "Главный бухгалтер",
  "Руководитель казначейства",
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
  const formRef = useRef<HTMLFormElement>(null);
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

  function fillDebugTestData() {
    const form = formRef.current;
    if (!form || leadId) return;

    const emailInput = form.elements.namedItem("email");
    const nameInput = form.elements.namedItem("name");
    const companyInput = form.elements.namedItem("company");

    if (emailInput instanceof HTMLInputElement) {
      emailInput.value = `test+${Date.now()}@debug.local`;
    }
    if (nameInput instanceof HTMLInputElement) nameInput.value = "UTM Test";
    if (companyInput instanceof HTMLInputElement) companyInput.value = "UTM Test Company";

    setSelectedRole("CFO / финансовый директор");
    setError("");
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
          <form ref={formRef} onSubmit={submitLead} className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-soft backdrop-blur sm:p-9">
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

            <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm leading-5 text-ink/65">
              <input
                type="checkbox"
                name="privacyConsent"
                required
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#143b31]"
              />
              <span>
                Я согласен на обработку персональных данных и ознакомился с{" "}
                <Link href="/privacy" className="font-medium text-forest underline decoration-forest/30 underline-offset-2 hover:decoration-forest">
                  политикой конфиденциальности
                </Link>.
              </span>
            </label>

            {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}

            <button type="submit" disabled={submitting} className="button-primary mt-6 w-full bg-forest text-white hover:bg-ink disabled:cursor-wait disabled:opacity-70">
              {submitting ? "Отправляем…" : "Получить чек-лист"}
            </button>
            <p className="mt-4 text-center text-xs leading-5 text-ink/45">
              Материал откроется сразу после отправки. Без спама и навязчивых звонков.
            </p>
            <p className="mt-2 text-center text-xs leading-5 text-ink/45">
              Отправляя форму, вы соглашаетесь с{" "}
              <Link href="/privacy" className="text-forest underline decoration-forest/25 underline-offset-2 hover:decoration-forest">
                политикой конфиденциальности
              </Link>.
            </p>
          </form>
        )}

        {debug && (
          <aside className="mt-4 overflow-auto rounded-2xl border border-amber-300 bg-amber-50 p-4 font-mono text-xs leading-5 text-amber-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <strong>Debug (?debug=1)</strong>
              <div className="flex flex-wrap gap-2">
                {!leadId && (
                  <button
                    type="button"
                    onClick={fillDebugTestData}
                    className="rounded-lg border border-amber-500/50 bg-white/60 px-3 py-1.5 font-sans text-xs font-semibold transition hover:bg-white"
                  >
                    Заполнить тестовыми данными
                  </button>
                )}
                <button
                  type="button"
                  onClick={resetDebugSession}
                  className="rounded-lg border border-amber-500/50 bg-white/60 px-3 py-1.5 font-sans text-xs font-semibold transition hover:bg-white"
                >
                  Сбросить тестовую сессию
                </button>
              </div>
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

## components/ThankYouScreen.tsx

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

function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";

  if (digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  if (!digits.startsWith("7")) digits = `7${digits.slice(0, 10)}`;

  const national = digits.slice(1, 11);
  let formatted = "+7";
  if (national.length > 0) formatted += ` ${national.slice(0, 3)}`;
  if (national.length > 3) formatted += ` ${national.slice(3, 6)}`;
  if (national.length > 6) formatted += `-${national.slice(6, 8)}`;
  if (national.length > 8) formatted += `-${national.slice(8, 10)}`;
  return formatted;
}

function isValidPhone(value: string) {
  if (!value.trim()) return true;
  if (!/^[+\d\s()-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11;
}

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
  const [phoneError, setPhoneError] = useState("");

  function submitDiagnosis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidPhone(phone)) {
      setPhoneError("Введите телефон в формате +7 999 000-00-00 или оставьте поле пустым.");
      return;
    }

    setPhoneError("");
    onDiagnosisRequest(phone);
  }

  function changePhone(value: string) {
    setPhone(normalizePhone(value));
    if (phoneError) setPhoneError("");
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
                onChange={(event) => changePhone(event.target.value)}
                autoComplete="tel"
                inputMode="tel"
                maxLength={16}
                placeholder="+7 999 000-00-00"
                aria-invalid={phoneError ? "true" : "false"}
                aria-describedby={phoneError ? "diagnosis-phone-error" : undefined}
              />
            </label>
            {phoneError ? (
              <p id="diagnosis-phone-error" className="mt-2 text-sm leading-5 text-red-200" role="alert">
                {phoneError}
              </p>
            ) : (
              <p className="mt-2 text-xs leading-5 text-white/55">Оставьте номер, если удобнее обсудить диагностику по телефону.</p>
            )}
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

## app/api/lead/action/route.ts

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
        const phoneDigits = phone.replace(/[\s()+-]/g, "");
        if (phone && (!/^\d+$/.test(phoneDigits) || (phoneDigits.length !== 10 && phoneDigits.length !== 11))) {
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

## app/privacy/page.tsx

```tsx
import Link from "next/link";

export const metadata = {
  title: "Политика конфиденциальности | TABULA CONSULTING",
  description: "Краткая информация об обработке персональных данных на странице лид-магнита TABULA CONSULTING.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-5 py-10 sm:px-8 sm:py-16">
      <article className="mx-auto max-w-3xl rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-soft backdrop-blur sm:p-10 lg:p-14">
        <Link href="/" className="text-sm font-semibold text-forest underline decoration-forest/25 underline-offset-4 hover:decoration-forest">
          ← Вернуться к чек-листу
        </Link>

        <p className="mt-10 text-xs font-semibold uppercase tracking-[0.16em] text-copper">TABULA CONSULTING</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight text-ink sm:text-5xl">Политика конфиденциальности</h1>
        <p className="mt-5 text-base leading-7 text-ink/65">
          Эта страница кратко объясняет, как обрабатываются данные, которые вы оставляете при получении чек-листа или запросе диагностики.
        </p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-ink/70 sm:text-base">
          <section>
            <h2 className="font-serif text-2xl text-forest">Какие данные мы собираем</h2>
            <p className="mt-3">
              Рабочий email, а также имя, компания, должность и телефон, если вы решили их указать. Мы также сохраняем UTM-метки перехода и действия внутри чек-листа, чтобы понимать источник заявки и её контекст.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-forest">Зачем используются данные</h2>
            <p className="mt-3">
              Чтобы открыть материал, обработать запрос на диагностику, связаться с вами по заявке и улучшать полезность лид-магнита. Мы не просим указывать данные, которые не нужны для этих целей.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-forest">Где обрабатываются данные</h2>
            <p className="mt-3">
              Данные передаются в CRM Битрикс24, где используются TABULA CONSULTING для обработки заявки и связанных с ней действий. Доступ к данным предоставляется только в объёме, необходимом для работы с обращением.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-forest">Как запросить удаление</h2>
            <p className="mt-3">
              Вы можете попросить уточнить или удалить оставленные данные. Направьте запрос TABULA CONSULTING по тому же контактному каналу, по которому вы получили ссылку на эту страницу, и укажите email, использованный в форме. Мы найдём связанную запись и обработаем запрос.
            </p>
          </section>
        </div>

        <p className="mt-10 border-t border-forest/10 pt-6 text-xs leading-5 text-ink/45">
          Это краткая версия политики для MVP. Формулировки могут быть дополнены после юридической проверки.
        </p>
      </article>
    </main>
  );
}
```
