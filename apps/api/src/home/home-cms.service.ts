import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  HOME_CATALOG_ROW_PRESETS,
  HomeRowKind,
  type AdminHomeHero,
  type AdminHomeRow,
  type HomeRowKind as HomeRowKindType,
} from '@movie-server/shared';
import { RedisService } from '../redis/redis.service';
import { HOME_LAYOUT_KEY } from '../common/cache-keys';
import { HomeHero, HomeHeroDocument } from './schemas/home-hero.schema';
import { HomeRowConfig, HomeRowConfigDocument } from './schemas/home-row-config.schema';

@Injectable()
export class HomeCmsService {
  constructor(
    @InjectModel(HomeHero.name) private readonly heroes: Model<HomeHeroDocument>,
    @InjectModel(HomeRowConfig.name) private readonly rows: Model<HomeRowConfigDocument>,
    private readonly redis: RedisService,
  ) {}

  async layoutVersion(): Promise<string> {
    return (await this.redis.client.get(HOME_LAYOUT_KEY)) ?? '0';
  }

  async findHero(): Promise<HomeHeroDocument | null> {
    return this.heroes.findOne({ key: 'default' });
  }

  async getHero(): Promise<HomeHeroDocument> {
    const existing = await this.heroes.findOne({ key: 'default' });
    if (existing) return existing;
    return this.heroes.create({
      key: 'default',
      enabled: false,
      mediaKind: null,
      mediaId: null,
      itemIds: [],
    });
  }

  async updateHero(input: {
    enabled?: boolean;
    mediaKind?: 'movie' | 'series' | null;
    mediaId?: string | null;
    titleOverride?: string | null;
    itemIds?: string[];
  }): Promise<HomeHeroDocument> {
    const hero = await this.getHero();
    if (input.enabled !== undefined) hero.enabled = input.enabled;
    if (input.mediaKind !== undefined) hero.mediaKind = input.mediaKind;
    if (input.mediaId !== undefined) hero.mediaId = input.mediaId;
    if (input.titleOverride !== undefined) hero.titleOverride = input.titleOverride;
    if (input.itemIds !== undefined) {
      const ids = [...new Set(input.itemIds.map((id) => id.trim()).filter(Boolean))].slice(0, 6);
      hero.itemIds = ids;
      // Keep legacy single-hero fields in sync with the first slider slot.
      hero.mediaId = ids[0] ?? null;
      if (ids.length > 0) {
        hero.mediaKind = hero.mediaKind ?? 'movie';
        hero.enabled = input.enabled ?? true;
      }
    }
    await hero.save();
    await this.bump();
    return hero;
  }

  async listRows(): Promise<HomeRowConfigDocument[]> {
    return this.rows.find().sort({ sortOrder: 1, createdAt: 1 }).exec();
  }

  async listEnabledRows(): Promise<HomeRowConfigDocument[]> {
    return this.rows.find({ enabled: true }).sort({ sortOrder: 1, createdAt: 1 }).exec();
  }

  async createRow(input: {
    title: string;
    kind: HomeRowKindType;
    enabled?: boolean;
    sortOrder?: number;
    genre?: string | null;
    collectionId?: string | null;
    libraryId?: string | null;
    itemIds?: string[];
  }): Promise<HomeRowConfigDocument> {
    const created = await this.rows.create({
      title: input.title.trim().slice(0, 80),
      kind: input.kind,
      enabled: input.enabled ?? true,
      sortOrder: input.sortOrder ?? 0,
      genre: input.genre ?? null,
      collectionId: input.collectionId ?? null,
      libraryId: input.libraryId ?? null,
      itemIds: (input.itemIds ?? []).slice(0, 40),
    });
    await this.bump();
    return created;
  }

  async updateRow(
    id: string,
    input: Partial<{
      title: string;
      kind: HomeRowKindType;
      enabled: boolean;
      sortOrder: number;
      genre: string | null;
      collectionId: string | null;
      libraryId: string | null;
      itemIds: string[];
    }>,
  ): Promise<HomeRowConfigDocument | null> {
    const row = await this.rows.findById(id);
    if (!row) return null;
    if (input.title !== undefined) row.title = input.title.trim().slice(0, 80);
    if (input.kind !== undefined) row.kind = input.kind;
    if (input.enabled !== undefined) row.enabled = input.enabled;
    if (input.sortOrder !== undefined) row.sortOrder = input.sortOrder;
    if (input.genre !== undefined) row.genre = input.genre;
    if (input.collectionId !== undefined) row.collectionId = input.collectionId;
    if (input.libraryId !== undefined) row.libraryId = input.libraryId;
    if (input.itemIds !== undefined) row.itemIds = input.itemIds.slice(0, 40);
    await row.save();
    await this.bump();
    return row;
  }

  async removeRow(id: string): Promise<boolean> {
    const result = await this.rows.findByIdAndDelete(id);
    if (result) await this.bump();
    return Boolean(result);
  }

  async reorderRows(ids: string[]): Promise<HomeRowConfigDocument[]> {
    const unique = [...new Set(ids)];
    const existing = await this.rows.find({ _id: { $in: unique } }).exec();
    if (existing.length !== unique.length) {
      return this.listRows();
    }
    await Promise.all(
      unique.map((id, index) => this.rows.updateOne({ _id: id }, { $set: { sortOrder: index } })),
    );
    await this.bump();
    return this.listRows();
  }

  async seedCatalogRows(): Promise<HomeRowConfigDocument[]> {
    const existing = await this.listRows();
    const usedKinds = new Set(existing.map((row) => row.kind));
    let order = existing.length;
    for (const preset of HOME_CATALOG_ROW_PRESETS) {
      if (usedKinds.has(preset.kind)) continue;
      await this.rows.create({
        title: preset.defaultTitle,
        kind: preset.kind,
        enabled: true,
        sortOrder: order,
        genre: null,
        collectionId: null,
        libraryId: null,
        itemIds: [],
      });
      order += 1;
    }
    await this.bump();
    return this.listRows();
  }

  async seedLibraryRows(
    libraries: Array<{ id: string; name: string; enabled: boolean }>,
  ): Promise<HomeRowConfigDocument[]> {
    const existing = await this.listRows();
    const usedLibraryIds = new Set(
      existing
        .filter((row) => row.kind === HomeRowKind.Library && row.libraryId)
        .map((row) => String(row.libraryId)),
    );
    let order = existing.length;
    for (const library of libraries) {
      if (!library.enabled || usedLibraryIds.has(library.id)) continue;
      await this.rows.create({
        title: library.name,
        kind: HomeRowKind.Library,
        enabled: true,
        sortOrder: order,
        genre: null,
        collectionId: null,
        libraryId: library.id,
        itemIds: [],
      });
      order += 1;
    }
    await this.bump();
    return this.listRows();
  }

  toPublicHero(hero: HomeHeroDocument): AdminHomeHero {
    const itemIds =
      hero.itemIds?.length > 0
        ? hero.itemIds
        : hero.mediaId
          ? [hero.mediaId]
          : [];
    return {
      id: String(hero._id),
      enabled: hero.enabled,
      mediaKind: hero.mediaKind ?? null,
      mediaId: hero.mediaId ?? itemIds[0] ?? null,
      titleOverride: hero.titleOverride ?? null,
      itemIds,
      updatedAt: hero.updatedAt.toISOString(),
    };
  }

  toPublicRow(row: HomeRowConfigDocument): AdminHomeRow {
    return {
      id: String(row._id),
      title: row.title,
      kind: row.kind,
      enabled: row.enabled,
      sortOrder: row.sortOrder,
      genre: row.genre ?? null,
      collectionId: row.collectionId ?? null,
      libraryId: row.libraryId ?? null,
      itemIds: row.itemIds ?? [],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async bump(): Promise<void> {
    await this.redis.client.incr(HOME_LAYOUT_KEY);
  }
}
