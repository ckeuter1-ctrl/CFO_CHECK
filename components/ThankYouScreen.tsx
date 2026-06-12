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
