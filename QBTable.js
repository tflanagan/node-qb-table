'use strict';

/* Versioning */
const VERSION_MAJOR = 1;
const VERSION_MINOR = 4;
const VERSION_PATCH = 1;

/* Dependencies */
const merge = require('lodash.merge');
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
			records: []
		};

		if(options && options.quickbase.className && options.quickbase.className === 'QuickBase'){
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
			records: []
		};

		return this;
	}

	deleteRecord(record){
		let i = -1;

		this.getRecords().some((r, o) => {
			if(record._id === r._id){
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

	getDBID(){
		return this._dbid;
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
		const i = indexOfObj(fields, 'id', +id);

		if(i === -1){
			return undefined;
		}

		return fields[i];
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

	getSList(){
		return this._slist;
	};

	getTableName(){
		return this._data.name;
	};

	getVariable(name){
		return this._data.variables[name];
	};

	getVariables(){
		return this._data.variables;
	};

	load(localQuery, localClist, localSlist, localOptions){
		if(typeof(localQuery) === 'object'){
			localOptions = localQuery.options;
			localSlist = localQuery.slist;
			localClist = localQuery.clist;
			localQuery = localQuery.query;
		}

		const dbid = this.getDBID();
		const fids = this.getFids();

		return this._qb.api('API_DoQuery', {
			dbid: dbid,
			query: [].concat(localQuery || [], this.getQuery()).join('AND'),
			clist: localClist || Object.keys(fids).map((fid) => {
				return fids[fid];
			}),
			slist: localSlist || this.getSList(),
			options: localOptions || this.getOptions(),
			includeRids: true
		}).then((results) => {
			this._data = results.table;

			this._data.records = this._data.records.map((record) => {
				const newRecord = new QBRecord({
					quickbase: this._qb,
					dbid: dbid,
					fids: fids,
					recordid: record.rid
				});

				Object.keys(fids).forEach((fid) => {
					newRecord.set(fid, record[fids[fid]]);
				});

				newRecord._fields = this._data.fields;

				return newRecord;
			});

			this._nRecords = false;

			return this.getRecords();
		});
	};

	loadNRecords(localQuery){
		return this._qb.api('API_DoQueryCount', {
			dbid: this.getDBID(),
			query: [].concat(localQuery || [], this.getQuery()).join('AND')
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

			this._data.records = records;

			if(this._nRecords !== false && this._data.records.length !== 0){
				this._nRecords = false;
			}

			return this.getFields();
		});
	};

	save(individually, fidsToSave){
		if(individually){
			return QuickBase.Promise.map(this.getRecords(), (record) => {
				return record.save(fidsToSave);
			}).then(() => {
				return this;
			});
		}

		const fids = this.getFids();
		const names = Object.keys(fids);
		const records = this.getRecords();

		let clist = [fids.recordid];

		names.forEach((name) => {
			const id = fids[name];
			const field = this.getField(id);

			if(id <= 5 || (field && [
				'summary',
				'virtual',
				'lookup'
			].indexOf(field.mode) !== -1) || (fidsToSave && fidsToSave.indexOf(fid) === -1 && fidsToSave.indexOf(name) === -1)){
				return;
			}

			clist.push(id);
		});

		const csv = records.reduce((csv, record) => {
			return csv.concat(clist.reduce((row, fid) => {
				const name = this.getFid(fid, true);
				let value = record.get(name);

				if(value === null){
					value = '';
				}

				return row.concat(val2csv(value));
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
			const now = Date.now();

			records.forEach((record, i) => {
				if(fids.dateCreated && !record.get('recordid')){
					record.set('dateCreated', now);
				}

				record.set('recordid', results.rids[i].rid);

				if(fids.dateModified){
					record.set('dateModified', now);
				}
			});

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
		this._fids[name] = +id;

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

	upsertRecord(options, autoSave){
		let record = undefined;

		if(!options){
			options = {};
		}

		if(options && options.className && options.className === 'QBRecord'){
			record = options;

			this._data.records.push(record);
		}else{
			const _upsertRecord = () => {
				Object.keys(options).forEach((name) => {
					record.set(name, options[name]);
				});

				record._fields = this._data._fields;
			};

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

}

/* Expose Static Methods */
QBTable.NewRecord = function(table, options){
	const record = new QBRecord({
		quickbase: table._qb,
		dbid: table.getDBID(),
		fids: table.getFids()
	});

	Object.keys(options).forEach((name) => {
		record.set(name, options[name]);
	});

	return record;
};

/* Expose Properties */
QBTable.defaults = defaults;

/* Helpers */
const indexOfObj = function(obj, key, value){
	if(typeof(obj) !== 'object'){
		return -1;
	}

	let result,  i = 0, o = 0, k = 0;
	const l = obj.length;

	for(; i < l; ++i){
		if(typeof(key) === 'object'){
			result = new Array(key.length);
			result = setAll(result, false);

			for(o = 0, k = result.length; o < k; ++o){
				if(obj[i][key[o]] === value[o]){
					result[o] = true;
				}
			}

			if(result.indexOf(false) === -1){
				return i;
			}
		}else{
			if(obj[i][key] === value){
				return i;
			}
		}
	}

	return -1;
};

const setAll = function(arr, value){
	for(let i = 0; i < arr.length; ++i){
		arr[i] = value;
	}

	return arr;
};

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

if(typeof global !== 'undefined' && typeof window !== 'undefined' && global === window){
	global.QBTable = QBTable;
}
