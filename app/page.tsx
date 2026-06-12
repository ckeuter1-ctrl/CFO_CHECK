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
        <div className="hidden h-px w-24 bg-forest/20 sm:block" />
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
