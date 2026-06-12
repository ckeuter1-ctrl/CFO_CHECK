export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;

export type UtmData = Record<(typeof UTM_KEYS)[number], string>;

export const DIRECT_UTM: UtmData = {
  utm_source: "direct",
  utm_medium: "direct",
  utm_campaign: "direct",
  utm_content: "direct",
};

export function readUtm(searchParams: URLSearchParams): UtmData {
  return UTM_KEYS.reduce<UtmData>(
    (result, key) => ({ ...result, [key]: searchParams.get(key)?.trim() || "direct" }),
    { ...DIRECT_UTM },
  );
}
