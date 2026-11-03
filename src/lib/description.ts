export type ParsedDescription = {
  venue: string | null;
  doorsAt: string | null;
  openAt: string | null;
  closesAt: string | null;
  price: string | null;
  ticketUrl: string | null;
  description: string | null;
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, body: string) => {
    if (!body.startsWith("#")) {
      return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
    }
    const isHex = body[1]?.toLowerCase() === "x";
    const code = Number.parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
    return Number.isInteger(code) && code >= 0 && code <= 0x10ffff
      ? String.fromCodePoint(code)
      : entity;
  });
}

// Google カレンダーの説明欄は HTML を含むことがあるため、プレーンテキストにする
function stripTags(raw: string): string {
  return raw
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?<\/a\s*>/gi, "$1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "");
}

// 貼り付けた埋め込みコードは &lt;blockquote&gt; のように届くため、文字参照を戻してからもう一度除去する
export function toPlainText(raw: string): string {
  return decodeEntities(stripTags(decodeEntities(stripTags(raw)))).replace(/\r\n?/g, "\n");
}

export function toHttpUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function normalizeTime(value: string): string | null {
  const halfWidth = value
    .trim()
    .replace(/[０-９：]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const match = /^(\d{1,2}):(\d{2})$/.exec(halfWidth);
  if (!match) return null;
  const [hours, minutes] = [Number(match[1]), Number(match[2])];
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

const DIGITS = "[0-9０-９]";
const JAPANESE_TIME = `(${DIGITS}{1,2})時(?:(${DIGITS}{1,2})分|(半))?`;

type Extracted = { value: string | null; text: string };

// 読み取った部分は表の項目に出すため、説明文からは取り除く
function extractTime(label: string, text: string): Extracted {
  const clock = new RegExp(
    `${label}(?:時間|時刻)?\\s*[:：]?\\s*(${DIGITS}{1,2}[:：]${DIGITS}{2})`,
  ).exec(text);
  const clockValue = clock?.[1] ? normalizeTime(clock[1]) : null;
  if (clock && clockValue) return { value: clockValue, text: text.replace(clock[0], "") };

  // 「19時開演」「開演19時30分」のような書き方
  const japanese =
    new RegExp(`${JAPANESE_TIME}\\s*${label}`).exec(text) ??
    new RegExp(`${label}(?:時間|時刻)?\\s*[:：]?\\s*${JAPANESE_TIME}`).exec(text);
  if (!japanese?.[1]) return { value: null, text };
  const minutes = japanese[3] ? "30" : (japanese[2] ?? "00").padStart(2, "0");
  const value = normalizeTime(`${japanese[1]}:${minutes}`);
  return value ? { value, text: text.replace(japanese[0], "") } : { value: null, text };
}

const YEN = "[0-9０-９][0-9０-９,，]*円";
const PRICE_TYPE = "会場|配信|前売り?|当日|一般|学生";

// 賞金などの金額を料金と誤読しないよう、料金とわかる語や記号が直前にあるものだけを読む
function extractPrice(text: string): Extracted {
  const typePattern = new RegExp(`(${PRICE_TYPE})(?:券|チケット)?\\s*[:：]?\\s*(${YEN})`, "g");
  const byType = [...text.matchAll(typePattern)];
  if (byType.length > 0) {
    return {
      value: byType.map((match) => `${match[1]}${match[2]}`).join(" / "),
      text: text.replace(typePattern, ""),
    };
  }

  const general = new RegExp(`(?:🎫|🎟️?|料金|入場料|チケット代?)\\s*[:：]?\\s*(${YEN})`).exec(text);
  return general?.[1]
    ? { value: general[1], text: text.replace(general[0], "") }
    : { value: null, text };
}

// 項目を取り除いたあとに残る記号と空行を片付ける
function cleanUpRemainder(text: string): string {
  return text
    .split("\n")
    .map((line) =>
      line
        .replace(/[⏰🕐]/gu, "")
        .replace(/[\s　]+[/／|｜・][\s　]*/g, " ")
        .replace(/[ \t　]{2,}/g, " ")
        .replace(/^[\s/／|｜・、,]+|[\s/／|｜・、,]+$/g, ""),
    )
    .filter(Boolean)
    .join("\n");
}

export function parseDescription(raw: string | undefined): ParsedDescription {
  const parsed: ParsedDescription = {
    venue: null,
    doorsAt: null,
    openAt: null,
    closesAt: null,
    price: null,
    ticketUrl: null,
    description: null,
  };
  if (!raw) return parsed;

  const rest: string[] = [];
  for (const line of toPlainText(raw).split("\n")) {
    const match = /^\s*(会場|場所|開場|開演|終演|入り|料金|チケット)(?:時間|時刻)?(?:\s*[:：]\s*|\s+)(.+?)\s*$/.exec(line);
    const label = match?.[1];
    const value = match?.[2] ?? "";

    // 「会場: 1,500円」は会場で払う料金のため、場所として読まない
    if ((label === "会場" || label === "場所") && !parsed.venue && !new RegExp(YEN).test(value)) {
      parsed.venue = value;
    } else if (label === "開場" && !parsed.doorsAt && normalizeTime(value)) {
      parsed.doorsAt = normalizeTime(value);
    } else if (label === "開演" && !parsed.openAt && normalizeTime(value)) {
      parsed.openAt = normalizeTime(value);
    } else if (label === "終演" && !parsed.closesAt && normalizeTime(value)) {
      parsed.closesAt = normalizeTime(value);
    } else if (label === "入り" && normalizeTime(value)) {
      // 入り時間はカレンダーの開始時刻にも入るため、サイトには出さない
      continue;
    } else if (label === "料金" && !parsed.price) {
      parsed.price = value;
    } else if (label === "チケット" && !parsed.ticketUrl && toHttpUrl(value)) {
      parsed.ticketUrl = toHttpUrl(value);
    } else {
      rest.push(line);
    }
  }

  // 告知文を貼っただけの説明欄でも表の項目に出せるよう、文中からも探す
  let remainder = rest.join("\n").trim();
  const before = remainder;
  const applyExtraction = (extract: (text: string) => Extracted): string | null => {
    const { value, text } = extract(remainder);
    remainder = text;
    return value;
  };
  parsed.doorsAt ??= applyExtraction((text) => extractTime("開場", text));
  parsed.openAt ??= applyExtraction((text) => extractTime("開演", text));
  parsed.closesAt ??= applyExtraction((text) => extractTime("終演", text));
  parsed.price ??= applyExtraction(extractPrice);

  parsed.description = (remainder === before ? remainder : cleanUpRemainder(remainder)) || null;
  return parsed;
}

const URL_PATTERN = /https?:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/g;

export type TextPart = { type: "text"; value: string } | { type: "link"; value: string };

// 説明文の URL をリンクとして表示するために分割する
export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let index = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    if (match.index > index) parts.push({ type: "text", value: text.slice(index, match.index) });
    parts.push(
      toHttpUrl(match[0]) ? { type: "link", value: match[0] } : { type: "text", value: match[0] },
    );
    index = match.index + match[0].length;
  }
  if (index < text.length) parts.push({ type: "text", value: text.slice(index) });
  return parts;
}

const COLLAPSE_THRESHOLD = 120;
const PREVIEW_LENGTH = 80;

// 長い説明文を、最初に見せる部分と折りたたむ部分に分ける
export function splitForPreview(text: string): { preview: string; rest: string | null } {
  const chars = [...text];
  if (chars.length <= COLLAPSE_THRESHOLD) return { preview: text, rest: null };

  let cut = chars.slice(0, PREVIEW_LENGTH).join("").length;
  // 近くに改行があればそこで区切る
  const lineBreak = text.lastIndexOf("\n", cut);
  if (lineBreak >= cut / 2) cut = lineBreak;
  // URL の途中で切らない
  for (const match of text.matchAll(URL_PATTERN)) {
    if (match.index < cut && cut < match.index + match[0].length) cut = match.index;
  }
  return { preview: text.slice(0, cut).trimEnd(), rest: text.slice(cut).trimStart() };
}
