'use strict';

/* Dependencies */
import merge from 'deepmerge';
import RFC4122 from 'rfc4122';
import {
	QuickBase,
	QuickBaseOptions,
	QuickBaseResponseDeleteTable,
	QuickBaseResponseDeleteRecords,
	QuickBaseResponseRunQuery,
	QuickBaseRequestRunQuery,
	QuickBaseRequest,
	QuickBaseResponseGetTable,
	QuickBaseResponseCreateTable,
	QuickBaseResponseUpdateTable
} from 'quickbase';
import { QBField, QBFieldJSON, QBFieldAttributeSavable } from 'qb-field';
import { QBFids, QBRecord, QBRecordData, replaceUndefinedWithString } from 'qb-record';
import { QBReport, QBReportRunResponse, QBReportRunRequest } from 'qb-report';

/* Globals */
const VERSION = require('../package.json').version;
const IS_BROWSER = typeof(window) !== 'undefined';
const rfc4122 = new RFC4122();

/* Main Class */
export class QBTable<
	RecordData extends QBRecordData = QBRecordData,
	CustomGetSet extends Object = Record<any, any>
> {

	public readonly CLASS_NAME = 'QBTable';
	static readonly CLASS_NAME = 'QBTable';

	/**
	 * The loaded library version
	 */
	static readonly VERSION: string = VERSION;

	/**
	 * The default settings of a `QuickBase` instance
	 */
	static defaults: QBTableOptions = {
		quickbase: {
			realm: IS_BROWSER ? window.location.host.split('.')[0] : ''
		},

		appId: '',
		tableId: (() => {
			if(IS_BROWSER){
				const tableId = window.location.pathname.match(/^\/db\/(?!main)(.*)$/);

				if(tableId){
					return tableId[1];
				}
			}

			return '';
		})(),
		fids: {
			recordid: 3,
			primaryKey: 3
		}
	};

	/**
	 * An internal id (guid) used for tracking/managing object instances
	 */
	public id: string;

	private _qb: QuickBase;
	private _appId: string = '';
	private _tableId: string = '';
	private _fids: Record<any, number> = {};
	private _fields: QBField[] = [];
	private _records: QBRecord<RecordData>[] = [];
	private _reports: QBReport<RecordData>[] = [];
	private _data: Record<any, any> = {};

	constructor(options?: Partial<QBTableOptions<RecordData>>){
		this.id = rfc4122.v4();

		const {
			quickbase,
			...classOptions
		} = options || {};

		if(QuickBase.IsQuickBase(quickbase)){
			this._qb = quickbase;
		}else{
			this._qb = new QuickBase(merge.all([
				QBTable.defaults.quickbase,
				quickbase || {}
			]));
		}

		const settings = merge(QBTable.defaults, classOptions);

		this.setAppId(settings.appId)
			.setTableId(settings.tableId)
			.setFids(settings.fids as Record<any, number>);

		return this;
	}

	clear(): this {
		this._fields = [];
		this._records = [];
		this._reports = [];
		this._data = {
			id: '',
			alias: '',
			created: 0,
			updated: 0,
			name: '',
			description: '',
			singleRecordName: '',
			pluralRecordName: '',
			timeZone: '',
			dateFormat: 'MM-DD-YYYY',
			keyFieldId: 0,
			nextFieldId: 0,
			nextRecordId: 0,
			defaultSortFieldId: 0,
			defaultSortOrder: ''
		};

		return this;
	}

	async delete({ requestOptions }: QuickBaseRequest = {}): Promise<QuickBaseResponseDeleteTable> {
		const results = await this._qb.deleteTable({
			appId: this.getAppId(),
			tableId: this.getTableId(),
			requestOptions
		});

		this.setTableId('');
		this.clear();

		return results;
	}

	async deleteRecord({ record, requestOptions }: { record: QBRecord<RecordData> } & QuickBaseRequest): Promise<QuickBaseResponseDeleteRecords> {
		let i = -1;

		this.getRecords().some((r, o) => {
			if(record.id === r.id || (record.get('recordid') && record.get('recordid') === r.get('recordid'))){
				i = o;

				return true;
			}

			return false;
		});

		let results = {
			numberDeleted: 1
		};

		if(i !== -1){
			this._records.splice(i, 1);
		}

		if(record.get('recordid')){
			results = await record.delete({
				requestOptions
			});

			if(results.numberDeleted === 0){
				this._records.push(record);
			}
		}

		return results;
	}

	async deleteRecords({
		individually = false,
		records,
		requestOptions
	}: {
		individually?: boolean;
		records?: QBRecord<RecordData>[];
	} & QuickBaseRequest = {}): Promise<QuickBaseResponseDeleteRecords> {
		const results = {
			numberDeleted: 0
		};

		if(individually){
			if(records === undefined){
				records = this.getRecords();
			}

			for(const record of records){
				const result = await this.deleteRecord({
					record,
					requestOptions
				});

				results.numberDeleted += result.numberDeleted;
			}
		}else{
			if(records === undefined){
				records = this._records.splice(0, this._records.length);
			}

			const batches: QBRecord<RecordData>[][] = records.reduce((batches: QBRecord<RecordData>[][], record: QBRecord<RecordData>) => {
				if(record.get('recordid') <= 0){
					return batches;
				}

				if(batches[batches.length - 1].length === 100){
					batches.push([]);
				}

				batches[batches.length - 1].push(record);

				return batches;
			}, [ [] ]);

			for(let i = 0; i < batches.length; ++i){
				const result = await this._qb.deleteRecords({
					tableId: this.getTableId(),
					where: batches[i].map((record) => {
						return `{'${this.getFid('recordid')}'.EX.'${record.get('recordid')}'}`;
					}).join('AND'),
					requestOptions
				});

				results.numberDeleted += result.numberDeleted;
			}
		}

		return results;
	}

	get(attribute: 'id' | 'appId' | 'tableId'): string;
	get<P extends keyof QuickBaseResponseGetTable>(attribute: P): QuickBaseResponseGetTable[P];
	get<P extends keyof CustomGetSet>(attribute: P): CustomGetSet[P];
	get<P extends string>(attribute: P): P extends keyof QuickBaseResponseGetTable ? QuickBaseResponseGetTable[P] : (P extends keyof CustomGetSet ? CustomGetSet[P] : any);
	get(attribute: any): any {
		if(attribute === 'id' || attribute === 'tableId'){
			return this.getTableId();
		}else
		if(attribute === 'appId'){
			return this.getAppId();
		}

		return this._data[attribute];
	}

	getAppId(): string {
		return this._appId;
	}

	getFid<T extends keyof RecordData>(field: T): number;
	getFid(field: string | number, byId?: false | undefined): number;
	getFid(field: number, byId: true): string;
	getFid(field: string | number, byId: boolean = false): string | number {
		const fids = this.getFids();
		let id: string | number = -1;

		if(byId !== true){
			if(fids.hasOwnProperty(field)){
				id = fids[field];
			}
		}else{
			id = '';
			field = +field;

			Object.keys(fids).some((name) => {
				if(fids[name] === field){
					id = name;

					return true;
				}

				return false;
			});
		}

		return id;
	}

	getFids(): QBFids<RecordData> {
		return this._fids as QBFids<RecordData>;
	}

	getField(id: number, returnIndex: true): number | undefined;
	getField(id: number, returnIndex?: false): QBField | undefined;
	getField(id: number, returnIndex: boolean = false): number | QBField | undefined {
		const fields = this.getFields();

		let result = undefined;

		for(let i = 0; result === undefined && i < fields.length; ++i){
			if(fields[i].getFid() === id){
				result = returnIndex ? i : fields[i];
			}
		}

		return result;
	}

	getFields(): QBField[] {
		return this._fields;
	}

	getNRecords(): number {
		return this._records.length;
	}

	getRecord<T extends keyof RecordData>(value: RecordData[T], fieldName: T, returnIndex: true): number;
	getRecord<T extends keyof RecordData>(value: RecordData[T], fieldName: T, returnIndex?: false): QBRecord<RecordData> | undefined;
	getRecord(value: any, fieldName: string, returnIndex: true): number;
	getRecord(value: any, fieldName?: string, returnIndex?: false | undefined): QBRecord<RecordData> | undefined;
	getRecord(value: any, fieldName: string = 'recordid', returnIndex: boolean = false): QBRecord<RecordData> | number | undefined {
		const records = this.getRecords();
		let i = -1;

		records.some((record, o) => {
			if(record.get(fieldName) !== value){
				return false;
			}

			i = o;

			return true;
		});

		if(returnIndex){
			return i;
		}else
		if(i === -1){
			return undefined;
		}

		return records[i];
	}

	getRecords(): QBRecord<RecordData>[] {
		return this._records;
	}

	getReport(id: string): QBReport<RecordData> | undefined {
		let result;

		for(let i = 0; !result && i < this._reports.length; ++i){
			if(this._reports[i].getReportId() === id){
				result = this._reports[i];
			}
		}

		return result;
	}

	getReports(): QBReport<RecordData>[] {
		return this._reports;
	}

	getTableId(): string {
		return this._tableId;
	}

	async getTempToken({ requestOptions }: QuickBaseRequest = {}): Promise<void> {
		await this._qb.getTempTokenDBID({
			dbid: this.getTableId(),
			requestOptions
		});
	}

	async loadField({ field, requestOptions }: QuickBaseRequest & { field: number | QBField }): Promise<QBField> {
		if(!QBField.IsQBField(field)){
			field = this.getField(field) || field;

			if(!QBField.IsQBField(field)){
				field = new QBField({
					quickbase: this._qb,
					tableId: this.getTableId(),
					fid: field
				});

				this._fields.push(field);
			}
		}

		await field.load({
			requestOptions
		});

		return field;
	}

	async loadFields({ requestOptions }: QuickBaseRequest = {}): Promise<QBField[]> {
		const results = await this._qb.getFields({
			tableId: this.getTableId(),
			requestOptions
		});

		results.forEach((field) => {
			let result = this.getField(field.id);

			if(!result){
				result = new QBField({
					quickbase: this._qb,
					tableId: this.getTableId(),
					fid: field.id
				});

				this._fields.push(result);
			}

			Object.entries(field).forEach(([ attribute, value ]) => {
				result!.set(attribute, value);
			});
		});

		return this.getFields();
	}

	async loadReport({ report, requestOptions }: QuickBaseRequest & { report: string | QBReport<RecordData> }): Promise<QBReport<RecordData>> {
		if(!QBReport.IsQBReport<RecordData>(report)){
			report = this.getReport(report) || report;

			if(!QBReport.IsQBReport<RecordData>(report)){
				report = new QBReport<RecordData>({
					quickbase: this._qb,
					tableId: this.getTableId(),
					reportId: report
				});

				report.setFids(this.getFids());

				this._reports.push(report);
			}
		}

		await report.load({
			requestOptions
		});

		return report;
	}

	async loadReports({ requestOptions }: QuickBaseRequest = {}): Promise<QBReport<RecordData>[]> {
		const results = await this._qb.getTableReports({
			tableId: this.getTableId(),
			requestOptions
		});

		this._reports = results.map((report) => {
			const qbReport = new QBReport<RecordData>({
				quickbase: this._qb,
				tableId: this.getTableId(),
				reportId: report.id
			});

			Object.entries(report).forEach(([ key, value ]) => {
				qbReport.set(key, value);
			});

			qbReport.setFids(this.getFids());

			return qbReport;
		});

		return this._reports;
	}

	async loadSchema({ requestOptions }: QuickBaseRequest = {}): Promise<QuickBaseResponseGetTable & { fields: QBField[], reports: QBReport<RecordData>[] }> {
		const results = await Promise.all([
			this.loadFields({ requestOptions }),
			this.loadReports({ requestOptions }),
			this.loadTable({ requestOptions })
		]);

		return {
			...results[2],
			reports: results[1],
			fields: results[0]
		};
	}

	async loadTable({ requestOptions }: QuickBaseRequest = {}): Promise<QuickBaseResponseGetTable> {
		const results = await this._qb.getTable({
			appId: this.getAppId(),
			tableId: this.getTableId(),
			requestOptions
		});

		(Object.entries(results) as [ keyof QuickBaseResponseGetTable, any ][]).forEach(([ attribute, value ]) => {
			this.set(attribute, value);
		});

		return this._data as QuickBaseResponseGetTable;
	}

	private async _runQueryAll(query: QuickBaseRequestRunQuery): Promise<QuickBaseResponseRunQuery> {
		const results: QuickBaseResponseRunQuery = {
			metadata: {
				numFields: 0,
				numRecords: 0,
				skip: 0,
				top: 0,
				totalRecords: 0
			},
			data: [],
			fields: []
		};
		let firstRun = true,
			skip = query.options?.skip || 0,
			top = 0,
			total = 0;

		while(true){
			const batchQuery: QuickBaseRequestRunQuery = {
				...query,
				sortBy: [
					...(query.sortBy || []),
					{
						fieldId: 3,
						order: 'ASC'
					}
				]
			};

			if(!firstRun){
				batchQuery.options = {
					skip,
					top
				};
			}

			if(!this._qb.settings.userToken){
				await this._qb.getTempTokenDBID({
					dbid: batchQuery.tableId
				});
			}

			const {
				fields,
				metadata,
				data
			} = await this._qb.runQuery({
				...batchQuery,
				returnAxios: false
			});

			if(firstRun){
				results.fields = fields;
				results.metadata = metadata;
				results.data = data;

				total = metadata.totalRecords;

				firstRun = false;
			}else{
				results.data = results.data.concat(data);
			}

			top = metadata.top || metadata.numRecords || top; // top doesn't always return in metadata
			skip += metadata.numRecords;

			if(skip >= total){
				break;
			}
		}

		results.metadata.skip = 0;
		results.metadata.top = results.data.length;
		results.metadata.numRecords = results.data.length;
		results.metadata.totalRecords = results.data.length;

		return results;
	}

	async runQuery({ fids, groupBy, options, select, sortBy, where, returnAll, requestOptions }: QBTableRunQueryOptions = {}): Promise<QBTableRunQueryResponse<RecordData>> {
		if(!fids){
			fids = this.getFids();
		}

		const names = Object.keys(fids);

		const selectedFids = names.reduce((selectedFids, name) => {
			const fid = fids![name];

			if(!select || select.length === 0 || select.indexOf(fid) !== -1){
				selectedFids[name] = fid;
			}

			return selectedFids;
		}, {} as Record<string | number, number>);
		const selectedNames = Object.keys(selectedFids);

		const query: any = {
			tableId: this.getTableId(),
			select: selectedNames.map((name) => {
				return selectedFids[name];
			}).filter(filterUnique),
			where: where,
			requestOptions,
			returnAxios: false
		};

		if(sortBy){
			query.sortBy = sortBy;
		}

		if(groupBy){
			query.groupBy = groupBy;
		}

		if(options){
			query.options = options;
		}

		let results;

		if(returnAll){
			results = await this._runQueryAll(query);
		}else{
			results = await this._qb.runQuery(query);
		}

		results.fields.forEach((field) => {
			let result = this.getField(field.id);

			if(!result){
				result = new QBField({
					quickbase: this._qb,
					tableId: this.getTableId(),
					fid: field.id
				});

				this._fields.push(result);
			}

			Object.entries(field).forEach(([ attribute, value ]) => {
				result!.set(attribute, value);
			});
		});

		const fields = this.getFields();

		this._records = results.data.map((record) => {
			const qbRecord = new QBRecord<RecordData>({
				quickbase: this._qb,
				tableId: this.getTableId(),
				fids: this.getFids()
			});

			qbRecord.setFields(fields);

			selectedNames.forEach((name) => {
				const fid = selectedFids[name];

				qbRecord.set('' + (name || fid), record[fid].value);
			});

			return qbRecord;
		});

		return {
			metadata: results.metadata,
			fields: this.getFields(),
			records: this.getRecords()
		};
	}

	async runReport({ report, skip, top, requestOptions }: QBReportRunRequest & { report: string | QBReport<RecordData> }): Promise<QBReportRunResponse<RecordData>>{
		if(!QBReport.IsQBReport<RecordData>(report)){
			report = this.getReport(report) || report;

			if(!QBReport.IsQBReport<RecordData>(report)){
				report = new QBReport<RecordData>({
					quickbase: this._qb,
					tableId: this.getTableId(),
					reportId: report
				});

				report.setFids(this.getFids());

				this._reports.push(report);
			}
		}

		const results = await report.run({
			skip,
			top,
			requestOptions
		});

		this._records = report.getRecords();

		return results;
	}

	async saveFields({ attributesToSave, requestOptions }: { attributesToSave?: QBFieldAttributeSavable[] } & QuickBaseRequest = {}): Promise<QBField[]> {
		const fields = this.getFields();

		for(let i = 0; i < fields.length; ++i){
			await fields[i].save({
				attributesToSave,
				requestOptions
			});
		}

		return fields;
	}

	async saveRecords({ individually, fidsToSave, recordsToSave, mergeFieldId, requestOptions }: { individually?:  boolean, fidsToSave?: (keyof RecordData | number)[], mergeFieldId?: number, recordsToSave?: QBRecord<RecordData>[] } & QuickBaseRequest = {}): Promise<QBRecord<RecordData>[]> {
		const records = recordsToSave === undefined ? this.getRecords() : recordsToSave;

		if(individually){
			for(let i = 0; i < records.length; ++i){
				await records[i].save({
					fidsToSave,
					requestOptions
				});
			}
		}else{
			const mergeField = mergeFieldId || this.getFid('primaryKey');
			const fids = this.getFids();
			const names = Object.keys(fids);
			const selectedNames = names.filter((name) => {
				const fid = fids[name];
				const filtered = !fidsToSave || fidsToSave.indexOf(fid) !== -1 || fidsToSave.indexOf(name) !== -1 || fid === mergeField;

				if(!filtered){
					return false;
				}

				const field = this.getField(fid);

				if(field && [
					'lookup',
					'summary',
					'formula'
				].indexOf(field.get('mode') || '') !== -1){
					return false;
				}

				return true;
			});

			const results = await this._qb.upsert({
				tableId: this.getTableId(),
				mergeFieldId: mergeField,
				data: records.map((qbRecord) => {
					return selectedNames.reduce((record, name) => {
						const fid = fids[name];

						if(fid){
							record[fid] = {
								value: replaceUndefinedWithString(qbRecord.get(name))
							};
						}

						return record;

					}, {} as Record<string,{
						value: any
					}>);
				}),
				fieldsToReturn: names.map((name) => {
					return fids[name];
				}).filter(filterUnique),
				requestOptions
			});

			const error = typeof(results.metadata.lineErrors) !== 'undefined' ? results.metadata.lineErrors[0] : false;
	
			if(error){
				throw new Error(error[0]);
			}

			records.forEach((record, i) => {
				const data = results.data[i];

				if(data){
					names.forEach((name) => {
						record.set(name, data[fids[name]].value);
					});
				}
			});
		}

		return records;
	}

	async saveTable({ attributesToSave, requestOptions }: { attributesToSave?: string[] } & QuickBaseRequest = {}): Promise<QuickBaseResponseGetTable> {
		const tableId = this.getTableId();
		const data = Object.keys(this._data).filter((attribute) => {
			return [
				'name',
				'description',
				'iconName',
				'singularNoun',
				'pluralNoun'
			].indexOf(attribute) !== -1 && (!attributesToSave || attributesToSave.indexOf(attribute) === -1);
		}).reduce((results: any, attribute) => {
			results[attribute] = this._data[attribute];

			return results;
		}, {
			appId: this.getAppId(),
			requestOptions
		});

		let results: QuickBaseResponseCreateTable | QuickBaseResponseUpdateTable;

		if(tableId){
			data.tableId = tableId;

			results = await this._qb.updateTable(data);
		}else{
			results = await this._qb.createTable(data);
		}

		(Object.entries(results) as [ keyof QuickBaseResponseGetTable, any ][]).forEach(([ attribute, value ]) => {
			this.set(attribute, value);
		});

		return this._data as QuickBaseResponseGetTable;
	}

	set(attribute: 'id' | 'tableId' | 'appid', value: string): this;
	set<P extends keyof QuickBaseResponseGetTable>(attribute: P, value: QuickBaseResponseGetTable[P]): this;
	set<P extends keyof CustomGetSet>(attribute: P, value: CustomGetSet[P]): this;
	set<P extends string>(attribute: P, value: P extends keyof QuickBaseResponseGetTable ? QuickBaseResponseGetTable[P] : (P extends keyof CustomGetSet ? CustomGetSet[P] : any)): this;
	set(attribute: any, value: any): this {
		if(attribute === 'id' || attribute === 'tableId'){
			return this.setTableId(value);
		}else
		if(attribute === 'appid'){
			return this.setAppId(value);
		}

		this._data[attribute] = value;

		return this;
	}

	setAppId(appId: string): this {
		this._appId = appId;

		return this;
	}

	setFid<T extends keyof RecordData>(name: T, id: number): this;
	setFid(name: string | number, id: number): this;
	setFid(name: string | number, id: number): this {
		this._fids[name] = +id;

		return this;
	}

	setFids(fields: Record<any, number>): this {
		Object.entries(fields).forEach(([ name, fid ]) => {
			this.setFid(name, fid);
		});

		return this;
	}

	setTableId(tableId: string): this {
		this._tableId = tableId;
		this._data.id = tableId;

		return this;
	}

	async upsertField(options: QBField | Partial<QBFieldJSON['data']>, autoSave: boolean = false): Promise<QBField> {
		let field: QBField | undefined;

		if(QBField.IsQBField(options)){
			if(options.get('recordid')){
				field = this.getField(options.get('fid'));
			}else
			if(options.get('primaryKey')){
				field = this.getField(options.get('fid'));
			}else{
				field = options;
			}
		}else
		if(options !== undefined){
			if(options.fid){
				field = this.getField(options.fid);
			}else
			if(options.id){
				field = this.getField(options.id);
			}
		}

		if(!field){
			field = new QBField({
				quickbase: this._qb,
				tableId: this.getTableId(),
				fid: -1
			});

			if(options && !QBField.IsQBField(options) && options.fid){
				field.setFid(options.fid);
			}

			this._fields.push(field);
		}

		if(options && !QBField.IsQBField(options)){
			Object.entries(options).forEach(([ attribute, value ]) => {
				field!.set(attribute, value);
			});
		}

		if(autoSave){
			await field.save();
		}

		return field;
	}

	async upsertFields(fields: (Partial<QBFieldJSON> | QBField)[], autoSave: boolean = false): Promise<QBField[]>{
		const results = [];

		for(let i = 0; i < fields.length; ++i){
			results.push(await this.upsertField(fields[i], autoSave));
		}

		return results;
	}

	async upsertRecord(options?: QBRecord<RecordData> | Partial<RecordData>, autoSave: boolean = false): Promise<QBRecord<RecordData>> {
		let record: QBRecord<RecordData> | undefined;

		if(QBRecord.IsQBRecord<RecordData>(options)){
			if(options.get('recordid')){
				record = this.getRecord(options.get('recordid'), 'recordid');
			}else
			if(options.get('primaryKey')){
				record = this.getRecord(options.get('primaryKey'), 'primaryKey');
			}else{
				record = options;
			}
		}else
		if(options !== undefined){
			if(options.recordid){
				record = this.getRecord(options.recordid, 'recordid');
			}else
			if(options.primaryKey){
				record = this.getRecord(options.primaryKey, 'primaryKey');
			}
		}

		if(!record){
			record = new QBRecord<RecordData>({
				quickbase: this._qb,
				tableId: this.getTableId(),
				fids: this.getFids()
			});

			this._records.push(record);
		}

		record.setFields(this.getFields());

		if(options && !QBRecord.IsQBRecord<RecordData>(options)){
			const addDefaults = !record.get('recordid');

			Object.entries(options).forEach(([ fidName, fidValue ]) => {
				let value;

				if(addDefaults){
					const fid = this.getFid(fidName);
					const field = this.getField(fid);

					if(field){
						value = field.get('properties')?.defaultValue;
					}

					if(fidValue !== undefined){
						value = fidValue;
					}
				}else{
					value = fidValue;
				}

				record!.set(fidName, value);
			});
		}

		if(autoSave){
			await record.save();
		}

		return record;
	}

	async upsertRecords(records: (QBRecord<RecordData> | Partial<RecordData>)[], autoSave: boolean = false): Promise<QBRecord<RecordData>[]>{
		const results = [];

		for(let i = 0; i < records.length; ++i){
			results.push(await this.upsertRecord(records[i], autoSave));
		}

		return results;
	}

	/**
	 * Test if a variable is a `qb-record` object
	 *
	 * @param obj A variable you'd like to test
	 */
	static IsQBTable<T extends QBRecordData = QBRecordData, K extends Object = Record<any, any>>(obj: any): obj is QBTable<T, K> {
		return ((obj || {}) as QBTable).CLASS_NAME === QBTable.CLASS_NAME;
	}

	static NewRecord<T extends QBRecordData, K extends Object>(table: QBTable<T, K>, data?: Partial<T>){
		return QBRecord.NewRecord<T>({
			quickbase: table._qb,
			tableId: table.getTableId(),
			fids: table.getFids()
		}, data);
	}

}

/* Helpers */
const filterUnique = (val: any, i: number, arr: any[]) => {
	return arr.indexOf(val) === i;
};

/* Interfaces */
export type QBTableOptions<RecordData extends QBRecordData = {}> = {
	quickbase: QuickBaseOptions | QuickBase;
	appId: string;
	tableId: string;
	fids: Partial<QBFids<RecordData>>;
}

export type QBTableRunQueryOptions = {
	fids?: Record<string, number>;
	returnAll?: boolean;
} & Pick<QuickBaseRequestRunQuery, 'select' | 'where' | 'options' | 'sortBy' | 'groupBy' | 'requestOptions'>

export type QBTableRunQueryResponse<RecordData extends QBRecordData = {}> = Pick<QuickBaseResponseRunQuery, 'metadata'> & {
	records: QBRecord<RecordData>[];
	fields: QBField[];
};

/* Export to Browser */
if(IS_BROWSER){
	window.QBTable = exports;
}

