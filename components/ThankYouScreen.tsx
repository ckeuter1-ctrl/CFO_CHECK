"use client";

type ThankYouScreenProps = {
  focus: string;
  focusPending: boolean;
  diagnosisRequested: boolean;
  diagnosisPending: boolean;
  onOpenChecklist: () => void;
  onFocusChange: (focus: string) => void;
  onDiagnosisRequest: () => void;
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
  diagnosisRequested,
  diagnosisPending,
  onOpenChecklist,
  onFocusChange,
  onDiagnosisRequest,
}: ThankYouScreenProps) {
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
        <button
          type="button"
          className="button-secondary border-white/25 text-white hover:bg-white/10 disabled:cursor-default disabled:opacity-70"
          onClick={onDiagnosisRequest}
          disabled={diagnosisRequested || diagnosisPending}
        >
          {diagnosisRequested
            ? "Заявка принята. Свяжемся с вами."
            : diagnosisPending
              ? "Отправляем заявку…"
              : "Запросить диагностику"}
        </button>
      </div>

      <fieldset className="mt-9 border-t border-white/15 pt-7" disabled={focusPending}>
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
      </fieldset>
    </section>
  );
}
