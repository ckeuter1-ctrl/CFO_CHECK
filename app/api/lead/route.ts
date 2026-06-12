import { NextResponse } from "next/server";
import { BitrixError, createLead } from "@/lib/bitrix";
import { DIRECT_UTM } from "@/lib/utm";

export const runtime = "nodejs";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function optionalText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный формат запроса." }, { status: 400 });
  }

  const email = optionalText(body.email, 254).toLowerCase();

  if (!email) {
    return NextResponse.json({ ok: false, error: "Укажите рабочий email." }, { status: 400 });
  }

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ ok: false, error: "Проверьте формат email." }, { status: 400 });
  }

  try {
    const leadId = await createLead({
      email,
      name: optionalText(body.name, 100),
      company: optionalText(body.company, 180),
      role: optionalText(body.role, 180),
      utm_source: optionalText(body.utm_source, 255) || DIRECT_UTM.utm_source,
      utm_medium: optionalText(body.utm_medium, 255) || DIRECT_UTM.utm_medium,
      utm_campaign: optionalText(body.utm_campaign, 255) || DIRECT_UTM.utm_campaign,
      utm_content: optionalText(body.utm_content, 255) || DIRECT_UTM.utm_content,
    });

    return NextResponse.json({ ok: true, leadId });
  } catch (error) {
    const message = error instanceof BitrixError ? error.message : "Не удалось создать лид. Попробуйте позже.";
    console.error("Bitrix lead creation failed:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
