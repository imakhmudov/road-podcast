// Kanal ma'lumotlari va ranglar (logotipdan olingan)
export const CHANNEL_URL = "https://t.me/road_podcasts";
export const CHANNEL_LABEL = "t.me/road_podcasts";
export const CHANNEL_NAME = "Road Podcast";
export const CTA_TEXT = "Follow for more";

const c = (r, g, b) => ({ r: r / 255, g: g / 255, b: b / 255 });

export const THEMES = {
  // logotip foni va oltin rangi
  dark: {
    bg: c(36, 39, 44),
    text: c(244, 242, 238),
    soft: c(196, 201, 208),
    muted: c(140, 147, 156),
    gold: c(205, 154, 74),
    rule: c(66, 71, 79),
    onGold: c(36, 39, 44),
  },
  light: {
    bg: c(250, 248, 243),
    text: c(36, 39, 44),
    soft: c(70, 76, 84),
    muted: c(115, 121, 130),
    gold: c(158, 108, 28),
    rule: c(224, 218, 206),
    onGold: c(36, 39, 44),
  },
};

// Telegram o'qish qulayligi uchun: tor, uzun sahifa + katta shrift
export const PAGE = { w: 400, h: 720, mx: 30, top: 40, bottom: 58 };
export const SIZE = { body: 17, label: 16, small: 16, title: 27, heading: 22, kicker: 12.5, footer: 10.5 };
