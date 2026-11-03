import type { LiveEvent } from "./calendar";
import { formatDate } from "./date";

export const POSTER_WIDTH = 1080;
export const POSTER_HEIGHT = 1350;
const MAX_ROWS_PER_PAGE = 6;

const MARGIN = 56;
const CONTENT_TOP = 236;
const CONTENT_BOTTOM = 1272;
const ROW_GAP = 14;
const ROW_PADDING = 18;
const DATE_WIDTH = 248;
const TEXT_LEFT = MARGIN + DATE_WIDTH;
const TEXT_WIDTH = POSTER_WIDTH - TEXT_LEFT - MARGIN - 24;
const TITLE_LINE = 46;
const DETAIL_LINE = 38;

const COLORS = {
  base: "#f3ecdf",
  surface: "#fbf8f2",
  line: "#d8cdbb",
  ink: "#2b2620",
  muted: "#6b6154",
  accent: "#7a3e22",
};

const FONT_FAMILY = '"Noto Sans JP Variable", "Hiragino Sans", sans-serif';
const FONTS = {
  name: `700 40px ${FONT_FAMILY}`,
  heading: `700 66px ${FONT_FAMILY}`,
  page: `500 28px ${FONT_FAMILY}`,
  date: `700 36px ${FONT_FAMILY}`,
  title: `700 34px ${FONT_FAMILY}`,
  detail: `500 27px ${FONT_FAMILY}`,
  footer: `500 24px ${FONT_FAMILY}`,
};

type MeasureText = (text: string, font: string) => number;

export type PosterRow = {
  date: string;
  titleLines: string[];
  detailLines: string[];
  height: number;
};

export function wrapText(
  text: string,
  font: string,
  maxWidth: number,
  measure: MeasureText,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const char of text) {
    if (line && measure(line + char, font) > maxWidth) {
      lines.push(line);
      line = char;
    } else {
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// TimeTree の予定スキャンが読み取りやすいよう、項目名を固定して 1 行ずつ書く
export function detailTexts(event: LiveEvent): string[] {
  const time =
    [
      event.doorsAt && `開場: ${event.doorsAt}`,
      event.openAt && `開演: ${event.openAt}`,
      event.closesAt && `終演: ${event.closesAt}`,
    ]
      .filter(Boolean)
      .join(" / ") || "時間未定";
  return [`場所: ${event.venue || "未定"}`, time, `料金: ${event.price || "未定"}`];
}

function toRow(event: LiveEvent, measure: MeasureText): PosterRow {
  const titleLines = wrapText(event.title, FONTS.title, TEXT_WIDTH, measure);
  const detailLines = detailTexts(event).flatMap((text) =>
    wrapText(text, FONTS.detail, TEXT_WIDTH, measure),
  );
  return {
    date: formatDate(event.start),
    titleLines,
    detailLines,
    height:
      ROW_PADDING * 2 + titleLines.length * TITLE_LINE + detailLines.length * DETAIL_LINE,
  };
}

// 件数と高さの両方に収まるように複数枚へ分ける
export function paginate(events: LiveEvent[], measure: MeasureText): PosterRow[][] {
  const available = CONTENT_BOTTOM - CONTENT_TOP;
  const pages: PosterRow[][] = [];
  let page: PosterRow[] = [];
  let used = 0;

  for (const event of events) {
    const row = toRow(event, measure);
    const needed = row.height + (page.length > 0 ? ROW_GAP : 0);
    if (page.length > 0 && (page.length >= MAX_ROWS_PER_PAGE || used + needed > available)) {
      pages.push(page);
      page = [];
      used = 0;
    }
    used += row.height + (page.length > 0 ? ROW_GAP : 0);
    page.push(row);
  }
  if (page.length > 0) pages.push(page);
  return pages;
}

export function allPosterText(events: LiveEvent[], monthLabel: string, name: string, url: string) {
  const eventText = events.flatMap((event) => [
    formatDate(event.start),
    event.title,
    ...detailTexts(event),
  ]);
  return [name, `${monthLabel} ライブ日程`, url, "0123456789/", ...eventText].join("");
}

export async function loadPosterFonts(text: string): Promise<void> {
  await Promise.all(Object.values(FONTS).map((font) => document.fonts.load(font, text)));
}

export function drawPoster(
  ctx: CanvasRenderingContext2D,
  rows: PosterRow[],
  options: { name: string; monthLabel: string; url: string; pageNumber: number; pageCount: number },
): void {
  ctx.fillStyle = COLORS.base;
  ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = COLORS.accent;
  ctx.font = FONTS.name;
  ctx.fillText(options.name, MARGIN, 96);

  if (options.pageCount > 1) {
    const label = `${options.pageNumber}/${options.pageCount}`;
    ctx.fillStyle = COLORS.muted;
    ctx.font = FONTS.page;
    ctx.fillText(label, POSTER_WIDTH - MARGIN - ctx.measureText(label).width, 96);
  }

  ctx.fillStyle = COLORS.ink;
  ctx.font = FONTS.heading;
  ctx.fillText(`${options.monthLabel} ライブ日程`, MARGIN, 186);

  let y = CONTENT_TOP;
  for (const row of rows) {
    ctx.fillStyle = COLORS.surface;
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(MARGIN, y, POSTER_WIDTH - MARGIN * 2, row.height, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COLORS.ink;
    ctx.font = FONTS.date;
    ctx.fillText(row.date, MARGIN + 22, y + ROW_PADDING + 36);

    let textY = y + ROW_PADDING + 34;
    ctx.font = FONTS.title;
    for (const line of row.titleLines) {
      ctx.fillText(line, TEXT_LEFT, textY);
      textY += TITLE_LINE;
    }
    textY += DETAIL_LINE - TITLE_LINE;
    ctx.fillStyle = COLORS.muted;
    ctx.font = FONTS.detail;
    for (const line of row.detailLines) {
      ctx.fillText(line, TEXT_LEFT, textY);
      textY += DETAIL_LINE;
    }

    y += row.height + ROW_GAP;
  }

  ctx.fillStyle = COLORS.muted;
  ctx.font = FONTS.footer;
  ctx.fillText(options.url, MARGIN, POSTER_HEIGHT - 36);
}

export function canvasMeasure(ctx: CanvasRenderingContext2D): MeasureText {
  return (text, font) => {
    ctx.font = font;
    return ctx.measureText(text).width;
  };
}
