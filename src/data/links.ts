export const SITE_NAME = "クリストファー";
export const SITE_NAME_EN = "CHRISTOPHER";

// チャンネル ID の先頭 UC を UU に変えると、アップロード動画の再生リストになる
export const YOUTUBE_UPLOADS_PLAYLIST = "UUm3o-x-KILHHeNEsn5O8W2Q";

export const CONTACT_EMAIL = "mokuyoubi.takahashi1998@gmail.com";

export type SocialService = "x" | "instagram" | "youtube";

export type SocialLinkItem = {
  service: SocialService;
  name: string;
  detail: string;
  href: string;
};

export const comboLinks: SocialLinkItem[] = [
  {
    service: "youtube",
    name: SITE_NAME,
    detail: "YouTube",
    href: "https://youtube.com/channel/UCm3o-x-KILHHeNEsn5O8W2Q",
  },
];

export const memberLinks: { name: string; links: SocialLinkItem[] }[] = [
  {
    name: "齊藤木曜日",
    links: [
      {
        service: "x",
        name: "齊藤木曜日",
        detail: "@sharon_saitou",
        href: "https://x.com/sharon_saitou",
      },
      {
        service: "instagram",
        name: "齊藤木曜日",
        detail: "@mokuyoubi_saitou",
        href: "https://www.instagram.com/mokuyoubi_saitou/",
      },
    ],
  },
  {
    name: "高橋",
    links: [
      {
        service: "x",
        name: "高橋",
        detail: "@qjaLWHL9QS78389",
        href: "https://x.com/qjaLWHL9QS78389",
      },
      {
        service: "instagram",
        name: "高橋",
        detail: "@gjptwnmj",
        href: "https://www.instagram.com/gjptwnmj/",
      },
      {
        service: "youtube",
        name: "高橋",
        detail: "大喜利 YouTube",
        href: "https://youtube.com/channel/UCALJ_RFCr1qehgtUB057Cyw",
      },
    ],
  },
];

// ライブ情報を取得できないときの案内に使う
export const xLinks = memberLinks.flatMap(({ links }) =>
  links.filter((link) => link.service === "x"),
);
