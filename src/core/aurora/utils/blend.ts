export const Blend = {
  replace: {
    color: { srcFactor: "one", dstFactor: "zero", operation: "add" },
    alpha: { srcFactor: "one", dstFactor: "zero", operation: "add" },
  },

  alpha: {
    color: {
      srcFactor: "src-alpha",
      dstFactor: "one-minus-src-alpha",
      operation: "add",
    },
    alpha: {
      srcFactor: "one",
      dstFactor: "one-minus-src-alpha",
      operation: "add",
    },
  },

  premultiplied: {
    color: {
      srcFactor: "one",
      dstFactor: "one-minus-src-alpha",
      operation: "add",
    },
    alpha: {
      srcFactor: "one",
      dstFactor: "one-minus-src-alpha",
      operation: "add",
    },
  },

  behind: {
    color: {
      srcFactor: "one-minus-dst-alpha",
      dstFactor: "one",
      operation: "add",
    },
    alpha: {
      srcFactor: "one-minus-dst-alpha",
      dstFactor: "one",
      operation: "add",
    },
  },

  additive: {
    color: { srcFactor: "src-alpha", dstFactor: "one", operation: "add" },
    alpha: { srcFactor: "zero", dstFactor: "one", operation: "add" },
  },

  additivePremultiplied: {
    color: { srcFactor: "one", dstFactor: "one", operation: "add" },
    alpha: { srcFactor: "zero", dstFactor: "one", operation: "add" },
  },

  // lerp(target, source, constant), the pass sets it with setBlendConstant
  lerpConstant: {
    color: {
      srcFactor: "constant",
      dstFactor: "one-minus-constant",
      operation: "add",
    },
    alpha: { srcFactor: "zero", dstFactor: "one", operation: "add" },
  },

  screen: {
    color: { srcFactor: "one", dstFactor: "one-minus-src", operation: "add" },
    alpha: {
      srcFactor: "one",
      dstFactor: "one-minus-src-alpha",
      operation: "add",
    },
  },

  lighten: {
    color: { srcFactor: "one", dstFactor: "one", operation: "max" },
    alpha: { srcFactor: "one", dstFactor: "one", operation: "max" },
  },

  multiply: {
    color: {
      srcFactor: "dst",
      dstFactor: "one-minus-src-alpha",
      operation: "add",
    },
    alpha: { srcFactor: "zero", dstFactor: "one", operation: "add" },
  },

  subtract: {
    color: {
      srcFactor: "src-alpha",
      dstFactor: "one",
      operation: "reverse-subtract",
    },
    alpha: { srcFactor: "zero", dstFactor: "one", operation: "add" },
  },

  darken: {
    color: { srcFactor: "one", dstFactor: "one", operation: "min" },
    alpha: { srcFactor: "one", dstFactor: "one", operation: "max" },
  },

  erase: {
    color: {
      srcFactor: "zero",
      dstFactor: "one-minus-src-alpha",
      operation: "add",
    },
    alpha: {
      srcFactor: "zero",
      dstFactor: "one-minus-src-alpha",
      operation: "add",
    },
  },

  mask: {
    color: { srcFactor: "zero", dstFactor: "src-alpha", operation: "add" },
    alpha: { srcFactor: "zero", dstFactor: "src-alpha", operation: "add" },
  },
} as const satisfies Record<string, GPUBlendState>;
