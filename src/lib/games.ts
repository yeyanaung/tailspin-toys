import { eq, asc, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game } from '../types/game';

/** Optional category and publisher names used to narrow the game list. */
export interface GameFilters {
    categories?: string[];
    publishers?: string[];
}

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

type WhereableQuery<T> = T & {
    where: (condition: unknown) => T;
};

function applyFilters<T>(query: T, filters?: GameFilters): T {
    const categoryNames = filters?.categories?.filter(Boolean) ?? [];
    const publisherNames = filters?.publishers?.filter(Boolean) ?? [];

    let filteredQuery = query as WhereableQuery<T>;
    if (categoryNames.length > 0) {
        filteredQuery = filteredQuery.where(inArray(categories.name, categoryNames)) as WhereableQuery<T>;
    }
    if (publisherNames.length > 0) {
        filteredQuery = filteredQuery.where(inArray(publishers.name, publisherNames)) as WhereableQuery<T>;
    }
    return filteredQuery;
}

function dbSelectGames(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

function baseGamesQuery(db: Database, filters?: GameFilters) {
    return applyFilters(dbSelectGames(db), filters);
}

/** All games ordered by title, optionally narrowed to selected category and publisher names. */
export async function getAllGames(db: Database, filters?: GameFilters): Promise<Game[]> {
    const rows = await baseGamesQuery(db, filters).orderBy(asc(games.title));
    return rows.map(mapGame);
}

/** Return every category name and id in alphabetical order for filter controls. */
export async function getAllCategories(db: Database): Promise<Array<{ id: number; name: string }>> {
    const rows = await db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name));
    return rows;
}

/** Return every publisher name and id in alphabetical order for filter controls. */
export async function getAllPublishers(db: Database): Promise<Array<{ id: number; name: string }>> {
    const rows = await db.select({ id: publishers.id, name: publishers.name }).from(publishers).orderBy(asc(publishers.name));
    return rows;
}

/** All game ids ordered by title. */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
