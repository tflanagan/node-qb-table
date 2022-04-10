import Promise from 'bluebird';
import QBField from 'qb-field';
import QBRecord from 'qb-record';
import QuickBase from 'quickbase';

export = QBTable;

declare class QBTable<R = Record<string, any>> {
	static NewRecord<T = Record<string, any>>(table: QBTable<T>, options: T): QBRecord<T>;
	static NewRecords<T = Record<string, any>>(table: QBTable<T>, records: T[]): QBRecord<T>[];
    constructor(options?: Partial<QBTableSettings<Record<keyof R, number>>>);
	_qb: QuickBase;
    _dbid: string;
	_query: string;
	_fids: Record<keyof R, number>;
	_slist: string;
	_options: string;
	_nRecords: false | number;
	_data: {
		name: string;
		timezone: string;
		dateFormat: string;
		fields: QBField[];
		original: any;
		records: QBRecord<R>[];
		variables: Record<string, any>;
		queries: any[];
		chdbids: { name: string; dbid: string; }[];
	};
    className: string;
    settings: QBTableSettings<Record<keyof R, number>>;
	clear(): this;
	deleteRecord(record: QBRecord<R>): Promise<void>;
	deleteRecords(individually: true): Promise<void>;
	deleteRecords(individually?: false): Promise<this>;
	getAppID(): string;
	getDateFormat(): string;
	getDBID(): string;
	getChildTables(): { name: string; dbid: string; }[];
	getFid(field: number, byId: true): keyof R;
	getFid(field: keyof R, byId?: false): number;
	getFids(): Record<keyof R, number>;
	getField(id: number): QBField;
	getFields(): QBField[];
	getNRecords(): number;
	getOptions(): string;
	getPlural(): string;
	getQueries(): any[];
	getQuery(): string;
	getRecord<T extends keyof R>(value: R[T], fieldName: T, returnIndex: true): number;
	getRecord<T extends keyof R>(value: R[T], fieldName: T, returnIndex?: false): QBRecord<R>;
	getRecords(): QBRecord<R>[];
	getSingular(): string;
	getSList(): string;
	getTableName(): string;
	getTimezone(): string;
	getVariable(name: string): any;
	getVariables(): Record<string, any>;
	load(options?: Partial<{ query: string; clist: string; slist: string; options: string; ignoreDefaultQuery: boolean }>, preserve?: boolean, returnRaw?: boolean): Promise<QBRecord<R>[]>;
	_load(results: any, localClist: string, preserve: boolean): Promise<QBRecord<R>[]>;
	loadNRecords(localQuery?: string, ignoreDefaultQuery?: boolean): Promise<number>;
	loadSchema(): QBField[];
	save(individually?: boolean, fidsToSave?: (keyof R)[], recordsToSave?: QBRecord<R>[], mergeFieldId?: number): Promise<this>;
	setDBID(dbid?: string): this;
	setFid(name: keyof R, id: number): this;
	setFids(fields: { name: keyof R; id: number; }[]): this;
	setOptions(options?: string): this;
	setQuery(query?: string): this;
	setSList(slist?: string): this;
	toJson(fidsToConvert?: (keyof R)[]): QBRecord<R>[];
	upsertField<T = Record<string, any>>(options: T, autoSave?: boolean): Promise<QBField<T>>;
	upsertFields<T = Record<string, any>>(fields: T[], autoSave?: boolean): Promise<QBField<T>[]>;
	upsertRecord<T extends keyof R>(options: Partial<{ [P in T]: R[T] }>, autoSave?: boolean): Promise<QBRecord<R>>;	
	upsertRecords<T extends keyof R>(records: Partial<{ [P in T]: R[T] }>[], autoSave?: boolean, individually?: boolean): Promise<QBRecord<R>[]>;
}

declare namespace QBTable {
	export const QBTable: QBTable;
    export const className: string;
    export const defaults: QBTableSettings<Record<string, number>>;
}

declare interface QBTableSettings<T> {
	quickbase: QuickBase | typeof QuickBase.defaults;
	dbid: string;
	query: string;
	fids: T;
	slist: string;
	options: string;
}
