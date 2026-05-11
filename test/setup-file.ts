import { afterAll, beforeAll } from 'vitest';
import { maindb } from '../database/main';

beforeAll(async () => {
	// File setup
	if (!maindb.isLoaded) {
		await maindb.init();
	}
});

afterAll(async () => {
	// File teardown
	await maindb.disconnect();
});
