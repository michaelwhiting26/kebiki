import glyphData from "./seal-glyphs.json";

/**
 * Stroke data for the three characters of the seal (罫引き), for the tegaki handwriting renderer.
 * Generated with tegaki's own generator from Klee One (SIL Open Font License), with stroke order
 * taken from its Japanese reference. The matching three-glyph font subset is public/fonts/klee-one-seal.ttf.
 * To regenerate: tegaki generate --font-file klee-one.ttf --chars "罫引き" --han-locale ja
 */
const FONT_URL = "/fonts/klee-one-seal.ttf";

const sealFont = {
  version: 1,
  family: "Klee One Tegaki Seal",
  lineCap: "round",
  fontUrl: FONT_URL,
  fontFaceCSS: `@font-face { font-family: 'Klee One Tegaki Seal'; src: url(${FONT_URL}); }`,
  unitsPerEm: 1000,
  ascender: 1160,
  descender: -288,
  glyphData,
} as const;

export default sealFont;
