import { Migration } from '@riao/dbal';

export default class SeedProductsData extends Migration {
	override async up() {
		await this.query.insert({
			table: 'products',
			records: [
				{ name: 'Product 1' },
				{ name: 'Product 2' },
				{ name: 'Product 3' },
			],
		});
	}

	override async down() {}
}
