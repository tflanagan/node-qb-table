'use strict';

/* Versioning */
const VERSION_MAJOR = 2;
const VERSION_MINOR = 2;
const VERSION_PATCH = 0;

/* Dependencies */
const merge = require('lodash.merge');
const QBField = require('qb-field');
const QBRecord = require('qb-record');
const QuickBase = require('quickbase');

/* Default Settings */
const defaults = {
	quickbase: {
		realm: typeof global !== 'undefined' && typeof window !== 'undefined' && global === window ? global.location.host.split('.')[0] : '',
		appToken: ''
	},

	dbid: (function(){
		if(typeof global !== 'undefined' && typeof window !== 'undefined' && global === window){
			var dbid = global.location.pathname.match(/^\/db\/(?!main)(.*)$/);

			if(dbid){
				return dbid[1];
			}
		}

		return '';
	})(),
	query: '',
	fids: {
		recordid: 3,
		primaryKey: 3
	},
	slist: '',
	options: ''
};

/* Main Class */
class QBTable {

	constructor(options){
		this.className = QBTable.className;

		this._dbid = '';
		this._query = '';
		this._fids = {};
		this._slist = '';
		this._options = '';
		this._nRecords = false;
		this._data = {
			name: '',
			timezone: '',
			dateFormat: '',
			fields: [],
			original: {},
			records: [],
			variables: [],
			queries: []
		};

		if(options && options.quickbase && ((options.quickbase.className && options.quickbase.className === 'QuickBase') || typeof(options.quickbase.api) === 'function')){
			this._qb = options.quickbase;

			delete options.quickbase
		}

		const settings = merge({}, QBTable.defaults, options || {});

		this.setDBID(settings.dbid)
			.setQuery(settings.query)
			.setFids(settings.fids)
			.setSList(settings.slist)
			.setOptions(settings.options);

		if(!this._qb){
			this._qb = new QuickBase(settings.quickbase);
		}

		return this;
	}

	clear(){
		this._data = {
			name: '',
			timezone: '',
			dateFormat: '',
			fields: [],
			chdbids: [],
			original: {},
			records: [],
			variables: []
		};

		return this;
	}

	deleteRecord(record){
		let i = -1;

		this.getRecords().some((r, o) => {
			if(record._id === r._id || (record.get('recordid') && record.get('recordid') === r.get('recordid'))){
				i = o;

				return true;
			}

			return false;
		});

		if(i === -1){
			return QuickBase.Promise.resolve();
		}

		record = this._data.records.splice(i, 1)[0];

		if(record.get('recordid')){
			return record.delete().then((results) => {
				return this;
			}).catch((err) => {
				if(err.code === 30){
					return this;
				}

				this._data.records.push(record);

				throw err;
			});
		}

		return QuickBase.Promise.resolve();
	}

	deleteRecords(individually){
		if(individually){
			return QuickBase.Promise.map(this.getRecords(), (record) => {
				return this.deleteRecord(record);
			});
		}

		const records = this._data.records.splice(0, this.getNRecords());

		return this._qb.api('API_PurgeRecords', {
			dbid: this.getDBID(),
			query: this.getQuery()
		}).then(() => {
			return this;
		}).catch((err) => {
			this._data.records = this._data.records.concat(records);

			throw err;
		});
	};

	getAppID(){
		return this._data.original.app_id;
	};

	getDateFormat(){
		return this._data.dateFormat;
	};

	getDBID(){
		return this._dbid;
	};

	getChildTables(){
		return this._data.chdbids;
	};

	getFid(field, byId){
		const fids = this.getFids();
		let id = -1;

		if(byId !== true){
			if(fids.hasOwnProperty(field)){
				id = fids[field];
			}
		}else{
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
	};

	getFids(){
		return this._fids;
	};

	getField(id){
		const fields = this.getFields();

		let i = 0, result = undefined;

		for(; result === undefined && i < fields.length; ++i){
			if(fields[i].getFid() === id){
				result = fields[i];
			}
		}

		return result;
	};

	getFields(){
		return this._data.fields;
	};

	getNRecords(){
		return this._nRecords !== false ? this._nRecords : this._data.records.length;
	};

	getOptions(){
		return this._options;
	};

	getPlural(){
		return this._data.original.plural_record_name;
	};

	getQueries(){
		return this._data.queries;
	};

	getQuery(){
		return this._query;
	};

	getRecord(value, fieldName, returnIndex){
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
	};

	getRecords(){
		return this._data.records;
	};

	getSingular(){
		return this._data.original.single_record_name;
	};

	getSList(){
		return this._slist;
	};

	getTableName(){
		return this._data.name;
	};

	getTimezone(){
		return this._data.timezone;
	};

	getVariable(name){
		return this._data.variables[name];
	};

	getVariables(){
		return this._data.variables;
	};

	load(localQuery, localClist, localSlist, localOptions, preserve, returnRaw, ignoreDefaultQuery){
		if(typeof(localQuery) === 'object'){
			returnRaw = localSlist;
			preserve = localClist;

			localOptions = localQuery.options;
			localSlist = localQuery.slist;
			localClist = localQuery.clist;
			ignoreDefaultQuery = localQuery.ignoreDefaultQuery;
			localQuery = localQuery.query;
		}

		const dbid = this.getDBID();
		const fids = this.getFids();
		const options = {
			dbid: dbid,
			clist: localClist || Object.keys(fids).filter((fidName) => {
				return fids[fidName] !== 'object';
			}).map((fid) => {
				return fids[fid];
			}),
			slist: localSlist || this.getSList(),
			options: localOptions || this.getOptions(),
			includeRids: true
		};

		if(this.getQuery() && !ignoreDefaultQuery){
			if(localQuery){
				localQuery += 'AND(' + this.getQuery() + ')';
			}else{
				localQuery = this.getQuery();
			}
		}

		const typeofLocalQuery = typeof(localQuery);

		if(typeofLocalQuery === 'string'){
			options.query = localQuery;
		}else
		if(typeofLocalQuery === 'number'){
			options.qid = localQuery;
		}

		return this._qb.api('API_DoQuery', options).then((results) => {
			const records = this._load(merge({}, results), localClist, preserve);

			if(returnRaw){
				return results;
			}

			return records;
		});
	};

	_load(results, localClist, preserve){
		this._nRecords = false;

		const dbid = this.getDBID();
		const fids = this.getFids();

		const returnedClist = localClist ? ('' + localClist).split('.').map((fid) => {
			if(fid === 'a'){
				return fid;
			}

			return +fid;
		}) : [];

		const prepareNewRecord = (data) => {
			const newRecord = new QBRecord({
				quickbase: this._qb,
				dbid: dbid,
				fids: fids,
				recordid: data.rid
			});

			upsertData(newRecord, data);

			newRecord._fields = this._data.fields;
			newRecord._meta.name = this._data.name;

			return newRecord;
		};

		const upsertData = (record, data) => {
			Object.keys(fids).filter((fidName) => {
				return fids[fidName] !== 'object' && (!localClist || returnedClist[0] === 'a' || returnedClist.indexOf(fids[fidName]) === -1);
			}).forEach((fidName) => {
				const fid = +fids[fidName];
				const field = this.getField(fid);
				let value = data[fids[fidName]];

				if(field){
					value = QBField.ParseValue(field, value);
				}

				record.set(fidName, value);
			});
		};

		if(!preserve){
			const timezone = this._data.timezone;
			const dateFormat = this._data.dateFormat;

			this._data = results.table;

			this._data.fields = this._data.fields.map((field) => {
				return QBField.NewField({
					quickbase: this._qb,
					dbid: this.getDBID(),
					fid: +field.id
				}, field);
			});

			this._data.records = this._data.records.map(prepareNewRecord);
			this._data.timezone = timezone;
			this._data.dateFormat = dateFormat;
		}else{
			this._data.name = results.table.name;
			this._data.original = results.table.original;
			this._data.variables = results.table.variables;

			const l = this._data.fields.length;

			results.table.fields.forEach((field) => {
				const fid = +field.id;

				let result = undefined;

				for(let i = 0; result === undefined && i < this._data.fields.length; ++i){
					if(this._data.fields[i].getFid() === fid){
						result = this._data.fields[i];
					}
				}

				if(!result){
					result = new QBField({
						quickbase: this._qb,
						dbid: this.getDBID(),
						fid: fid
					});

					this._data.fields.push(result);
				}

				Object.keys(field).forEach((attribute) => {
					result.set(attribute, field[attribute]);
				});
			});

			results.table.records.forEach((data) => {
				let record = this.getRecord(data.rid, 'recordid');

				if(record){
					upsertData(record, data);
				}else{
					record = prepareNewRecord(data);

					this._data.records.push(record);
				}
			});
		}

		return this.getRecords();
	};

	loadNRecords(localQuery, ignoreDefaultQuery){
		if(this.getQuery() && !ignoreDefaultQuery){
			if(localQuery){
				localQuery += 'AND(' + this.getQuery() + ')';
			}else{
				localQuery = this.getQuery();
			}
		}

		return this._qb.api('API_DoQueryCount', {
			dbid: this.getDBID(),
			query: localQuery
		}).then((results) => {
			this._nRecords = results.numMatches;

			return this.getNRecords();
		});
	};

	loadSchema(){
		return this._qb.api('API_GetSchema', {
			dbid: this.getDBID()
		}).then((results) => {
			const records = this._data.records;

			this._data = results.table;

			this._data.fields = this._data.fields.map((field) => {
				return QBField.NewField({
					quickbase: this._qb,
					dbid: this.getDBID(),
					fid: +field.id
				}, field);
			});

			this._data.records = records;
			this._data.timezone = results.time_zone;
			this._data.dateFormat = results.date_format;

			if(this._nRecords !== false && this._data.records.length !== 0){
				this._nRecords = false;
			}

			return this.getFields();
		});
	};

	save(individually, fidsToSave, recordsToSave){
		const records = recordsToSave === undefined ? this.getRecords() : recordsToSave;

		if(individually){
			return QuickBase.Promise.map(records, (record) => {
				return record.save(fidsToSave);
			}).then(() => {
				return this;
			});
		}

		const fids = this.getFids();

		const key = fids.recordid === fids.primaryKey ? fids.recordid : fids.primaryKey;

		let clist = [ key ];

		Object.keys(fids).filter((fidName) => {
			return fids[fidName] !== 'object';
		}).forEach((name) => {
			const id = fids[name];
			const field = this.getField(id);

			if(id <= 5 || (field && ([
				'summary',
				'virtual',
				'lookup'
			].indexOf(field.get('mode')) !== -1 || field.get('snapfid') || [
				'ICalendarButton',
				'vCardButton'
			].indexOf(field.get('field_type')) !== -1 || field.get('field_type') === 'file')) || (fidsToSave && fidsToSave.indexOf(id) === -1 && fidsToSave.indexOf(name) === -1)){
				return;
			}

			clist.push(id);
		});

		clist = clist.filter((val, i, self) => {
			return self.indexOf(val) === i;
		});

		const csv = records.reduce((csv, record) => {
			return csv.concat(clist.reduce((row, fid) => {
				fid = +fid;

				const name = this.getFid(fid, true);
				const field = this.getField(fid);

				let value = record.get(name);

				if([
					undefined,
					null
				].indexOf(value) !== -1){
					value = '';
				}

				if(typeof(value) === 'object' && value.filename){
					value = '';
				}else
				if(field){
					value = QBField.FormatValue(field, value);
				}

				if(typeof(value) === 'string' && value.match(/^(;?[0-9]{1,9}\.[a-z0-9]{4};?)+$/)){
					value = value.split(';').map((part) => {
						return '<' + part + '>';
					}).join(';');
				}else{
					value = val2csv(value);
				}

				return row.concat(value);
			}, []).join(','));
		}, []).join('\n');

		if(csv.length === 0){
			return QuickBase.Promise.resolve();
		}

		return this._qb.api('API_ImportFromCSV', {
			dbid: this.getDBID(),
			clist: clist,
			records_csv: csv
		}).then((results) => {
			if(results.rids && results.rids.length > 0){
				records.forEach((record, i) => {
					if(fids.dateCreated && !record.get('recordid')){
						record.set('dateCreated', results.rids[i].update_id);
					}

					record.set('recordid', results.rids[i].rid);

					if(fids.dateModified){
						record.set('dateModified', results.rids[i].update_id);
					}
				});
			}

			return this;
		});
	};

	setDBID(dbid){
		this._dbid = dbid;

		this.getRecords().forEach((record) => {
			record.setDBID(dbid);
		});

		return this;
	};

	setFid(name, id){
		if(typeof(id) === 'object'){
			this._fids[name] = id;

			Object.keys(id).forEach((key, i) => {
				this._fids[('' + name) + (i + 1)] = +id[key];
			});
		}else{
			this._fids[name] = +id;
		}

		this.getRecords().forEach((record) => {
			record.setFid(name, id);
		});

		return this;
	};

	setFids(fields){
		Object.keys(fields).forEach((name) => {
			this.setFid(name, fields[name]);
		});

		return this;
	};

	setOptions(options){
		this._options = options;

		return this;
	};

	setQuery(query){
		this._query = query;

		return this;
	};

	setSList(slist){
		this._slist = slist;

		return this;
	};

	toJson(fidsToConvert){
		return this.getRecords().map((record) => {
			return record.toJson(fidsToConvert);
		});
	};

	upsertField(options, autoSave){
		const fid = options.fid || options.id || -1;

		let field, found = false;

		if(fid !== -1){
			field = this.getField(fid);

			if(field){
				found = true;
			}
		}

		if(!field){
			field = new QBField({
				quickbase: this._qb,
				dbid: this.getDBID,
				fid: fid
			});
		}

		Object.keys(options).forEach((attribute) => {
			field.set(attribute, options[attribute]);
		});

		if(!found){
			this._data.fields.push(field);
		}

		if(autoSave === false || field.getFid() !== -1){
			return QuickBase.Promise.resolve(field);
		}

		return field.save();
	};

	upsertFields(fields, autoSave){
		return QuickBase.Promise.map(fields, (record) => {
			return this.upsertField(field, autoSave);
		});
	};

	upsertRecord(options, autoSave){
		const _upsertRecord = (isRecord) => {
			record._fields = this.getFields();
			record._meta.name = this._data.name;

			Object.keys(record.getFids()).filter((fidName) => {
				return record.getFid(fidName) !== 'object';
			}).forEach((name) => {
				let value;

				const fid = record.getFid(name);

				if(fid !== -1){
					const field = record.getField(fid);

					if(field){
						value = field.get('default_value');
					}
				}

				record.set(name, value);
			});

			const fids = isRecord ? options.getFids() : options;

			Object.keys(fids).filter((fidName) => {
				return !isRecord || typeof(fids[fidName]) !== 'object';
			}).forEach((name) => {
				let value = record.get(name);

				if(isRecord){
					value = options.get(name);
				}else
				if(options.hasOwnProperty(name)){
					value = options[name];
				}

				record.set(name, value);
			});
		};

		let record = undefined;

		if(!options){
			options = {};
		}

		if(options.className && options.className === 'QBRecord'){
			if(options.get('recordid')){
				record = this.getRecord(options.get('recordid'), 'recordid');
			}else
			if(options.get('primaryKey')){
				record = this.getRecord(options.get('primaryKey'), 'primaryKey');
			}

			if(record){
				_upsertRecord(true);
			}else{
				record = options;

				this._data.records.push(record);
			}
		}else{
			if(options.recordid){
				record = this.getRecord(options.recordid, 'recordid');
			}else
			if(options.primaryKey){
				record = this.getRecord(options.primaryKey, 'primaryKey');
			}

			if(record){
				_upsertRecord();
			}else{
				record = new QBRecord({
					quickbase: this._qb,
					dbid: this.getDBID(),
					fids: this.getFids()
				});

				_upsertRecord();

				this._data.records.push(record);
			}
		}

		if(autoSave === true){
			return record.save().then(() => {
				return record;
			});
		}

		return QuickBase.Promise.resolve(record);
	};

	upsertRecords(records, autoSave, individually){
		return QuickBase.Promise.map(records, (record) => {
			return this.upsertRecord(record);
		}).then((newRecords) => {
			if(!autoSave){
				return newRecords;
			}

			return this.save(individually, false, newRecords).then(() => {
				return newRecords;
			});
		});
	};

}

/* Expose Static Methods */
QBTable.NewRecord = function(table, options){
	const record = new QBRecord({
		quickbase: table._qb,
		dbid: table.getDBID(),
		fids: table.getFids()
	});

	record._fields = table.getFields();
	record._meta.name = table.getTableName();

	Object.keys(record.getFids()).filter((fidName) => {
		return record.getFid(fidName) !== 'object';
	}).forEach((name) => {
		let value;

		const fid = record.getFid(name);

		if(fid !== -1){
			const field = record.getField(fid);

			if(field){
				value = field.get('default_value');
			}
		}

		record.set(name, value);
	});

	Object.keys(options).forEach((name) => {
		record.set(name, options[name]);
	});

	return record;
};

QBTable.NewRecords = function(table, records){
	return records.map((record) => {
		return QBTable.NewRecord(table, record);
	});
};

/* Helpers */
const val2csv = function(val){
	if(!val){
		return val;
	}

	if(typeof(val) === 'boolean'){
		val = val ? 1 : 0;
	}

	if(typeof(val) !== 'number' && (isNaN(val) || !isFinite(val) || val.match(/e/))){
		if(val.match(/e/)){
			val = val.toString();
		}

		val = val.replace(/\"/g, '""');

		val = '"' + val + '"';
	}

	return val;
};

/* Expose Properties */
QBTable.defaults = defaults;
QBTable.className = 'QBTable';

/* Expose Version */
QBTable.VERSION = [ VERSION_MAJOR, VERSION_MINOR, VERSION_PATCH ].join('.');

/* Export Module */
if(typeof module !== 'undefined' && module.exports){
	module.exports = QBTable;
}else
if(typeof define === 'function' && define.amd){
	define('QBTable', [], function(){
		return QBTable;
	});
}

if((typeof global !== 'undefined' && typeof window !== 'undefined' && global === window) || (typeof global === 'undefined' && typeof window !== 'undefined')){
	(global || window).QBTable = QBTable;
}
