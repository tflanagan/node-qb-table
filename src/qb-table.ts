'use strict';

/* Dependencies */
import merge from 'deepmerge';
import {
	QuickBase,
	QuickBaseOptions,
	QuickBaseResponseDeleteTable,
	QuickBaseResponseDeleteRecords,
	QuickBaseResponseRunQuery,
	QuickBaseRecord
} from 'quickbase';
import { QBField, QBFieldJSON } from 'qb-field';
import { QBRecord, QBRecordJSON } from 'qb-record';
import { QBReport, QBReportResponse } from 'qb-report';

/* Globals */
const VERSION = require('../package.json').version;
const IS_BROWSER = typeof(window) !== 'undefined';

/* Main Class */
export class QBTable {

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
		dbid: (() => {
			if(IS_BROWSER){
				const dbid = window.location.pathname.match(/^\/db\/(?!main)(.*)$/);
	
				if(dbid){
					return dbid[1];
				}
			}
	
			return '';
		})(),
		fids: {
			recordid: 3,
			primaryKey: 3
		}
	};

	private _qb: QuickBase;
	private _appId: string = '';
	private _dbid: string = '';
	private _fids: QBTableFids = {};
	private _fields: QBField[] = [];
	private _records: QBRecord[] = [];
	private _reports: QBReport[] = [];
	private _data: QBTableData = {};

	constructor(options?: QBTableOptions){
		if(options){
			if(options.quickbase instanceof QuickBase){
				this._qb = options.quickbase;
			}else{
				this._qb = new QuickBase(options.quickbase);
			}

			delete options.quickbase;

			const settings = merge(QBRecord.defaults, options || {});
			
			this.setAppId(settings.appId)
				.setDBID(settings.dbid)
				.setFids(settings.fids);
		}else{
			this._qb = new QuickBase();
		}

		return this;
	}

	clear(): QBTable {
		this._fields = [];
		this._records = [];
		this._reports = [];
		this._data = {};

		return this;
	}

	async delete(): Promise<QuickBaseResponseDeleteTable> {
		const results = await this._qb.deleteTable({
			appId: this.getAppId(),
			tableId: this.getDBID()
		});

		this.setDBID('');
		this.clear();

		return results;
	}

	async deleteRecord(record: QBRecord): Promise<QuickBaseResponseDeleteRecords> {
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
			results = await record.delete();

			if(results.numberDeleted === 0){
				this._records.push(record);
			}
		}

		return results;
	}

	async deleteRecords(individually: boolean = false, records?: QBRecord[]): Promise<QuickBaseResponseDeleteRecords> {
		const results = {
			numberDeleted: 0
		};

		if(individually){
			if(records === undefined){
				records = this.getRecords();
			}

			for(const record of records){
				const result = await this.deleteRecord(record);

				results.numberDeleted += result.numberDeleted;
			}
		}else{
			if(records === undefined){
				records = this._records.splice(0, this._records.length);
			}
			
			// TODO: how to handle multiple deletes at once
		}

		return results;
	}

	get(attribute: string): any {
		if(attribute === 'singleRecordName'){
			attribute = 'singularNoun';
		}else
		if(attribute === 'pluralRecordName'){
			attribute = 'pluralNoun';
		}else
		if(attribute === 'id'){
			return this.getDBID();
		}

		if(!this._data.hasOwnProperty(attribute)){
			return null;
		}

		return this._data[attribute];
	}

	getAppId(): string {
		return this._appId;
	}
	
	getDBID(): string {
		return this._dbid;
	}

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

	getFids(): QBTableFids {
		return this._fids;
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

	getRecord(value: any, fieldName: string | number, returnIndex: true): number;
	getRecord(value: any, fieldName?: string | number, returnIndex?: false | undefined): QBRecord | undefined;
	getRecord(value: any, fieldName: string | number = 'recordid', returnIndex: boolean = false): QBRecord | number | undefined {
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

	getRecords(): QBRecord[] {
		return this._records;
	}

	getReport(id: number): QBReport | undefined {
		let result;

		for(let i = 0; !result && i < this._reports.length; ++i){
			if(this._reports[i].getReportId() === id){
				result = this._reports[i];
			}
		}

		return result;
	}

	getReports(): QBReport[] {
		return this._reports;
	}

	async loadField(field: number | QBField): Promise<QBField> {
		if(typeof(field) === 'number'){
			field = this.getField(field) || field;

			if(typeof(field) === 'number'){
				field = new QBField({
					quickbase: this._qb,
					dbid: this.getDBID(),
					fid: field
				});

				this._fields.push(field);
			}
		}

		await field.load();

		return field;
	}

	async loadFields(): Promise<QBField[]> {
		const results = await this._qb.getFields({
			tableId: this.getDBID()
		});

		results.forEach((field) => {
			let result = this.getField(field.id);

			if(!result){
				result = new QBField({
					quickbase: this._qb,
					dbid: this.getDBID(),
					fid: field.id
				});

				this._fields.push(result);
			}

			getObjectKeys(field).forEach((attribute) => {
				result!.set(attribute, (field as Indexable)[attribute]);
			});
		});

		return this.getFields();
	}

	async loadReport(report: number | QBReport): Promise<QBReport> {
		if(typeof(report) === 'number'){
			report = this.getReport(report) || report;

			if(typeof(report) === 'number'){
				report = new QBReport({
					quickbase: this._qb,
					dbid: this.getDBID(),
					reportId: report
				});
	
				// @ts-ignore
				report._fids = this.getFids();

				this._reports.push(report);
			}
		}

		await report.loadSchema();

		return report;
	}

	async loadReports(): Promise<QBReport[]> {
		const results = await this._qb.getTableReports({
			tableId: this.getDBID()
		});

		this._reports = results.map((report) => {
			const qbReport = new QBReport({
				quickbase: this._qb,
				dbid: this.getDBID(),
				reportId: report.id
			});

			// @ts-ignore
			qbReport._data = report;
			// @ts-ignore
			qbReport._fids = this.getFids();

			return qbReport;
		});

		return this._reports;
	}

	async loadSchema(): Promise<QBTableData & { fields: QBField[], reports: QBReport[] }> {
		const results = await Promise.all([
			this.loadFields(),
			this.loadReports(),
			this.loadTable()
		]);

		return {
			...results[2],
			reports: results[1],
			fields: results[0]
		};
	}

	async loadTable(): Promise<QBTableData> {
		const results = await this._qb.getTable({
			appId: this.getAppId(),
			tableId: this.getDBID()
		});

		Object.keys(results).forEach((attribute) => {
			this.set(attribute, (results as Indexable)[attribute]);
		});

		return this._data;
	}

	async runQuery(): Promise<QBTableRunQueryResponse>;
	async runQuery({ where, select, sortBy, groupBy, options }: QBTableRunQuery): Promise<QBTableRunQueryResponse>;
	async runQuery(where?: string | QBTableRunQuery, select?: number[], sortBy?: { fieldId?: number; order?: string; }[], groupBy?: { fieldId?: number; by?: 'string'; }[], options?: { skip?: number, top?: number }): Promise<QBTableRunQueryResponse>{
		if(typeof(where) === 'object'){
			options = where.options;
			groupBy = where.groupBy;
			sortBy = where.sortBy;
			select = where.select;
			where = where.where;
		}
		
		const fids = this.getFids();
		const names = Object.keys(fids);

		const selectedFids = names.reduce((selectedFids: QBTableFids, name) => {
			const fid = fids[name];

			if(!select || select.length === 0 || select.indexOf(fid) !== -1){
				selectedFids[name] = fid;
			}

			return selectedFids;
		}, {});
		const selectedNames = Object.keys(selectedFids);

		const query: any = {
			tableId: this.getDBID(),
			select: selectedNames.map((name) => {
				return selectedFids[name];
			}).filter(filterUnique),
			where: where
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

		const results = await this._qb.runQuery(query);

		results.fields.forEach((field) => {
			let result = this.getField(field.id);

			if(!result){
				result = new QBField({
					quickbase: this._qb,
					dbid: this.getDBID(),
					fid: field.id
				});

				this._fields.push(result);
			}

			getObjectKeys(field).forEach((attribute) => {
				result!.set(attribute, (field as Indexable)[attribute]);
			});
		});

		const fields = this.getFields();

		this._records = results.data.map((record) => {
			const qbRecord = new QBRecord({
				quickbase: this._qb,
				dbid: this.getDBID(),
				fids: this.getFids()
			});

			//@ts-ignore
			qbRecord._fields = fields;
			
			selectedNames.forEach((name) => {
				const fid = selectedFids[name];

				qbRecord.set(name || fid, record[fid].value);
			});

			return qbRecord;
		});

		return {
			...results.metadata,
			fields: this.getFields(),
			records: this.getRecords()
		};
	}

	async runReport(report: number | QBReport): Promise<QBReportResponse>{
		if(typeof(report) === 'number'){
			report = this.getReport(report) || report;

			if(typeof(report) === 'number'){
				report = new QBReport({
					quickbase: this._qb,
					dbid: this.getDBID(),
					reportId: report
				});
	
				// @ts-ignore
				report._fids = this.getFids();
			}
		}

		const results = await report.load();

		this._records = report.getRecords();

		return results;
	}

	async saveFields(attributesToSave?: string[]): Promise<QBField[]> {
		const fields = this.getFields();

		for(let i = 0; i < fields.length; ++i){
			await fields[i].save(attributesToSave);
		}

		return fields;
	}

	async saveRecords({ individually, fidsToSave, recordsToSave }: QBTableSave): Promise<QBRecord[]>;
	async saveRecords(individually: QBTableSave | boolean = false, fidsToSave?: (string|number)[], recordsToSave?: QBRecord[]): Promise<QBRecord[]> {
		if(typeof(individually) === 'object'){
			recordsToSave = individually.recordsToSave;
			fidsToSave = individually.fidsToSave;
			individually = individually.individually || false;
		}
		
		const records = recordsToSave === undefined ? this.getRecords() : recordsToSave;

		if(individually){
			for(let i = 0; i < records.length; ++i){
				await records[i].save(fidsToSave);
			}
		}else{
			const ridFid = this.getFid('recordid');
			const fids = this.getFids();
			const names = Object.keys(fids);
			const selectedNames = names.filter((name) => {
				const fid = fids[name];
	
				return !fidsToSave || fidsToSave.indexOf(fid) !== -1 || fidsToSave.indexOf(name) !== -1 || fid === ridFid;
			});

			const results = await this._qb.upsertRecords({
				tableId: this.getDBID(),
				mergeFieldId: ridFid,
				data: records.map((qbRecord) => {
					return selectedNames.reduce((record: QuickBaseRecord, name) => {
						const fid = fids[name];

						if(fid){
							record[fid] = {
								value: qbRecord.get(name)
							};
						}

						return record;
					}, {});
				}),
				fieldsToReturn: names.map((name) => {
					return fids[name];
				}).filter(filterUnique)
			});

			records.forEach((record, i) => {
				const data = results.data[i];

				names.forEach((name) => {
					record.set(name, data[fids[name]].value);
				});
			});
		}

		return records;
	}

	async saveTable(attributesToSave?: string[]): Promise<QBTableData> {
		const tableId = this.getDBID();
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
			appId: this.getAppId()
		});

		let results: any;
	
		if(tableId){
			data.tableId = tableId;

			results = await this._qb.updateTable(data);
		}else{
			results = await this._qb.createTable(data);
		}

		Object.keys(results).forEach((attribute) => {
			this.set(attribute, results[attribute]);
		});

		return this._data;
	}

	set(attribute: string, value: any): QBTable {
		if(attribute === 'singleRecordName'){
			attribute = 'singularNoun';
		}else
		if(attribute === 'pluralRecordName'){
			attribute = 'pluralNoun';
		}else
		if(attribute === 'id'){
			return this.setDBID(value);
		}

		this._data[attribute] = value;

		return this;
	}

	setAppId(appId: string): QBTable {
		this._appId = appId;

		return this;
	}

	setDBID(dbid: string): QBTable {
		this._dbid = dbid;

		return this;
	}

	setFid(name: string | number, id: number): QBTable {
		if(typeof(id) === 'object'){
			this._fids[name] = id;

			Object.keys(id).forEach((key, i) => {
				this._fids[('' + name) + (i + 1)] = +id[key];
			});
		}else{
			this._fids[name] = +id;
		}

		return this;
	}

	setFids(fields: QBTableFids): QBTable {
		Object.keys(fields).forEach((name) => {
			this.setFid(name, fields[name]);
		});

		return this;
	}

	async upsertField(options: QBField | QBFieldJSON, autoSave: boolean = false): Promise<QBField> {
		let field: QBField | undefined;

		if(options instanceof QBField){
			field = options;
		}else{
			if(options.id){
				options.fid = options.id;

				delete options.id;
			}

			options = merge({
				dbid: this.getDBID(),
				fid: -1
			}, options);

			field = this.getField(options.fid);

			if(field === undefined){
				field = new QBField({
					quickbase: options.quickbase || this._qb,
					dbid: options.dbid,
					fid: options.fid
				});
			}

			if(options.data){
				Object.keys(options.data).forEach((attribute) => {
					// @ts-ignore
					field.set(attribute, options.data[attribute]);
				});
			}
		}

		let i = this.getField(field.getFid(), true);

		if(i !== undefined){
			this._fields[i] = field;
		}else{
			this._fields.push(field);
		}

		if(autoSave === true){
			await field.save();
		}

		return field;
	}

	async upsertFields(fields: (QBFieldJSON | QBField)[], autoSave: boolean = false): Promise<QBField[]>{
		const results = [];

		for(let i = 0; i < fields.length; ++i){
			results.push(await this.upsertField(fields[i], autoSave));
		}

		return results;
	}

	async upsertRecord(options: QBRecord | QBRecordJSON['data'], autoSave: boolean = false): Promise<QBRecord> {
		let record: QBRecord | undefined;
		
		if(options instanceof QBRecord){
			if(options.get('recordid')){
				record = this.getRecord(options.get('recordid'), 'recordid');
			}else
			if(options.get('primaryKey')){
				record = this.getRecord(options.get('primaryKey'), 'primaryKey');
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
			record = new QBRecord({
				quickbase: this._qb,
				dbid: this.getDBID(),
				fids: this.getFids()
			});
		}

		//@ts-ignore
		record._fields = this.getFields();

		if(options && !(options instanceof QBRecord)){
			const addDefaults = !record.get('recordid');

			getObjectKeys(options).forEach((fidName) => {
				let value;

				if(addDefaults){
					const fid = this.getFid(fidName);
					const field = this.getField(fid);

					if(field){
						value = field.get('properties')?.defaultValue;
					}

					if(options[fidName] !== undefined){
						value = options[fidName];
					}
				}else{
					value = options[fidName];
				}

				record!.set(fidName, value);
			});
		}

		if(autoSave){
			await record.save();
		}

		return record;
	}

	async upsertRecords(records: (QBRecord | QBRecordJSON['data'])[], autoSave: boolean = false): Promise<QBRecord[]>{
		const results = [];

		for(let i = 0; i < records.length; ++i){
			results.push(await this.upsertRecord(records[i], autoSave));
		}

		return results;
	}
}

/* Helpers */
const filterUnique = (val: any, i: number, arr: any[]) => {
	return arr.indexOf(val) === i;
};

function getObjectKeys<O>(obj: O): (keyof O)[] {
    return Object.keys(obj) as (keyof O)[];
}

/* Interfaces */
interface Indexable {
	[index: string]: any;
}

export interface QBTableOptions {
	quickbase?: QuickBaseOptions | QuickBase;
	appId?: string;
	dbid?: string;
	fids?: QBTableFids;
}

export interface QBTableData {
	[index: string]: any;
	id?: string;
	alias?: string;
	created?: number;
	updated?: number;
	name?: string;
	description?: string;
	singleRecordName?: string;
	pluralRecordName?: string;
	timeZone?: string;
	dateFormat?: string;
	keyFieldId?: number;
	nextFieldId?: number;
	nextRecordId?: number;
	defaultSortFieldId?: number;
	defaultSortOrder?: string;
}

export interface QBTableSave {
	individually?: boolean;
	fidsToSave?: (string|number)[],
	recordsToSave?: QBRecord[];
}

export interface QBTableRunQuery {
	where?: string;
	select?: number[];
	sortBy?: {
		fieldId?: number;
		order?: string;
	}[];
	groupBy?: {
		fieldId?: number;
		by?: 'string';
	}[];
	options?: {
		skip?: number;
		top?: number;
	};
}

type QBTableRunQueryResponse = QuickBaseResponseRunQuery['metadata'] & {
	records: QBRecord[];
	fields: QBField[];
};

export type QBTableFids = {
	[index in string | number]: number;
}

/* Export to Browser */
if(IS_BROWSER){
	// @ts-ignore
	window.QBTable = QBTable;
}

