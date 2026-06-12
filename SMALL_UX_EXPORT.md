# Small UX Export

## components/LeadForm.tsx

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

## components/Checklist.tsx

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

const SYMPTOMS = [
  "Перед встречей с руководством открывают не ERP / BI-систему, а сводный файл Excel.",
  "В компании есть конкретный человек, который единственный знает “правильную” версию цифр.",
  "Фактические данные собираются только после долгих выгрузок и ручного маппинга аналитик.",
  "Один и тот же показатель трудно быстро объяснить от источника до итогового отчета.",
  "BI показывает красиво, но источник цифры всё равно собирают руками.",
  "Без таблицы нельзя нормально закрыть период.",
  "Никто до конца не уверен, какая версия файла финальная.",
  "Таблица стала частью процесса, но не имеет контроля процесса.",
  "Новые сотрудники не понимают логику сборки.",
  "Потеря автора файла становится операционным риском.",
];

type ApiResult = { ok: boolean; [key: string]: unknown };

type ChecklistProps = {
  leadId: string;
  onActionResult: (action: string, result: ApiResult) => void;
};

function scoreLabel(score: number): string {
  if (score <= 2) return "Низкий риск.";
  if (score <= 5) return "Контур факта уже частично ручной.";
  if (score <= 8) return "Excel стал теневой системой управления.";
  return "Высокий риск управляемости.";
}

export default function Checklist({ leadId, onActionResult }: ChecklistProps) {
  const storageKey = `excel_shadow_score_${leadId}`;
  const [selected, setSelected] = useState<number[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "[]") as unknown;
      return Array.isArray(saved)
        ? saved.filter((item): item is number => Number.isInteger(item) && item >= 0 && item < 10)
        : [];
    } catch {
      return [];
    }
  });
  const sentStorageKey = `excel_shadow_score_sent_${leadId}`;
  const savedSentScore = typeof window === "undefined" ? null : localStorage.getItem(sentStorageKey);
  const lastSentScore = useRef<number | null>(
    savedSentScore !== null ? Number(savedSentScore) : selected.length === 0 ? 0 : null,
  );

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(selected));
    const score = selected.length;

    if (score === lastSentScore.current) return;

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/lead/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId, action: "score_updated", score }),
        });
        const result = (await response.json()) as ApiResult;
        onActionResult("score_updated", result);
        if (response.ok && result.ok) {
          lastSentScore.current = score;
          localStorage.setItem(sentStorageKey, String(score));
        }
      } catch {
        onActionResult("score_updated", { ok: false, error: "Сетевая ошибка." });
      }
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [leadId, onActionResult, selected, sentStorageKey, storageKey]);

  const toggle = (index: number) => {
    setSelected((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index],
    );
  };

  return (
    <section id="checklist" className="checklist-print mx-auto w-full max-w-5xl px-5 pb-24 pt-8 sm:px-8 lg:px-12">
      <div className="rounded-[2rem] border border-forest/10 bg-white p-6 shadow-soft sm:p-10 lg:p-14">
        <div className="border-b border-forest/10 pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-copper">Self-check</p>
          <h2 className="mt-3 max-w-2xl font-serif text-4xl leading-tight text-ink sm:text-5xl">
            10 признаков теневой Excel-системы
          </h2>
          <p className="mt-4 max-w-2xl leading-7 text-ink/60">
            Как быстро понять, где у вас на самом деле живёт управленческий факт: в системе, в таблице или в голове ключевого сотрудника.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          {SYMPTOMS.map((symptom, index) => {
            const checked = selected.includes(index);
            return (
              <label
                key={symptom}
                className={`group flex cursor-pointer gap-4 rounded-2xl border p-4 transition sm:p-5 ${
                  checked ? "border-forest bg-sage/55" : "border-forest/10 hover:border-forest/30"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(index)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[#143b31]"
                />
                <span className="leading-6 text-ink/80">
                  <strong className="mr-2 font-semibold text-forest">{index + 1}.</strong>
                  {symptom}
                </span>
              </label>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl bg-cream p-5 sm:flex sm:items-center sm:justify-between sm:p-7">
          <div>
            <p className="text-sm uppercase tracking-[0.12em] text-ink/50">Выявлено симптомов</p>
            <p className="mt-1 font-serif text-4xl text-forest">{selected.length} / 10</p>
          </div>
          <p className="mt-4 max-w-md text-lg font-medium text-ink sm:mt-0 sm:text-right">{scoreLabel(selected.length)}</p>
        </div>

        <div className="mt-6 grid gap-3 text-sm text-ink/65 sm:grid-cols-2">
          <p><strong className="text-forest">0–2:</strong> низкий риск.</p>
          <p><strong className="text-forest">3–5:</strong> контур факта уже частично ручной.</p>
          <p><strong className="text-forest">6–8:</strong> Excel стал теневой системой управления.</p>
          <p><strong className="text-forest">9–10:</strong> высокий риск управляемости.</p>
        </div>

        <div className="print-hidden mt-8 flex justify-end border-t border-forest/10 pt-6">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-full border border-forest/20 px-5 py-3 text-sm font-semibold text-forest transition hover:border-forest/40 hover:bg-sage/40"
          >
            Сохранить в PDF
          </button>
        </div>
      </div>
    </section>
  );
}
```
