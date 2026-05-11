import { DatabaseSqlite } from '@riao/sqlite';

export default class MainDatabase extends DatabaseSqlite {
	override name = 'main';

	override configureFromEnv() {
		super.configureFromEnv();

		this.env = {
			...this.env,
			database: this.env?.database || 'database/main/main.db',
		};
	}
}

export const maindb = new MainDatabase();
