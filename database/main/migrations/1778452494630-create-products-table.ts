import {
	BigIntKeyColumn,
	CreateTimestampColumn,
	Migration,
	NameColumn,
	UpdateTimestampColumn,
} from '@riao/dbal';

export default class CreateProductsTable extends Migration {
	override async up() {
		await this.ddl.createTable({
			name: 'products',
			columns: [
				BigIntKeyColumn,
				NameColumn,
				CreateTimestampColumn,
				UpdateTimestampColumn,
			],
		});
	}

	override async down() {
		await this.ddl.dropTable({ tables: ['products'] });
	}
}
