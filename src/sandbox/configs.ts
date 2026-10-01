// map tiles get their own slots: on an equal z the later drawn material wins the depth test
export const RENDER_ORDER = {
  bg: 0,
  decoBackTiles: 1,
  decoBack: 2,
  solidTiles: 3,
  main: 4,
  decoFrontTiles: 5,
  decoFront: 6,
  overlay: 7,
  debug: 8,
};

export const SAVES = {
  // until the options menu has it
  autosaveLimit: 3,
};
