import { RestClientError } from '@/errors';
import {
	DatabaseRecordWithId,
	ListRequest,
	SearchRequest,
	SearchResponse,
} from '@riao/rest-contract';

export type AuthToken =
	| string
	| (() => string | undefined | Promise<string | undefined>);

export interface RetryOptions {
	attempts: number;
	delayType: 'constant' | 'exponential';
	delay: number;
}

export type RequestInterceptorContext = { url: string; options: RequestInit };

export type RequestInterceptor = (
	context: RequestInterceptorContext
) => RequestInterceptorContext | Promise<RequestInterceptorContext>;

export type ResponseInterceptor = (
	response: Response,
	context: RequestInterceptorContext
) => Response | Promise<Response>;

export type RiaoRequestInit = RequestInit & { timeout?: number };

export interface RiaoRestClientOptions {
	baseUrl: string;
	path: string;
	headers?: Record<string, string>;
	token?: AuthToken;
	retry?: Partial<RetryOptions>;
	timeout?: number;
	interceptors?: {
		request?: RequestInterceptor[];
		response?: ResponseInterceptor[];
	};
}

export abstract class RiaoRestClient<T extends DatabaseRecordWithId> {
	protected baseUrl: string;
	protected path: string;
	protected headers: Record<string, string>;
	protected token?: AuthToken;
	protected retry: RetryOptions;
	protected timeout?: number;
	protected requestInterceptors: RequestInterceptor[];
	protected responseInterceptors: ResponseInterceptor[];

	constructor(options: RiaoRestClientOptions) {
		this.baseUrl = options.baseUrl.replace(/\/$/, '');
		this.path = options.path.startsWith('/')
			? options.path
			: '/' + options.path;
		this.timeout = options.timeout ?? 30000;
		this.headers = {
			'Content-Type': 'application/json',
			...options.headers,
		};
		this.token = options.token;
		this.retry = {
			attempts: options.retry?.attempts ?? 0,
			delayType: options.retry?.delayType ?? 'constant',
			delay: options.retry?.delay ?? 1000,
		};
		this.requestInterceptors = options.interceptors?.request ?? [];
		this.responseInterceptors = options.interceptors?.response ?? [];
	}

	public onRequest(interceptor: RequestInterceptor): this {
		this.requestInterceptors.push(interceptor);

		return this;
	}

	public onResponse(interceptor: ResponseInterceptor): this {
		this.responseInterceptors.push(interceptor);

		return this;
	}

	protected getEndpointUrl(id?: string): string {
		const base = `${this.baseUrl}${this.path}`;

		return id ? `${base}/${id}` : base;
	}

	protected async fetch<R>(url: string, options: RiaoRequestInit): Promise<R> {
		let attempts = 0;
		const maxAttempts = this.retry.attempts + 1;

		while (attempts < maxAttempts) {
			try {
				const authHeaders = await this.getAuthHeaders();

				const reqOptions = { ...options };
				const timeoutMs = reqOptions.timeout ?? this.timeout;

				if (timeoutMs && !reqOptions.signal) {
					reqOptions.signal = AbortSignal.timeout(timeoutMs);
				}

				// Don't pass our custom timeout prop into the actual fetch Init
				delete reqOptions.timeout;

				let requestContext: RequestInterceptorContext = {
					url,
					options: {
						...reqOptions,
						headers: {
							...this.headers,
							...authHeaders,
							...options.headers,
						},
					},
				};

				for (const interceptor of this.requestInterceptors) {
					requestContext = await interceptor(requestContext);
				}

				let result = await fetch(requestContext.url, requestContext.options);

				for (const interceptor of this.responseInterceptors) {
					result = await interceptor(result, requestContext);
				}

				if (!result.ok) {
					let message = result.statusText;

					try {
						const body = await result.json();

						if (body && typeof body === 'object' && 'message' in body) {
							message = body.message;
						}
					}
					catch {
						// Ignore
					}

					throw new RestClientError(
						`HTTP Error ${result.status}: ${message}`,
						result.status,
						result
					);
				}

				if (result.status === 204) {
					return {} as R;
				}

				return (await result.json()) as R;
			}
			catch (error: unknown) {
				attempts++;

				const isRestClientError = error instanceof RestClientError;
				const isTransientStatus =
					isRestClientError &&
					[408, 429, 500, 502, 503, 504].includes(error.status);
				const isNetworkError = error instanceof TypeError;
				const isTimeoutError =
					error instanceof Error && error.name === 'TimeoutError';
				const isAbortError =
					error instanceof Error && error.name === 'AbortError';

				if (
					attempts >= maxAttempts ||
					isAbortError ||
					(!isTransientStatus && !isNetworkError && !isTimeoutError)
				) {
					throw error;
				}

				const delay =
					this.retry.delayType === 'exponential'
						? this.retry.delay * 2 ** (attempts - 1)
						: this.retry.delay;

				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}

		throw new Error('Failed to fetch after maximum retry attempts');
	}

	public async list(
		query?: ListRequest,
		options?: RiaoRequestInit
	): Promise<T[]> {
		let url = this.getEndpointUrl();

		if (query) {
			const params = new URLSearchParams();

			if (query.limit !== undefined) {
				params.append('limit', String(query.limit));
			}

			if (query.offset !== undefined) {
				params.append('offset', String(query.offset));
			}

			if (query.orderBy) {
				params.append('orderBy', query.orderBy);
			}

			if (query.orderDirection) {
				params.append('orderDirection', query.orderDirection);
			}

			const queryString = params.toString();

			if (queryString) {
				url += `?${queryString}`;
			}
		}

		return this.fetch<T[]>(url, { ...options, method: 'GET' });
	}

	public async get(id: string, options?: RiaoRequestInit): Promise<T> {
		return this.fetch<T>(this.getEndpointUrl(id), {
			...options,
			method: 'GET',
		});
	}

	public async search(
		query: SearchRequest,
		options?: RiaoRequestInit
	): Promise<SearchResponse<T>> {
		return this.fetch<SearchResponse<T>>(`${this.baseUrl}${this.path}/search`, {
			...options,
			method: 'POST',
			body: JSON.stringify(query),
		});
	}

	public async create(
		record: Partial<T>,
		options?: RiaoRequestInit
	): Promise<T> {
		return this.fetch<T>(this.getEndpointUrl(), {
			...options,
			method: 'POST',
			body: JSON.stringify(record),
		});
	}

	public async update(
		id: string,
		record: Partial<T>,
		options?: RiaoRequestInit
	): Promise<void> {
		await this.fetch<void>(this.getEndpointUrl(id), {
			...options,
			method: 'PATCH',
			body: JSON.stringify(record),
		});
	}

	public async delete(id: string, options?: RiaoRequestInit): Promise<void> {
		await this.fetch<void>(this.getEndpointUrl(id), {
			...options,
			method: 'DELETE',
		});
	}

	protected async getAuthorizationHeader(): Promise<string | undefined> {
		if (!this.token) {
			return undefined;
		}

		const tokenValue =
			typeof this.token === 'function' ? await this.token() : this.token;

		if (!tokenValue) {
			return undefined;
		}

		return `Bearer ${tokenValue}`;
	}

	protected async getAuthHeaders(): Promise<Record<string, string>> {
		const authHeader = await this.getAuthorizationHeader();

		if (authHeader) {
			return { Authorization: authHeader };
		}

		return {};
	}
}
