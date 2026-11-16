import { describe, expect, it } from "vitest";
import { createDeck, imageLabel, shuffle } from "./memory";

describe("shuffle", () => {
  it("要素を失わずに並べ替え、元の配列は変えない", () => {
    const items = [1, 2, 3, 4, 5];
    const result = shuffle(items, () => 0);
    expect(result).toEqual([2, 3, 4, 5, 1]);
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });

  it("random が 1 未満の最大値でも範囲外を参照しない", () => {
    expect(shuffle([1, 2, 3], () => 0.9999).sort()).toEqual([1, 2, 3]);
  });
});

describe("createDeck", () => {
  it("各ペアのカードをちょうど 2 枚ずつ作る", () => {
    const deck = createDeck(4);
    expect(deck).toHaveLength(8);
    for (let pairId = 0; pairId < 4; pairId++) {
      expect(deck.filter((card) => card.pairId === pairId)).toHaveLength(2);
    }
  });

  it("ペア数が 0 なら空", () => {
    expect(createDeck(0)).toEqual([]);
  });
});

it("imageLabel は拡張子を除いたファイル名を返す", () => {
  expect(imageLabel("/src/assets/memory/01-takahashi.webp")).toBe("01-takahashi");
  expect(imageLabel("stage.photo.jpg")).toBe("stage.photo");
});
