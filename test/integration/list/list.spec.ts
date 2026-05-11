import { describe, it, expect } from 'vitest';
import { sharedClient } from '../client';

describe('RiaoRestClient Integration - List', () => {
	it('should list products', async () => {
		const products = await sharedClient.list();

		expect(Array.isArray(products)).toBe(true);
		expect(products.length).toBeGreaterThanOrEqual(3);
		expect(products[0]).toHaveProperty('id');
		expect(products[0]).toHaveProperty('name');
	});
});
