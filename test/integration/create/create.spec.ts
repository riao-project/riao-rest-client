import { describe, it, expect } from 'vitest';
import { sharedClient } from '../client';

describe('RiaoRestClient Integration - Create', () => {
	it('should create a product', async () => {
		const product = await sharedClient.create({
			name: 'Integration Test Product',
		});

		expect(product).toBeDefined();
		expect(product.id).toBeDefined();
	});
});
