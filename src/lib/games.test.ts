import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllCategories,
    getAllGames,
    getAllGameIds,
    getAllPublishers,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

async function seedFilterFixture(db: Database): Promise<void> {
    const [strategy] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [puzzle] = await db
        .insert(categories)
        .values({ name: 'Puzzle', description: 'cat' })
        .returning({ id: categories.id });
    const [codeForge] = await db
        .insert(publishers)
        .values({ name: 'CodeForge Studios', description: 'pub' })
        .returning({ id: publishers.id });
    const [gitHubGames] = await db
        .insert(publishers)
        .values({ name: 'GitHub Games', description: 'pub' })
        .returning({ id: publishers.id });

    await db.insert(games).values([
        {
            title: 'Server Siege',
            description: 'Strategy and GitHub Games',
            starRating: 4.8,
            categoryId: strategy.id,
            publisherId: gitHubGames.id,
        },
        {
            title: 'Code Puzzle Chronicles',
            description: 'Puzzle and CodeForge Studios',
            starRating: 4.4,
            categoryId: puzzle.id,
            publisherId: codeForge.id,
        },
        {
            title: 'Repo Rulers',
            description: 'Strategy and CodeForge Studios',
            starRating: 4.5,
            categoryId: strategy.id,
            publisherId: codeForge.id,
        },
    ]);
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('filters games by one or more category and publisher names', async () => {
        await seedFilterFixture(db);

        const byCategory = await getAllGames(db, { categories: ['Strategy'] });
        expect(byCategory).toHaveLength(2);
        expect(byCategory.every((game) => game.category?.name === 'Strategy')).toBe(true);

        const combined = await getAllGames(db, {
            categories: ['Strategy'],
            publishers: ['GitHub Games'],
        });
        expect(combined).toHaveLength(1);
        expect(combined[0].title).toBe('Server Siege');
    });

    it('returns category and publisher options for filter controls', async () => {
        await seedFilterFixture(db);

        const categoryOptions = await getAllCategories(db);
        const publisherOptions = await getAllPublishers(db);

        expect(categoryOptions.map((category) => category.name)).toEqual(['Puzzle', 'Strategy']);
        expect(publisherOptions.map((publisher) => publisher.name)).toEqual([
            'CodeForge Studios',
            'GitHub Games',
        ]);
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});
