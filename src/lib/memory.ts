/** 神経衰弱に必要な最小のペア数 */
export const MIN_PAIRS = 2;

export type MemoryCard = {
  /** 同じ画像の 2 枚が共有する番号 */
  pairId: number;
};

/** Fisher-Yates で並べ替えた新しい配列を返す */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 画像 1 枚につき 2 枚のカードを作り、シャッフルして返す */
export function createDeck(pairCount: number, random: () => number = Math.random): MemoryCard[] {
  const cards = Array.from({ length: pairCount }, (_, pairId) => [{ pairId }, { pairId }]).flat();
  return shuffle(cards, random);
}

/** ファイルパスから拡張子を除いたファイル名を返す（画像の代替テキストに使う） */
export function imageLabel(path: string): string {
  const name = path.split("/").pop() ?? path;
  return name.replace(/\.[^.]+$/, "");
}
