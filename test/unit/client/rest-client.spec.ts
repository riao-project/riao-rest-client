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

			expect(fetchMock).toHaveBeenCalledWith(
				'https://api.example.com/users',
				expect.objectContaining({
					method: 'GET',
					headers: expect.objectContaining({
						'Content-Type': 'application/json',
					}),
				})
			);
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

	describe('Retry Logic', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('should retry on transient HTTP error codes', async () => {
			const retryClient = new TestRestClient({
				baseUrl: 'https://api.example.com/',
				path: 'users',
				retry: {
					attempts: 2,
					delay: 100,
				},
			});

			fetchMock
				.mockResolvedValueOnce({
					ok: false,
					status: 503,
					statusText: 'Service Unavailable',
					json: async () => ({}),
				})
				.mockResolvedValueOnce({
					ok: false,
					status: 502,
					statusText: 'Bad Gateway',
					json: async () => ({}),
				})
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					statusText: 'OK',
					json: async () => [{ id: '1', name: 'Alice' }],
				});

			const promise = retryClient.list();

			// First retry after 100ms
			await vi.advanceTimersByTimeAsync(100);
			// Second retry after 100ms
			await vi.advanceTimersByTimeAsync(100);

			const result = await promise;

			expect(fetchMock).toHaveBeenCalledTimes(3);
			expect(result).toEqual([{ id: '1', name: 'Alice' }]);
		});

		it('should retry on fetch network errors', async () => {
			const retryClient = new TestRestClient({
				baseUrl: 'https://api.example.com/',
				path: 'users',
				retry: {
					attempts: 2,
					delay: 100,
				},
			});

			fetchMock
				.mockRejectedValueOnce(new TypeError('Failed to fetch'))
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					statusText: 'OK',
					json: async () => [{ id: '2', name: 'Bob' }],
				});

			const promise = retryClient.list();

			await vi.advanceTimersByTimeAsync(100);

			const result = await promise;

			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect(result).toEqual([{ id: '2', name: 'Bob' }]);
		});

		it('should not retry on non-transient HTTP errors', async () => {
			const retryClient = new TestRestClient({
				baseUrl: 'https://api.example.com/',
				path: 'users',
				retry: {
					attempts: 2,
					delay: 100,
				},
			});

			fetchMock.mockResolvedValueOnce({
				ok: false,
				status: 400,
				statusText: 'Bad Request',
				json: async () => ({ message: 'Invalid data' }),
			});

			await expect(retryClient.list()).rejects.toThrow(
				'HTTP Error 400: Invalid data'
			);
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});

		it('should respect exponential delay', async () => {
			const retryClient = new TestRestClient({
				baseUrl: 'https://api.example.com/',
				path: 'users',
				retry: {
					attempts: 3,
					delayType: 'exponential',
					delay: 100, // 100, 200, 400
				},
			});

			fetchMock
				.mockResolvedValueOnce({
					ok: false,
					status: 500,
					json: async () => ({}),
				})
				.mockResolvedValueOnce({
					ok: false,
					status: 500,
					json: async () => ({}),
				})
				.mockResolvedValueOnce({
					ok: false,
					status: 500,
					json: async () => ({}),
				})
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: async () => [],
				});

			const promise = retryClient.list();

			// 100ms
			await vi.advanceTimersByTimeAsync(100);
			// 200ms
			await vi.advanceTimersByTimeAsync(200);
			// 400ms
			await vi.advanceTimersByTimeAsync(400);

			await promise;

			expect(fetchMock).toHaveBeenCalledTimes(4);
		});

		it('should throw if all retries are exhausted', async () => {
			const retryClient = new TestRestClient({
				baseUrl: 'https://api.example.com/',
				path: 'users',
				retry: {
					attempts: 1,
					delay: 100,
				},
			});

			fetchMock
				.mockResolvedValueOnce({
					ok: false,
					status: 500,
					statusText: 'Internal Server Error',
					json: async () => ({}),
				})
				.mockResolvedValueOnce({
					ok: false,
					status: 500,
					statusText: 'Internal Server Error',
					json: async () => ({}),
				});

			const promise = retryClient.list();
			promise.catch(() => {}); // prevent UnhandledRejection during timer advance

			await vi.advanceTimersByTimeAsync(100);

			await expect(promise).rejects.toThrow(
				'HTTP Error 500: Internal Server Error'
			);
			expect(fetchMock).toHaveBeenCalledTimes(2);
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

			expect(fetchMock).toHaveBeenCalledWith(
				'https://api.example.com/users',
				expect.objectContaining({
					method: 'GET',
					headers: expect.objectContaining({
						Authorization: 'Bearer my-static-token',
					}),
				})
			);
		});

		it('should append token via callback', async () => {
			const authClient = new TestRestClient({
				baseUrl: 'https://api.example.com/',
				path: 'users',
				token: () => 'my-dynamic-token',
			});

			mockFetchResponse(200, []);
			await authClient.list();

			expect(fetchMock).toHaveBeenCalledWith(
				'https://api.example.com/users',
				expect.objectContaining({
					method: 'GET',
					headers: expect.objectContaining({
						Authorization: 'Bearer my-dynamic-token',
					}),
				})
			);
		});

		it('should append token via async callback', async () => {
			const authClient = new TestRestClient({
				baseUrl: 'https://api.example.com/',
				path: 'users',
				token: async () => 'my-async-dynamic-token',
			});

			mockFetchResponse(200, []);
			await authClient.list();

			expect(fetchMock).toHaveBeenCalledWith(
				'https://api.example.com/users',
				expect.objectContaining({
					method: 'GET',
					headers: expect.objectContaining({
						Authorization: 'Bearer my-async-dynamic-token',
					}),
				})
			);
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

			expect(fetchMock).toHaveBeenCalledWith(
				'https://api.example.com/users',
				expect.objectContaining({
					method: 'GET',
					headers: expect.objectContaining({
						'X-API-KEY': 'custom-key',
					}),
				})
			);
		});
	});

	describe('Interceptors', () => {
		it('should run request interceptors sequentially', async () => {
			client.onRequest((req) => {
				return {
					...req,
					url: req.url + '?first=true',
					options: {
						...req.options,
						headers: {
							...req.options.headers,
							'X-Request-Id': '123',
						},
					},
				};
			});

			client.onRequest(async (req) => {
				return {
					...req,
					url: req.url + '?second=true',
				};
			});

			mockFetchResponse(200, []);

			await client.list();

			expect(fetchMock).toHaveBeenCalledWith(
				'https://api.example.com/users?first=true?second=true',
				expect.objectContaining({
					headers: expect.objectContaining({
						'X-Request-Id': '123',
						'Content-Type': 'application/json',
					}),
				})
			);
		});

		it('should run response interceptors', async () => {
			const originalResponse = new Response(
				JSON.stringify([{ id: '1', name: 'Original' }]),
				{ status: 200 }
			);
			const injectedResponse = new Response(
				JSON.stringify([{ id: '2', name: 'Injected' }]),
				{ status: 200 }
			);

			fetchMock.mockResolvedValueOnce(originalResponse);

			client.onResponse(async (res, req) => {
				expect(req.url).toBe('https://api.example.com/users');
				return res.status === 200 ? injectedResponse : res;
			});

			const result = await client.list();
			expect(result).toEqual([{ id: '2', name: 'Injected' }]);
		});

		it('should accept interceptors via RiaoRestClientOptions', async () => {
			const interceptorClient = new TestRestClient({
				baseUrl: 'https://api.example.com/',
				path: 'users',
				interceptors: {
					request: [
						(req) => ({
							...req,
							url: req.url + '?fromOption=true',
						}),
					],
				},
			});

			mockFetchResponse(200, []);

			await interceptorClient.list();

			expect(fetchMock).toHaveBeenCalledWith(
				'https://api.example.com/users?fromOption=true',
				expect.any(Object)
			);
		});
	});

	describe('Timeouts', () => {
		it('should abort request if timeout limit is reached', async () => {
			const timeoutClient = new TestRestClient({
				baseUrl: 'https://api.example.com/',
				path: 'users',
				timeout: 10,
				retry: { attempts: 0 },
			});

			fetchMock.mockImplementationOnce((url, req) => {
				return new Promise((resolve, reject) => {
					if (req.signal) {
						req.signal.addEventListener('abort', () => {
							const error = new DOMException('timeout', 'TimeoutError');
							reject(error);
						});
					}
				});
			});

			await expect(timeoutClient.list()).rejects.toThrow('timeout');

			expect(fetchMock).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					signal: expect.any(Object),
				})
			);
		});

		it('should not retry on manual AbortError', async () => {
			const clientWithRetry = new TestRestClient({
				baseUrl: 'https://api.example.com/',
				path: 'users',
				retry: { attempts: 5 },
			});

			// Setup manual abort
			const controller = new AbortController();

			fetchMock.mockImplementationOnce(
				() =>
					new Promise((_, reject) => {
						const error = new Error('abort');
						error.name = 'AbortError';
						reject(error);
					})
			);

			await expect(
				clientWithRetry.list(undefined, { signal: controller.signal })
			).rejects.toThrow();

			// Should only attempt once, no retries
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});

		it('should retry on TimeoutError', async () => {
			const clientWithRetry = new TestRestClient({
				baseUrl: 'https://api.example.com/',
				path: 'users',
				timeout: 10, // Instance-level timeout
				retry: { attempts: 1, delay: 1 },
			});

			// Mock a timeout error on the first call, success on second
			fetchMock.mockImplementationOnce(() =>
				Promise.reject(new DOMException('timeout', 'TimeoutError'))
			);
			fetchMock.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => [{ id: '1', name: 'TimeoutRetry' }],
			} as Response);

			const result = await clientWithRetry.list();

			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect(result).toEqual([{ id: '1', name: 'TimeoutRetry' }]);
		});

		it('should accept per-request timeout override', async () => {
			fetchMock.mockImplementationOnce((url, req) => {
				return new Promise((resolve, reject) => {
					if (req.signal) {
						req.signal.addEventListener('abort', () => {
							const error = new DOMException('timeout', 'TimeoutError');
							reject(error);
						});
					}
				});
			});

			await expect(client.list(undefined, { timeout: 10 })).rejects.toThrow(
				'timeout'
			);

			expect(fetchMock).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					signal: expect.any(Object),
				})
			);
		});
	});
});
