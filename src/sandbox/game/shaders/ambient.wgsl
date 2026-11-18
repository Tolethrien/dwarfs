// ambientAt for Light.setAmbientMap, after globals.wgsl: the place's ambient (biome or the plain
// mine) instead of one for the whole screen, none where nothing is discovered yet; base is the
// engine's own ambient, white
fn ambientAt(world: vec2f, base: vec3f) -> vec3f {
  let place = mix(placeAmbient(world / map.tileSize), vec3f(1.0), map.fullLight);
  return base * place * fogShade(world);
}
