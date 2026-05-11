import {
	RiaoCreateEndpoint,
	RiaoDeleteEndpoint,
	RiaoGetListEndpoint,
	RiaoGetOneEndpoint,
	RiaoRouter,
	RiaoSearchEndpoint,
	RiaoUpdateEndpoint,
	DatabaseRecordWithId,
} from '@riao/rest';
import { RestServer, BearerAuthenticationScheme } from 'api-machine';
import { maindb } from '../database/main';

export interface Product extends DatabaseRecordWithId {
	name: string;
	createdAt: Date;
	updatedAt: Date;
}

class ProductsSearchEndpoint extends RiaoSearchEndpoint<Product> {
	override getColumnMap() {
		return {
			id: { column: 'id' },
			name: { column: 'name' },
		};
	}
}

export class ProductsRouter extends RiaoRouter<Product> {
	override name = 'Products';
	override path = '/products';

	override repo = maindb.getQueryRepository<Product>({ table: 'products' });

	override async routes() {
		return [
			RiaoCreateEndpoint,
			RiaoGetListEndpoint,
			RiaoGetOneEndpoint,
			RiaoUpdateEndpoint,
			RiaoDeleteEndpoint,
			ProductsSearchEndpoint,
		];
	}
}

export class TestServer extends RestServer {
	override name = 'Test Server';
	override router = ProductsRouter;

	constructor() {
		super({
			port: 3000,
		});

		this.authentication = new BearerAuthenticationScheme({
			checkToken: async (token) => {
				return ['test-token', 'test-dynamic-token'].includes(token);
			},
		});
	}
}

export const server = new TestServer();
