import AxiomColor, { COLOR, PALETTE } from "@axiom/color";

const MINE = PALETTE.MINE;

export const UI_THEME = {
  colors: {
    panel: AxiomColor.withAlpha(MINE.CONCRETE, 245),
    frame: MINE.SOOT,
    row: MINE.SLAB,
    rowHover: MINE.GRANITE,
    pressed: MINE.COAL,
    selected: MINE.BANNER,
    accent: MINE.BANNER,
    closeButton: MINE.BANNER_DARK,
    title: MINE.BONE,
    text: MINE.BONE,
    muted: MINE.ASH,
    lacking: MINE.ALARM,
    scrollTrack: MINE.COAL,
    scrollThumb: MINE.OAK,
    scrollThumbHover: MINE.PINE,
    sliderTrack: MINE.COAL,
    sliderThumb: MINE.BRASS,
    sliderThumbHover: MINE.GOLD,
    sliderTrackFocus: MINE.WALNUT,
    barTrack: MINE.COAL,
    barFill: MINE.BRASS,
    textOutline: MINE.SOOT,
    toggleOn: MINE.BRASS,
    toggleOff: MINE.COAL,
    badge: MINE.EMBER,
    slotEmpty: MINE.COAL,
    slotFrame: MINE.BRASS,
    inputBack: MINE.COAL,
    inputFocus: MINE.EBONY,
    placeholder: MINE.GRANITE,
    caret: MINE.BRASS,
    gain: MINE.GOLD,
    transparent: COLOR.TRANSPARENT,
    dim: AxiomColor.withAlpha(COLOR.BLACK, 140),
    beer: MINE.GOLD,
    beerBack: MINE.EBONY,
  },
  card: {
    plateText: MINE.SOOT,
    plateMuted: MINE.EBONY,
    text: MINE.BONE,
    muted: MINE.ASH,
    label: MINE.BRASS,
    disabled: MINE.GRANITE,
    status: {
      sleeping: MINE.ASH,
      waiting: MINE.LAMPLIGHT,
      active: MINE.PINE,
      killed: MINE.RUST,
    },
    textSize: { name: 24, type: 15, status: 15, body: 14, label: 12, button: 14, close: 18 },
  },
  font: {
    body: "lato",
    display: "bebas",
  },
  text: {
    title: 28,
    header: 22,
    button: 18,
    bigButton: 28,
    body: 14,
  },
  radius: {
    button: 0,
    scroll: 0,
  },
  // frame drawn inside the box; depth: how far the hard shadow is cast down and right
  panel: {
    window: { frame: 1, rounded: 0, depth: 5, padding: { top: 12, right: 12, bottom: 12, left: 12 } },
    hud: { frame: 1, rounded: 0, depth: 4, padding: { top: 6, right: 10, bottom: 6, left: 10 } },
    small: { frame: 1, rounded: 0, depth: 3, padding: { top: 4, right: 8, bottom: 4, left: 8 } },
    shadowColor: AxiomColor.withAlpha(COLOR.BLACK, 230),
    // the red stripe on the bar's left edge is an inset shadow pushed in by its width
    titleBar: { color: MINE.SOOT, stripe: MINE.BANNER, stripeWidth: 10, padding: { top: 6, right: 6, bottom: 6, left: 22 } },
  },
  block: {
    edge: 3,
  },
  backdrop: {
    blur: 2,
  },
  spacing: {
    screenMargin: 16,
    windowGap: 10,
    gap: 6,
    listGap: 4,
    buttonPadding: { top: 6, right: 10, bottom: 6, left: 10 },
    bigButtonPadding: { top: 14, right: 32, bottom: 14, left: 32 },
    rowPadding: { top: 4, right: 6, bottom: 4, left: 4 },
  },
  scroll: {
    width: 6,
    auto: { deadzone: 8, speed: 6 },
  },
  icon: {
    image: "icons",
    size: 32,
  },
  cost: {
    icon: 20,
    gap: 10,
    innerGap: 3,
  },
  bar: {
    height: 14,
    textSize: 12,
    textOutline: 2,
  },
  header: {
    gap: 3,
    line: 2,
  },
  divider: {
    line: 14,
  },
  hamburger: {
    width: 14,
    bar: 2,
    gap: 3,
  },
  toggle: {
    box: 12,
  },
  badge: {
    size: 16,
    offset: 6,
    max: 99,
    textSize: 11,
    padding: { top: 0, right: 4, bottom: 0, left: 4 },
  },
  grid: {
    columns: 3,
  },
  paragraph: {
    lineGap: 2,
  },
  input: {
    height: 30,
    padding: { top: 6, right: 8, bottom: 6, left: 8 },
  },
  world: {
    zIndex: -100,
    cullMargin: 64,
  },
  counter: {
    iconSize: 24,
    popSeconds: 1.2,
    popTop: 14,
    popRise: 16,
  },
  collapsible: {
    open: "-",
    closed: "+",
    padding: { top: 2, right: 4, bottom: 2, left: 4 },
  },
  dropdown: {
    arrow: "v",
  },
  confirm: {
    width: 320,
  },
  menu: {
    offset: 4,
    gap: 2,
    zIndex: 105,
    padding: { top: 4, right: 4, bottom: 4, left: 4 },
  },
  message: {
    seconds: 3,
    hold: 0.6,
  },
  buildMenu: {
    top: 64,
    panelGap: 54,
    button: 36,
    bars: { width: 18, height: 2, gap: 4 },
    slideMs: 200,
  },
  slot: {
    size: 56,
    iconSize: 36,
    frame: 2,
  },
  tooltip: {
    delaySeconds: 0.4,
    maxWidth: 260,
    offset: 14,
    zIndex: 110,
  },
  toast: {
    seconds: 2.2,
    fadeSeconds: 0.5,
    top: 80,
    max: 5,
    zIndex: 100,
    padding: { top: 8, right: 16, bottom: 8, left: 16 },
    kinds: {
      error: { frame: MINE.RUST, text: MINE.RUST },
      info: { frame: MINE.IRON, text: MINE.BONE },
      success: { frame: MINE.GOLD, text: MINE.GOLD },
    },
  },
  slider: {
    height: 14,
    thumb: 12,
  },
  motion: {
    popInMs: 200,
    hoverMs: 90,
  },
  // a window of something on the map closes once the camera goes this many pixels away
  worldWindow: { closeDistance: 600 },
};
