import { describe, it, expect } from 'vitest';
import { sharedClient } from '../client';
import { maindb } from '../../../database/main';

describe('RiaoRestClient Integration - Delete', () => {
	it('should delete a product', async () => {
		const { id } = await maindb.query.insertOne({
			table: 'products',
			record: { name: 'Product to Delete' },
		});

		await sharedClient.delete(id);

		const deleted = await maindb.query.findOne({
			table: 'products',
			where: { id },
		});

		expect(deleted).toBeNull();
	});
});
