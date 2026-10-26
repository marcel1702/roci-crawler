import Phaser from 'phaser';
import {
  GAME_EVENTS,
  MAX_FRAME_SECONDS,
  MISSION_EVENTS,
  REGISTRY_PROGRESSION,
  SCENE_KEYS,
  TEXTURE_KEYS,
  TEXTURE_RES,
  TEXTURE_SCALE,
  TILE_SIZE,
} from '../config/constants';
import { COLORS } from '../config/palette';
import type { TileGrid } from '../core/grid';
import { parseLevel } from '../core/level';
import type { ParsedLevel } from '../core/level';
import { Progression } from '../core/progression';
import { createRng } from '../core/rng';
import type { Rng } from '../core/rng';
import { CLASSES } from '../data/classes';
import { ENEMIES } from '../data/enemies';
import type { EnemyId } from '../data/enemies';
import { TEST_ARENA, TEST_ARENA_WAVES } from '../data/levels/testArena';
import type { Actor, Team } from '../entities/Actor';
import { Enemy } from '../entities/Enemy';
import type { Difficulty } from '../entities/Enemy';
import { Player } from '../entities/Player';
import type { WorldContext } from '../entities/WorldContext';
import { t } from '../i18n';
import { CombatSystem } from '../systems/CombatSystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { ResponsiveCamera } from '../systems/ResponsiveCamera';
import { separateActors } from '../systems/SeparationSystem';
import { TapControlSystem } from '../systems/TapControlSystem';
import type { HudScene } from './HudScene';

const NEXT_WAVE_DELAY_MS = 3000;
/** Neue Gegner erscheinen nicht näher als so viele Pixel am Spieler. */
const MIN_SPAWN_DISTANCE = 170;

/**
 * Spielwelt einer Mission. Bisher: feste Testarena mit Gegnerwellen.
 * Später liefert ein Dungeon-Generator das Level, der Rest der Szene bleibt gleich.
 */
export class MissionScene extends Phaser.Scene implements WorldContext {
  grid!: TileGrid;
  rng!: Rng;
  combat!: CombatSystem;
  projectiles!: ProjectileSystem;
  player!: Player;
  enemies: Enemy[] = [];
  waveNumber = 0;

  private level!: ParsedLevel;
  private waveScheduled = false;
  private deathAnnounced = false;

  constructor() {
    super(SCENE_KEYS.mission);
  }

  create(): void {
    this.enemies = [];
    this.waveNumber = 0;
    this.waveScheduled = false;
    this.deathAnnounced = false;

    this.level = parseLevel(TEST_ARENA, TILE_SIZE);
    this.grid = this.level.grid;
    this.rng = createRng(Date.now());
    this.combat = new CombatSystem(this, this.rng);
    this.projectiles = new ProjectileSystem(this, this, (team) => this.actorsOf(team));

    this.createTilemap();
    const start = this.level.playerStart;
    this.player = new Player(this, this, start.x, start.y, CLASSES.amos, this.progression());
    this.startWave();

    new ResponsiveCamera(this, this.grid, this.player);
    new TapControlSystem(
      this,
      this.player,
      () => this.enemies,
      (x, y) => (this.scene.get(SCENE_KEYS.hud) as HudScene).isOverUi(x, y),
    );

    this.events.on(MISSION_EVENTS.actorKilled, this.onActorKilled, this);
    this.game.events.on(GAME_EVENTS.restartRequested, this.restart, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(MISSION_EVENTS.actorKilled, this.onActorKilled, this);
      this.game.events.off(GAME_EVENTS.restartRequested, this.restart, this);
    });
    this.game.events.emit(GAME_EVENTS.missionReady, this.player);
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, MAX_FRAME_SECONDS);

    this.player.tick(dt);
    for (const enemy of this.enemies) enemy.tick(dt, this.player);
    this.projectiles.update(dt);
    separateActors(this.player, this.enemies);
    this.enemies = this.enemies.filter((enemy) => !enemy.isDead);

    if (this.player.isDead) {
      if (!this.deathAnnounced) {
        this.deathAnnounced = true;
        this.game.events.emit(GAME_EVENTS.playerDied);
      }
    } else if (this.enemies.length === 0 && !this.waveScheduled) {
      this.waveScheduled = true;
      this.game.events.emit(GAME_EVENTS.waveCleared, this.waveNumber);
      this.time.delayedCall(NEXT_WAVE_DELAY_MS, () => {
        if (this.player.isDead) return;
        this.startWave();
        this.waveScheduled = false;
      });
    }
  }

  spawnEnemy(id: EnemyId, x: number, y: number, difficulty?: Difficulty): Enemy {
    const enemy = new Enemy(this, this, x, y, ENEMIES[id], difficulty);
    this.enemies.push(enemy);
    return enemy;
  }

  private actorsOf(team: Team): readonly Actor[] {
    return team === 'player' ? [this.player] : this.enemies;
  }

  /** Erfahrung und Stufe bleiben über Neustarts erhalten; später kommen sie aus dem Spielstand. */
  private progression(): Progression {
    let progression = this.registry.get(REGISTRY_PROGRESSION) as Progression | undefined;
    if (!progression) {
      progression = new Progression();
      this.registry.set(REGISTRY_PROGRESSION, progression);
    }
    return progression;
  }

  private onActorKilled(victim: Actor): void {
    if (!(victim instanceof Enemy) || this.player.isDead) return;
    this.player.gainXp(victim.def.xp);
    this.combat.floatText(victim.x, victim.y - victim.radius - 18, t('hud.xp', { amount: victim.def.xp }), COLORS.xpText, 12);
  }

  private restart(): void {
    this.scene.restart();
  }

  /** Nächste Welle der Testarena; nach der letzten beginnt die Folge von vorn mit härteren Gegnern. */
  private startWave(): void {
    this.waveNumber++;
    const index = this.waveNumber - 1;
    const composition = TEST_ARENA_WAVES[index % TEST_ARENA_WAVES.length] ?? [];
    const loop = Math.floor(index / TEST_ARENA_WAVES.length);
    const difficulty = { hp: 1 + 0.25 * loop, damage: 1 + 0.12 * loop };

    const far = this.level.enemySpawns.filter(
      (spawn) => Phaser.Math.Distance.Between(spawn.x, spawn.y, this.player.x, this.player.y) >= MIN_SPAWN_DISTANCE,
    );
    const spawns = this.rng.shuffle(far.length > 0 ? far : this.level.enemySpawns);

    composition.forEach((id, i) => {
      const spawn = spawns[i % spawns.length];
      if (!spawn) return;
      // Gibt es mehr Gegner als Spawnpunkte, werden sie leicht versetzt, damit sie nicht aufeinander stehen.
      const offset = i >= spawns.length ? { x: this.rng.int(-14, 14), y: this.rng.int(-14, 14) } : { x: 0, y: 0 };
      this.spawnEnemy(id, spawn.x + offset.x, spawn.y + offset.y, difficulty);
    });
    this.game.events.emit(GAME_EVENTS.waveStarted, this.waveNumber);
  }

  private createTilemap(): void {
    const tileSizeInTexture = TILE_SIZE * TEXTURE_RES;
    const map = this.make.tilemap({
      data: this.grid.toRowsOfIds(),
      tileWidth: tileSizeInTexture,
      tileHeight: tileSizeInTexture,
    });
    const tileset = map.addTilesetImage('tiles', TEXTURE_KEYS.tiles);
    if (!tileset) throw new Error('Tileset konnte nicht erzeugt werden');
    const layer = map.createLayer(0, tileset, 0, 0);
    if (!layer) throw new Error('Tilemap-Ebene konnte nicht erzeugt werden');
    layer.setScale(TEXTURE_SCALE).setDepth(0);
  }
}
