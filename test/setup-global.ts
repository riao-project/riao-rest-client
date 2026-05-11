// {{ remrg:task Global setup and teardown for Vitest }}

import { Migration, MigrationPackage, MigrationRunner } from '@riao/dbal';
import { maindb } from '../database/main';
import { log } from './log';
import CreateProductsTable from '../database/main/migrations/1778452494630-create-products-table';
import SeedProductsData from '../database/main/migrations/1778452543123-seed-products-data';
import { server } from './server';
import { rmSync } from 'fs';

class TestMigrationsPackage extends MigrationPackage {
	override name = 'test-migrations';
	override package = 'test-migrations';

	override async getMigrations() {
		return {
			'create-products-table': CreateProductsTable as typeof Migration,
			'seed-products-data': SeedProductsData as typeof Migration,
		};
	}
}

export async function setup() {
	// Global setup
	log.info('Running global setup...');

	log.info('Initializing database...');
	await maindb.init();

	log.info('Running database migrations down...');
	const mg = new MigrationRunner(maindb);
	const migrations = { 'test-migrations': new TestMigrationsPackage() };

	await mg.runWithOptions({
		direction: 'down',
		migrations,
	});

	log.info('Resetting database...');
	await maindb.disconnect();

	rmSync(maindb.env.database);

	await maindb.connect();

	log.info('Running database migrations up...');
	await mg.runWithOptions({
		direction: 'up',
		migrations,
	});

	log.info('Starting test server...');
	await server.start();
}

export async function teardown() {
	// Global teardown
	await server.stop();
	await maindb.disconnect();
}
