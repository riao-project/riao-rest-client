import { describe, it, expect, beforeAll } from 'vitest';
import { sharedClient } from '../client';
import { maindb } from '../../../database/main';

describe('RiaoRestClient Integration - Search', () => {
	let createdProductId: string;

	beforeAll(async () => {
		({ id: createdProductId } = await maindb.query.insertOne({
			table: 'products',
			record: { name: 'Search Test Product' },
		}));
	});

	it('should search products', async () => {
		const searchResult = await sharedClient.search({
			where: [{ column: 'name', operator: '=', value: 'Search Test Product' }],
		});

		expect(searchResult).toBeDefined();
		expect(Array.isArray(searchResult.records)).toBe(true);
		expect(searchResult.records.length).toBeGreaterThan(0);
		expect(searchResult.records[0].id).toEqual(createdProductId);
		expect(searchResult.records[0].name).toBe('Search Test Product');
	});
});
