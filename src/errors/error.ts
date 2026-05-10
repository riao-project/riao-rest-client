export class RestClientError extends Error {
	public status: number;
	public response: Response;

	constructor(message: string, status: number, response: Response) {
		super(message);
		this.status = status;
		this.response = response;
		this.name = 'RestClientError';
	}
}
