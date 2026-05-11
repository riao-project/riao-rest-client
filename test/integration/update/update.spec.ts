import { describe, it, expect, beforeAll } from 'vitest';
import { sharedClient } from '../client';
import { maindb } from '../../../database/main';

describe('RiaoRestClient Integration - Update', () => {
	let createdProductId: string;

	beforeAll(async () => {
		({ id: createdProductId } = await maindb.query.insertOne({
			table: 'products',
			record: { name: 'Update Test Product' },
		}));
	});

	it('should update a product', async () => {
		await sharedClient.update(createdProductId, {
			name: 'Updated Product Name',
		});

		const product = await sharedClient.get(createdProductId);
		expect(product.name).toBe('Updated Product Name');

		const updated = await maindb.query.findOne({
			table: 'products',
			where: { id: createdProductId },
		});

		expect(updated).toBeDefined();
		expect(updated!['name']).toBe('Updated Product Name');
	});
});
