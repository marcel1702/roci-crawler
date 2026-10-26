import Phaser from 'phaser';
import { GAME_EVENTS, MAX_FRAME_SECONDS, SCENE_KEYS, TEXTURE_KEYS, TEXTURE_RES, TEXTURE_SCALE, TILE_SIZE } from '../config/constants';
import type { TileGrid } from '../core/grid';
import { parseLevel } from '../core/level';
import type { ParsedLevel } from '../core/level';
import { createRng } from '../core/rng';
import type { Rng } from '../core/rng';
import { CLASSES } from '../data/classes';
import { ENEMIES } from '../data/enemies';
import { TEST_ARENA } from '../data/levels/testArena';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import type { WorldContext } from '../entities/WorldContext';
import { CombatSystem } from '../systems/CombatSystem';
import { ResponsiveCamera } from '../systems/ResponsiveCamera';
import { separateActors } from '../systems/SeparationSystem';
import { TapControlSystem } from '../systems/TapControlSystem';
import type { HudScene } from './HudScene';

const NEXT_WAVE_DELAY_MS = 3000;

/**
 * Spielwelt einer Mission. Meilenstein 1: feste Testarena mit Gegnerwellen.
 * Später liefert ein Dungeon-Generator das Level, der Rest der Szene bleibt gleich.
 */
export class MissionScene extends Phaser.Scene implements WorldContext {
  grid!: TileGrid;
  rng!: Rng;
  combat!: CombatSystem;
  player!: Player;
  enemies: Enemy[] = [];

  private level!: ParsedLevel;
  private waveScheduled = false;
  private deathAnnounced = false;

  constructor() {
    super(SCENE_KEYS.mission);
  }

  create(): void {
    this.enemies = [];
    this.waveScheduled = false;
    this.deathAnnounced = false;

    this.level = parseLevel(TEST_ARENA, TILE_SIZE);
    this.grid = this.level.grid;
    this.rng = createRng(Date.now());
    this.combat = new CombatSystem(this, this.rng);

    this.createTilemap();
    const start = this.level.playerStart;
    this.player = new Player(this, this, start.x, start.y, CLASSES.amos);
    this.spawnWave();

    new ResponsiveCamera(this, this.grid, this.player);
    new TapControlSystem(
      this,
      this.player,
      () => this.enemies,
      (x, y) => (this.scene.get(SCENE_KEYS.hud) as HudScene).isOverUi(x, y),
    );

    this.game.events.on(GAME_EVENTS.restartRequested, this.restart, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(GAME_EVENTS.restartRequested, this.restart, this);
    });
    this.game.events.emit(GAME_EVENTS.missionReady, this.player);
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, MAX_FRAME_SECONDS);

    this.player.tick(dt);
    for (const enemy of this.enemies) enemy.tick(dt, this.player);
    separateActors(this.player, this.enemies);
    this.enemies = this.enemies.filter((enemy) => !enemy.isDead);

    if (this.player.isDead) {
      if (!this.deathAnnounced) {
        this.deathAnnounced = true;
        this.game.events.emit(GAME_EVENTS.playerDied);
      }
    } else if (this.enemies.length === 0 && !this.waveScheduled) {
      this.waveScheduled = true;
      this.game.events.emit(GAME_EVENTS.waveCleared);
      this.time.delayedCall(NEXT_WAVE_DELAY_MS, () => {
        this.spawnWave();
        this.waveScheduled = false;
      });
    }
  }

  private restart(): void {
    this.scene.restart();
  }

  private spawnWave(): void {
    for (const spawn of this.level.enemySpawns) {
      this.enemies.push(new Enemy(this, this, spawn.x, spawn.y, ENEMIES.thug));
    }
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
