declare class AggregateError extends Error {
	public name: string;
	public message: string;
	public errors: Error[];
	public length: number;

	constructor(errors: Error[], message?: string, opts?: { cause?: Error });
}

interface Window {
	QBTable: any;
}
