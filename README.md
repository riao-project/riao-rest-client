# @riao/rest-client

A flexible, type-safe REST API client for communicating with Riao applications.

## Installation

```bash
npm install @riao/rest-client
```

## Quick Start

### Basic Setup

```typescript
import { RiaoRestClient } from '@riao/rest-client';

// 1. Define your data model
interface Product {
	id: number;
	name: string;
}

// 2. Create a client for your resource
class ProductClient extends RiaoRestClient<Product> {
	constructor() {
		super({
			baseUrl: 'https://api.example.com/v1',
			path: '/products',
		});
	}
}

// 3. Use the client
const productClient = new ProductClient();
const newProduct = await productClient.create({ name: 'My Product' });
const product = await productClient.get(newProduct.id);
```

## Operations

The `RiaoRestClient` provides standard CRUD and searching capabilities:

### Create

```typescript
const { id } = await productClient.create({ name: 'Apples' });
```

### Get (Read)

```typescript
const item = await productClient.get(myProduct.id);
```

### Update

```typescript
await productClient.update(myProduct.id, { name: 'Green Apples' });
```

### Delete

```typescript
await productClient.delete(myProduct.id);
```

### List

Retrieves a paginated list of items.

```typescript
const items = await productClient.list({
	limit: 10,
	offset: 0,
	orderBy: 'name',
	orderDirection: 'ASC',
});

for (const item of items) {
	console.log(item.name);
}
```

### Search

Search records using `@riao/rest-contract` search requests.

```typescript
const searchResults = await productClient.search({
	where: [
		{
			column: 'name',
			operator: 'LIKE',
			value: '%Apple%',
		},
	],
	order: [
		{
			column: 'name',
			direction: 'ASC',
		},
	],
	limit: 10,
	offset: 10,
});

for (const item of searchResults.records) {
	console.log(item.name);
}
```

## Authentication

The client supports flexible authentication token injection to seamlessly communicate with protected endpoints. It handles static tokens, dynamic callbacks, and can also be subclassed for custom headers.

### Static Token

If your token doesn't change, provide it directly in the options. This standardizes to `Authorization: Bearer <token>`.

```typescript
class ProductClient extends RiaoRestClient<Product> {
	constructor() {
		super({
			baseUrl: 'https://api.example.com/v1',
			path: '/products',
			token: 'your-static-bearer-token',
		});
	}
}
```

### Dynamic Token

For tokens that refresh or change over time, provide an async callback:

```typescript
class ProductClient extends RiaoRestClient<Product> {
	constructor() {
		super({
			baseUrl: 'https://api.example.com/v1',
			path: '/products',
			token: async () => await fetchMyLatestToken(),
		});
	}
}
```

### Custom Auth Schemes

If your API requires a different authentication scheme (such as an API Key), override the protected `getAuthHeaders()` method:

```typescript
class CustomAuthClient extends RiaoRestClient<Product> {
	constructor() {
		super({ baseUrl: 'https://api.example.com/v1', path: '/products' });
	}

	protected async getAuthHeaders(): Promise<Record<string, string>> {
		return { 'X-API-KEY': 'my-custom-key' };
	}
}
```

## Interceptors

You can intercept requests and responses dynamically without extending the base class using the Interceptor API. This is useful for injecting dynamic headers, logging requests, or handling response transformations.

### Request Interceptors

Request interceptors allow you to modify the request `url` and `options` before the request is made.

```typescript
const client = new ProductClient();

client.onRequest(async (req) => {
	return {
		...req,
		options: {
			...req.options,
			headers: {
				...req.options.headers,
				'X-Request-Id': crypto.randomUUID(),
			},
		},
	};
});
```

### Response Interceptors

Response interceptors allow you to globally inspect or mutate the standard `Response` object before the client parses it.

```typescript
client.onResponse(async (res, reqContext) => {
	console.log(`[HTTP ${res.status}] ${reqContext.url}`);

	if (res.status === 401) {
		// Log out user, trigger refresh, etc.
	}

	return res;
});
```

### Constructor Configuration

Alternatively, you can provide interceptors directly in the options object:

```typescript
class ProductClient extends RiaoRestClient<Product> {
	constructor() {
		super({
			baseUrl: 'https://api.example.com/v1',
			path: '/products',
			interceptors: {
				request: [
					(req) => {
						/* Modify request */ return req;
					},
				],
				response: [
					(res, req) => {
						/* Inspect response */ return res;
					},
				],
			},
		});
	}
}
```

## Automatic Retries

The client can automatically retry failed requests due to transient issues (e.g., network errors, or HTTP 408, 429, 500, 502, 503, 504 status codes).

By default, retries are disabled. To enable them, provide the `retry` configuration in the client options.

```typescript
class ProductClient extends RiaoRestClient<Product> {
	constructor() {
		super({
			baseUrl: 'https://api.example.com/v1',
			path: '/products',
			retry: {
				attempts: 3, // Retry up to 3 times
				delayType: 'exponential', // 'constant' or 'exponential' (default: 'constant')
				delay: 1000, // Initial delay in milliseconds (default: 1000)
			},
		});
	}
}
```

## Contributing

- [Contributing Guide](./CONTRIBUTING.md)
- [Setup Guide](./docs/guides//setup.md)
- [Development Guide](./docs/guides/development.md)

## License

Licensed under the [MIT License](LICENSE.md).
