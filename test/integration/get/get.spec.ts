import { describe, it, expect, beforeAll } from 'vitest';
import { sharedClient } from '../client';
import { maindb } from '../../../database/main';

describe('RiaoRestClient Integration - Get', () => {
	let createdProductId: string;

	beforeAll(async () => {
		({ id: createdProductId } = await maindb.query.insertOne({
			table: 'products',
			record: { name: 'Integration Test Product' },
		}));
	});

	it('should get a product by id', async () => {
		const product = await sharedClient.get(createdProductId);

		expect(product).toBeDefined();
		expect(product.id).toBe(createdProductId);
		expect(product.name).toBe('Integration Test Product');
	});
});
