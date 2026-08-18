import Vec2 from "@/core/axiom/vec2";
import PragmaComponent from "@/core/pragma/component";
import SpatialGrid from "@/core/axiom/SpatialGrid";
import Physics from "@/sandbox/components/physics";
import Time from "@/core/engine/time";
import Stats from "@/sandbox/components/stats";
import Transform from "@/sandbox/components/transform";
import Chunk from "@/sandbox/bActors/chunk";
import MapObject from "@/sandbox/managers/mapObject";
import Grid from "@/core/axiom/grid";
export interface BallChangedChunkEvent {
  ID: Symbol;
  lastChunk?: number;
  newChunk: number | null;
}
const MAX_BOUNCES_PER_TICK = 4;
const SKIN = 0.01;
const DECAY_RATE = 1;

export default class PhysBallComponent extends PragmaComponent {
  private grid = new SpatialGrid<Physics>({ width: 256, height: 256 });
  private movingBodies = new Set<Physics>(); // type "kinetic" | "rigid"
  private triggeredThisFrame = new Map<Symbol, Set<Symbol>>();
  private ballChunkTracking: Map<Symbol, number> = new Map();
  constructor(internal: InternalPCProps) {
    super(internal);
  }
  awake(): void {
    this.onSceneEvent<{ physics: Physics }>("physRegister", ({ physics }) =>
      this.register(physics),
    );
    this.onSceneEvent<{ physics: Physics }>("physUnregister", ({ physics }) =>
      this.unregister(physics),
    );
  }

  private register(physics: Physics) {
    if (physics.body) {
      this.grid.insert({
        id: physics.actor.ID,
        bounds: physics.getBounds(),
        data: physics,
      });
    }
    if (physics.type !== "static") this.movingBodies.add(physics);
  }

  private unregister(physics: Physics) {
    this.grid.remove(physics.actor.ID);
    this.movingBodies.delete(physics);
    this.ballChunkTracking.delete(physics.actor.ID);
  }

  preUpdate(): void {
    this.triggeredThisFrame.clear();
  }

  preFixedUpdate(): void {
    //updating initial speed of dwarfs
    const dt = Time.getFixedDeltaTime();
    for (const physics of this.movingBodies) {
      if (physics.type !== "rigid") continue;
      const speed = physics.velocity.length();
      if (speed === 0) continue;
      const newSpeed =
        speed + (physics.baseSpeed - speed) * Math.min(DECAY_RATE * dt, 1);
      physics.velocity.normalize().scale(newSpeed);
    }
  }

  fixedUpdate(): void {
    const dt = Time.getFixedDeltaTime();

    //kinetic - need to be first
    for (const physics of this.movingBodies) {
      if (physics.type !== "kinetic") continue;
      const transform = physics.actor.getComponent(Transform)!;
      transform.translate(physics.velocity.x * dt, physics.velocity.y * dt);
      if (physics.body) this.grid.move(physics.actor.ID, physics.getBounds());
    }
    //rigid
    for (const physics of this.movingBodies) {
      if (physics.type !== "rigid") continue;
      this.stepRigid(physics, dt);
    }
  }

  private stepRigid(physics: Physics, dt: number) {
    if (physics.velocity.isZero()) return; // can be?
    const transform = physics.actor.transform;
    let remaining = physics.velocity.length() * dt;
    let direction = physics.velocity.clone().normalize();
    let bounces = 0;

    while (remaining > 0 && bounces < MAX_BOUNCES_PER_TICK) {
      const origin = transform.getPosition().value;
      const hit = this.findClosestHit(physics, origin, direction, remaining);

      if (!hit) {
        transform.translate(direction.x * remaining, direction.y * remaining);
        break;
      }

      const traveled = Math.max(hit.distance - SKIN, 0);
      transform.translate(direction.x * traveled, direction.y * traveled);
      remaining -= traveled;

      if (hit.physics.isTrigger) {
        this.handleTrigger(physics, hit.physics);
        continue;
      }

      const hitForce = this.resolveSolidHit(physics, hit.physics);
      if (hitForce !== "penetrate") {
        physics.velocity.reflect(hit.normal);
        direction = physics.velocity.clone().normalize();
        bounces++;
      }
    }

    if (physics.body) this.grid.move(physics.actor.ID, physics.getBounds());
    this.checkChunkChange(physics);
  }

  private isSameFaction(a: Physics, b: Physics): boolean {
    return (
      (a.actor.tags.has("friendly") && b.actor.tags.has("friendly")) ||
      (a.actor.tags.has("enemy") && b.actor.tags.has("enemy"))
    );
  }

  private findClosestHit(
    self: Physics,
    origin: Position2D,
    direction: Vec2,
    maxDistance: number,
  ) {
    const end = {
      x: origin.x + direction.x * maxDistance,
      y: origin.y + direction.y * maxDistance,
    };
    const selfRadius = self.body?.type === "circle" ? self.body.radius : 0;
    const queryBounds: BoxAABB = {
      min: {
        x: Math.min(origin.x, end.x) - selfRadius,
        y: Math.min(origin.y, end.y) - selfRadius,
      },
      max: {
        x: Math.max(origin.x, end.x) + selfRadius,
        y: Math.max(origin.y, end.y) + selfRadius,
      },
    };

    let closest: { physics: Physics; distance: number; normal: Vec2 } | null =
      null;
    for (const candidate of this.grid.query(queryBounds)) {
      if (candidate === self) continue;
      if (!candidate.isTrigger && this.isSameFaction(self, candidate)) continue;
      const hit = candidate.raycastAgainst({ origin, direction }, selfRadius);
      if (!hit.hit || hit.distance > maxDistance) continue;
      if (!closest || hit.distance < closest.distance) {
        closest = {
          physics: candidate,
          distance: hit.distance,
          normal: hit.normal,
        };
      }
    }
    return closest;
  }

  private handleTrigger(self: Physics, trigger: Physics) {
    const selfId = self.actor.ID;
    const triggerId = trigger.actor.ID;
    let seen = this.triggeredThisFrame.get(selfId);
    if (!seen) {
      seen = new Set();
      this.triggeredThisFrame.set(selfId, seen);
    }
    if (seen.has(triggerId)) return;
    seen.add(triggerId);
    self.emitActorEvent("triggerHit", { other: trigger.actor });
  }

  private resolveSolidHit(
    ball: Physics,
    block: Physics,
  ): "penetrate" | "bounce" {
    const ballStats = ball.getSibling(Stats);
    const blockStats = block.getSibling(Stats);

    //TODO: to nie zadziała jak dodam wiecej obiektow i rodzajow
    if (ballStats?.data.kind !== "dwarf" || blockStats?.data.kind !== "deposit")
      return "bounce";
    const currentSpeed = ball.velocity.length();
    const penetrationPower =
      ballStats.data.baseDmg * (currentSpeed / ballStats.data.baseSpeed);
    const ratio = penetrationPower / blockStats.data.strength;

    if (ratio >= 1.5) {
      this.destroyBlock(block);
      return "penetrate";
    }
    if (ratio >= 1) {
      this.destroyBlock(block);
      return "bounce";
    }
    if (ratio >= 0.5) {
      const dmgPercent = (ratio - 0.5) / 0.5;
      blockStats.data.currentHP -= dmgPercent * blockStats.data.maxHP;
      if (blockStats.data.currentHP <= 0) this.destroyBlock(block);
    }
    return "bounce";
  }

  private destroyBlock(block: Physics) {
    this.grid.remove(block.actor.ID);
    // block.emitActorEvent("destroy", {}); // emituj event by odpalic animacje i usunac blok
    block.scene.deleteActor(block.actor);
    const chunkTransform = block.actor.transform.getParent();
    if (!chunkTransform) return;
    const chunk = chunkTransform.actor as Chunk;
    if (chunk.transform.getChildren().size === 1) {
      //TODO: to nie zadziala jak bedziesz mial jeden samotny bedrcokowy block na chunku xD ale po cos bys tak mial miec? no ale wiedz ze to go usunie!
      this.emitSceneEvent<number>("chunkEmpty", chunk.index);
    }
  }

  private checkChunkChange(physics: Physics) {
    const { chunkInPixels, mapInChunks } = MapObject.mapMeta;
    const pos = physics.actor.transform.getWorldPosition();
    const chunkPos = Grid.worldToTile(pos, chunkInPixels);
    const ballID = physics.actor.ID;
    const inBounds =
      chunkPos.x >= 0 &&
      chunkPos.y >= 0 &&
      chunkPos.x < mapInChunks.width &&
      chunkPos.y < mapInChunks.height;
    const newChunkIndex = inBounds
      ? Grid.tileToIndex(chunkPos, mapInChunks.width)
      : null;
    const lastChunk = this.ballChunkTracking.get(ballID);
    if (lastChunk === newChunkIndex) return;

    if (newChunkIndex === null) this.ballChunkTracking.delete(ballID);
    else this.ballChunkTracking.set(ballID, newChunkIndex);
    this.emitSceneEvent<BallChangedChunkEvent>("ballChangedChunk", {
      ID: ballID,
      lastChunk: lastChunk,
      newChunk: newChunkIndex,
    });
  }
}
