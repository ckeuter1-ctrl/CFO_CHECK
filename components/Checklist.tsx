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

        <button type="button" onClick={() => window.print()} className="print-hidden button-primary mt-8 w-full bg-forest text-white hover:bg-ink sm:w-auto">
          Сохранить в PDF
        </button>
      </div>
    </section>
  );
}
