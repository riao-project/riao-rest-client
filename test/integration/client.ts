import { RiaoRestClient, RiaoRestClientOptions } from '@/client/rest-client';
import { DatabaseRecordWithId } from '@riao/rest-contract';

export interface Product extends DatabaseRecordWithId {
	name: string;
	createdAt: Date;
	updatedAt: Date;
}

export class ProductsClient extends RiaoRestClient<Product> {
	constructor(
		options: RiaoRestClientOptions = {
			baseUrl: 'http://localhost:3000',
			path: 'products',
			token: 'test-token',
		}
	) {
		super(options);
	}
}

export const sharedClient = new ProductsClient();
