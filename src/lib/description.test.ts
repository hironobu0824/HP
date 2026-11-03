import { describe, expect, it } from "vitest";
import { parseDescription, splitForPreview, splitLinks, toPlainText } from "./description";

describe("toPlainText", () => {
  it("タグを除去して改行を保つ", () => {
    expect(toPlainText("<p>一行目</p><div>二行目<br>三行目</div>")).toBe(
      "一行目\n二行目\n三行目\n",
    );
  });

  it("script と style を中身ごと除去する", () => {
    expect(toPlainText('前<script>alert("x")</script><style>a{}</style>後')).toBe("前後");
  });

  it("リンクは URL に置き換える", () => {
    expect(toPlainText('<a href="https://example.com/t">購入</a>')).toBe("https://example.com/t");
  });

  it("文字参照で書かれたタグも除去する", () => {
    expect(
      toPlainText(
        '&lt;blockquote&gt;告知&lt;a href=&quot;https://x.com/a&quot;&gt;日付&lt;/a&gt;&lt;/blockquote&gt;&lt;script src=&quot;https://x.com/w.js&quot;&gt;&lt;/script&gt;',
      ),
    ).toBe("告知https://x.com/a");
  });

  it("ダッシュの文字参照を戻す", () => {
    expect(toPlainText("&mdash; Gコレ")).toBe("— Gコレ");
  });

  it("文字参照を戻す", () => {
    expect(toPlainText("A&amp;B&nbsp;&#x3042;&#12354;")).toBe("A&B ああ");
  });
});

describe("parseDescription", () => {
  it("決まった行を項目として読み取り、残りを説明にする", () => {
    expect(
      parseDescription(
        "開場: 20:45\n開演: 21:00\n料金: 1,500円\nチケット: https://example.com/t\nグッズ販売あり",
      ),
    ).toEqual({
      venue: null,
      doorsAt: "20:45",
      openAt: "21:00",
      closesAt: null,
      price: "1,500円",
      ticketUrl: "https://example.com/t",
      description: "グッズ販売あり",
    });
  });

  it("全角のコロンと数字を受け付ける", () => {
    expect(parseDescription("開場：１８：４５").doorsAt).toBe("18:45");
    expect(parseDescription("開場: 9:05").doorsAt).toBe("09:05");
  });

  it("入り時間をサイトに出さず、開演時間を読み取る", () => {
    expect(parseDescription("入り時間　17:00\n開演時間　18:00")).toEqual({
      venue: null,
      doorsAt: null,
      openAt: "18:00",
      closesAt: null,
      price: null,
      ticketUrl: null,
      description: null,
    });
  });

  it("告知文の途中の項目を読み取り、説明文から省く", () => {
    expect(
      parseDescription("漫才バトル開催！ ⏰ 開場19:40 ／開演20:00 終演21:30🎫 2,000円 (全席自由)ご予約はこちら"),
    ).toEqual({
      venue: null,
      doorsAt: "19:40",
      openAt: "20:00",
      closesAt: "21:30",
      price: "2,000円",
      ticketUrl: null,
      description: "漫才バトル開催！ (全席自由)ご予約はこちら",
    });
  });

  it.each([
    ["19時開演", "19:00"],
    ["19時30分開演", "19:30"],
    ["19時半開演", "19:30"],
    ["開演19時", "19:00"],
    ["開演：19時5分", "19:05"],
    ["１９時開演", "19:00"],
  ])("%s を読み取る", (text, expected) => {
    expect(parseDescription(text)).toMatchObject({ openAt: expected, description: null });
  });

  it("存在しない時刻は読み取らず、説明文に残す", () => {
    expect(parseDescription("25時開演")).toMatchObject({ openAt: null, description: "25時開演" });
  });

  it("項目を読み取らなかった説明文は変更しない", () => {
    expect(parseDescription("前説 / 後説あり").description).toBe("前説 / 後説あり");
  });

  it("終演の行を読み取る", () => {
    expect(parseDescription("終演時間　21:30")).toMatchObject({ closesAt: "21:30", description: null });
  });

  it("告知文の途中の料金を読み取り、賞金は読まない", () => {
    expect(
      parseDescription("賞金 1位10,000円、2位3,000円 大喜利賞1,000円 開演20:00 🎫 2,000円 (全席自由)").price,
    ).toBe("2,000円");
  });

  it("券種ごとの料金をまとめて読み取る", () => {
    expect(parseDescription("19時開演\n会場2000円　配信1000円")).toMatchObject({
      openAt: "19:00",
      price: "会場2000円 / 配信1000円",
      description: null,
    });
    expect(parseDescription("前売り 1,500円 当日券 2,000円").price).toBe(
      "前売り1,500円 / 当日2,000円",
    );
  });

  it("料金とわからない金額は読まない", () => {
    expect(parseDescription("チェキ撮影 500円").price).toBeNull();
    expect(parseDescription("賞金10,000円").price).toBeNull();
  });

  it("料金の行を文中の金額より優先する", () => {
    expect(parseDescription("料金: 無料\n当日 2,000円").price).toBe("無料");
  });

  it("項目の行を文中の時刻より優先する", () => {
    expect(parseDescription("開演: 18:00\n昼の部 開演12:00").openAt).toBe("18:00");
  });

  it("区切りのない語は項目として読まない", () => {
    expect(parseDescription("料金表はこちら").price).toBeNull();
    expect(parseDescription("料金表はこちら").description).toBe("料金表はこちら");
  });

  it("HTML の説明欄から読み取る", () => {
    expect(
      parseDescription('開場: 18:45<br>チケット: <a href="https://example.com/t">購入</a>'),
    ).toMatchObject({ doorsAt: "18:45", ticketUrl: "https://example.com/t" });
  });

  it("会場の行を場所として読み取り、説明文から省く", () => {
    expect(parseDescription("会場: 下北沢某劇場\n開演: 19:00\nグッズ販売あり")).toMatchObject({
      venue: "下北沢某劇場",
      openAt: "19:00",
      description: "グッズ販売あり",
    });
    expect(parseDescription("場所　新宿某劇場").venue).toBe("新宿某劇場");
  });

  it("会場の行が金額なら料金として読む", () => {
    expect(parseDescription("会場: 1,500円\n配信: 1,000円")).toMatchObject({
      venue: null,
      price: "会場1,500円 / 配信1,000円",
    });
  });

  it("読み取れない行は説明として残す", () => {
    expect(parseDescription("開場: 未定\nチケット: 当日券のみ")).toEqual({
      venue: null,
      doorsAt: null,
      openAt: null,
      closesAt: null,
      price: null,
      ticketUrl: null,
      description: "開場: 未定\nチケット: 当日券のみ",
    });
  });

  it("http と https 以外のチケット URL を受け付けない", () => {
    const parsed = parseDescription("チケット: javascript:alert(1)");
    expect(parsed.ticketUrl).toBeNull();
    expect(parsed.description).toBe("チケット: javascript:alert(1)");
  });

  it("説明欄がなければすべて null を返す", () => {
    expect(parseDescription(undefined)).toEqual({
      venue: null,
      doorsAt: null,
      openAt: null,
      closesAt: null,
      price: null,
      ticketUrl: null,
      description: null,
    });
  });
});

describe("splitLinks", () => {
  it("URL だけをリンクにする", () => {
    expect(splitLinks("詳細は https://example.com/a をご覧ください")).toEqual([
      { type: "text", value: "詳細は " },
      { type: "link", value: "https://example.com/a" },
      { type: "text", value: " をご覧ください" },
    ]);
  });

  it("URL の直後の日本語をリンクに含めない", () => {
    expect(splitLinks("https://t.co/abc当初の予定")).toEqual([
      { type: "link", value: "https://t.co/abc" },
      { type: "text", value: "当初の予定" },
    ]);
  });

  it("javascript: はリンクにしない", () => {
    expect(splitLinks("javascript:alert(1)")).toEqual([
      { type: "text", value: "javascript:alert(1)" },
    ]);
  });
});

describe("splitForPreview", () => {
  it("短い説明文は折りたたまない", () => {
    expect(splitForPreview("あ".repeat(120))).toEqual({ preview: "あ".repeat(120), rest: null });
  });

  it("長い説明文を分ける", () => {
    const { preview, rest } = splitForPreview("あ".repeat(121));
    expect(preview).toHaveLength(80);
    expect(rest).toHaveLength(41);
  });

  it("近くの改行で区切る", () => {
    const { preview, rest } = splitForPreview(`${"あ".repeat(60)}\n${"い".repeat(70)}`);
    expect(preview).toBe("あ".repeat(60));
    expect(rest).toBe("い".repeat(70));
  });

  it("URL の途中で切らない", () => {
    const url = `https://example.com/${"a".repeat(40)}`;
    const { preview, rest } = splitForPreview(`${"あ".repeat(70)}${url}${"い".repeat(40)}`);
    expect(preview).toBe("あ".repeat(70));
    expect(rest?.startsWith(url)).toBe(true);
  });
});
