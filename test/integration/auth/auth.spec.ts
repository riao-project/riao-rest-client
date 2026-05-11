import { describe, it, expect } from 'vitest';
import { ProductsClient } from '../client';

describe('Auth Integration', () => {
	it('should send requests successfully when using a static token', async () => {
		const client = new ProductsClient({
			baseUrl: 'http://localhost:3000',
			path: 'products',
			token: 'test-token',
		});

		const result = await client.list({ limit: 1 });

		expect(Array.isArray(result)).toBe(true);
	});

	it('should send requests successfully when using token callback', async () => {
		const client = new ProductsClient({
			baseUrl: 'http://localhost:3000',
			path: 'products',
			token: async () => 'test-dynamic-token',
		});

		const result = await client.list({ limit: 1 });

		expect(Array.isArray(result)).toBe(true);
	});

	it('should gracefully fail with 401 when using an invalid token', async () => {
		const client = new ProductsClient({
			baseUrl: 'http://localhost:3000',
			path: 'products',
			token: 'bad-token',
		});

		await expect(client.list()).rejects.toThrow(/401/);
	});

	it('should fail with 401 when providing no token', async () => {
		// Don't provide a token
		const client = new ProductsClient({
			baseUrl: 'http://localhost:3000',
			path: 'products',
			token: undefined,
		});

		await expect(client.list()).rejects.toThrow(/401/);
	});
});
