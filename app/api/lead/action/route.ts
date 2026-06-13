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
        await updateLead(leadId, {
          TITLE: "MQL: запрос диагностики — 10 признаков теневой Excel-системы",
        });
        await addTimelineComment(
          leadId,
          phone
            ? `Пользователь запросил диагностику контура факта. Телефон для связи: ${phone}`
            : "Пользователь запросил диагностику контура факта.",
        );
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
