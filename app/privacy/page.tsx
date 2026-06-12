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
