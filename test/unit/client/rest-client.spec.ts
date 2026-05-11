import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { RiaoRestClient, RiaoRestClientOptions } from '@/client/rest-client';
import { RestClientError } from '@/errors';
import { DatabaseRecordWithId } from '@riao/rest-contract';

// A concrete implementation for testing
interface TestRecord extends DatabaseRecordWithId {
	name: string;
}

class TestRestClient extends RiaoRestClient<TestRecord> {
	constructor(options: RiaoRestClientOptions) {
		super(options);
	}
}

describe('RiaoRestClient', () => {
	let client: TestRestClient;
	let fetchMock: Mock;

	beforeEach(() => {
		client = new TestRestClient({
			baseUrl: 'https://api.example.com/',
			path: 'users',
		});

		fetchMock = vi.fn();
		globalThis.fetch = fetchMock;
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	const mockFetchResponse = (
		status: number,
		body?: unknown,
		statusText?: string
	) => {
		fetchMock.mockResolvedValue({
			ok: status >= 200 && status < 300,
			status,
			statusText: statusText || (status === 200 ? 'OK' : 'Error'),
			json: async () => body,
		} as Response);
	};

	it('should correctly format formatting baseUrl and path', async () => {
		const clientA = new TestRestClient({
			baseUrl: 'http://test.com/',
			path: 'items',
		});
		const clientB = new TestRestClient({
			baseUrl: 'http://test.com',
			path: '/items',
		});

		mockFetchResponse(200, []);

		await clientA.list();
		expect(fetchMock).toHaveBeenCalledWith(
			'http://test.com/items',
			expect.any(Object)
		);

		await clientB.list();
		expect(fetchMock).toHaveBeenCalledWith(
			'http://test.com/items',
			expect.any(Object)
		);
	});

	describe('CRUD Methods', () => {
		it('should call GET on list() without query string', async () => {
			const mockData = [{ id: '1', name: 'Alice' }];
			mockFetchResponse(200, mockData);

			const result = await client.list();

			expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/users', {
				method: 'GET',
				headers: expect.objectContaining({
					'Content-Type': 'application/json',
				}),
			});
			expect(result).toEqual(mockData);
		});

		it('should call GET on list() with query string', async () => {
			mockFetchResponse(200, []);

			await client.list({
				limit: 10,
				offset: 20,
				orderBy: 'name',
				orderDirection: 'DESC',
			});

			const expectedUrl =
				'https://api.example.com/users?limit=10&offset=20' +
				'&orderBy=name&orderDirection=DESC';

			expect(fetchMock).toHaveBeenCalledWith(
				expectedUrl,
				expect.objectContaining({ method: 'GET' })
			);
		});

		it('should call GET on get() with id', async () => {
			const mockData = { id: '123', name: 'Alice' };
			mockFetchResponse(200, mockData);

			const result = await client.get('123');

			expect(fetchMock).toHaveBeenCalledWith(
				'https://api.example.com/users/123',
				expect.objectContaining({ method: 'GET' })
			);
			expect(result).toEqual(mockData);
		});

		it('should call POST on search() with body', async () => {
			const mockData = { results: [{ id: '1', name: 'Alice' }], total: 1 };
			mockFetchResponse(200, mockData);

			const result = await client.search({ limit: 5 });

			expect(fetchMock).toHaveBeenCalledWith(
				'https://api.example.com/users/search',
				expect.objectContaining({
					method: 'POST',
					body: JSON.stringify({ limit: 5 }),
				})
			);
			expect(result).toEqual(mockData);
		});

		it('should call POST on create() with body', async () => {
			const mockData = { id: '123', name: 'Bob' };
			mockFetchResponse(201, mockData);

			const result = await client.create({ name: 'Bob' });

			expect(fetchMock).toHaveBeenCalledWith(
				'https://api.example.com/users',
				expect.objectContaining({
					method: 'POST',
					body: JSON.stringify({ name: 'Bob' }),
				})
			);
			expect(result).toEqual(mockData);
		});

		it('should call PATCH on update() with id and body', async () => {
			mockFetchResponse(204); // No content

			const result = await client.update('123', { name: 'Charlie' });

			expect(fetchMock).toHaveBeenCalledWith(
				'https://api.example.com/users/123',
				expect.objectContaining({
					method: 'PATCH',
					body: JSON.stringify({ name: 'Charlie' }),
				})
			);
			expect(result).toBeUndefined();
		});

		it('should call DELETE on delete() with id', async () => {
			mockFetchResponse(204); // No content

			const result = await client.delete('123');

			expect(fetchMock).toHaveBeenCalledWith(
				'https://api.example.com/users/123',
				expect.objectContaining({
					method: 'DELETE',
				})
			);
			expect(result).toBeUndefined();
		});
	});

	describe('Error Handling', () => {
		it('should throw RestClientError on HTTP > 400', async () => {
			mockFetchResponse(404, { message: 'User not found' }, 'Not Found');

			let err: RestClientError | undefined;
			try {
				await client.get('999');
			}
			catch (e) {
				err = e as RestClientError;
			}

			expect(err).toBeInstanceOf(RestClientError);
			expect(err?.message).toBe('HTTP Error 404: User not found');
			expect(err?.status).toBe(404);
		});

		it('should throw RestClientError if body message is missing', async () => {
			mockFetchResponse(500, null, 'Internal Server Error');

			let err: RestClientError | undefined;

			try {
				await client.get('999');
			}
			catch (e) {
				err = e as RestClientError;
			}

			expect(err).toBeInstanceOf(RestClientError);
			expect(err?.message).toBe('HTTP Error 500: Internal Server Error');
			expect(err?.status).toBe(500);
		});

		it('should handle 204 No Content gracefully', async () => {
			mockFetchResponse(204);

			// create typically returns an object, but if someone returned 204
			const result = await client.create({ name: 'Empty' });

			expect(result).toEqual({});
		});
	});

	describe('Authentication', () => {
		it('should append static string token properly', async () => {
			const authClient = new TestRestClient({
				baseUrl: 'https://api.example.com/',
				path: 'users',
				token: 'my-static-token',
			});

			mockFetchResponse(200, []);
			await authClient.list();

			expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/users', {
				method: 'GET',
				headers: expect.objectContaining({
					Authorization: 'Bearer my-static-token',
				}),
			});
		});

		it('should append token via callback', async () => {
			const authClient = new TestRestClient({
				baseUrl: 'https://api.example.com/',
				path: 'users',
				token: () => 'my-dynamic-token',
			});

			mockFetchResponse(200, []);
			await authClient.list();

			expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/users', {
				method: 'GET',
				headers: expect.objectContaining({
					Authorization: 'Bearer my-dynamic-token',
				}),
			});
		});

		it('should append token via async callback', async () => {
			const authClient = new TestRestClient({
				baseUrl: 'https://api.example.com/',
				path: 'users',
				token: async () => 'my-async-dynamic-token',
			});

			mockFetchResponse(200, []);
			await authClient.list();

			expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/users', {
				method: 'GET',
				headers: expect.objectContaining({
					Authorization: 'Bearer my-async-dynamic-token',
				}),
			});
		});

		it('should allow overriding getAuthHeaders by subclass', async () => {
			class CustomAuthClient extends TestRestClient {
				protected override async getAuthHeaders(): Promise<
					Record<string, string>
				> {
					return { 'X-API-KEY': 'custom-key' };
				}
			}

			const authClient = new CustomAuthClient({
				baseUrl: 'https://api.example.com/',
				path: 'users',
			});

			mockFetchResponse(200, []);
			await authClient.list();

			expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/users', {
				method: 'GET',
				headers: expect.objectContaining({
					'X-API-KEY': 'custom-key',
				}),
			});
		});
	});
});
