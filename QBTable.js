var QBTable = (function(){

	'use strict';

	/* Versioning */
	var VERSION_MAJOR = 0;
	var VERSION_MINOR = 2;
	var VERSION_PATCH = 0;

	/* Dependencies */
	if(typeof(window.QuickBase) === 'undefined'){
		window.QuickBase = {};

		$('<script />', {
			type: 'text/javascript',
			src: 'https://cdn.datacollaborative.com/js/quickbase/quickbase.browserify.min.js'
		}).appendTo('head');
	}

	if(typeof(window.QBRecord) === 'undefined'){
		window.QBRecord = {};

		$('<script />', {
			type: 'text/javascript',
			src: 'https://cdn.datacollaborative.com/js/qb-record/QBRecord.min.js'
		}).appendTo('head');
	}

	/* Defaults */
	var defaults = {
		quickbase: {
			realm: window.location.host.split('.')[0],
			appToken: ''
		},

		dbid: (function(){
			var dbid = window.location.pathname.match(/^\/db\/(?!main)(.*)$/);

			return dbid ? dbid[1] : '';
		})(),
		query: '',
		fids: {
			recordid: 3,
			primaryKey: 3
		},
		slist: '',
		options: ''
	};

	/* QBTable */
	var QBTable = function(options){
		this._dbid = '';
		this._query = '';
		this._fids = {};
		this._slist = '';
		this._options = '';
		this._data = {
			records: []
		};

		var that = this,
			init = function(){
				if(options && options.quickbase instanceof QuickBase){
					that._qb = options.quickbase;

					delete options.quickbase
				}

				var settings = $.extend(true, {}, defaults, options || {});

				that.setDBID(settings.dbid)
					.setQuery(settings.query)
					.setFids(settings.fids)
					.setSList(settings.slist)
					.setOptions(settings.options);

				if(!that._qb){
					that._qb = new QuickBase(settings.quickbase);
				}
			};

		if(typeof(QuickBase) === 'function'){
			init();
		}else{
			var nS = setInterval(function(){
				if([
					typeof(QuickBase) === 'function'
				].indexOf(false) !== -1){
					return false;
				}

				clearInterval(nS);

				init();
			});
		}

		return this;
	};

	QBTable.prototype.clear = function(){
		this._data = {
			records: []
		};

		return this;
	};

	QBTable.prototype.deleteRecord = function(record){
		var that = this,
			i = -1;

		this.getRecords().some(function(r, o){
			if(record._id === r._id){
				i = o;

				return true;
			}

			return false;
		});

		if(i === -1){
			return this;
		}

		var record = this._data.records.splice(i, 1)[0];

		if(record.get('recordid')){
			return record.delete().then(function(results){
				return that;
			}).catch(function(err){
				that._data.records.push(record);

				throw err;
			});
		}

		return QuickBase.Promise.resolve();
	};

	QBTable.prototype.deleteRecords = function(individually){
		var that = this;

		if(individually){
			return QuickBase.Promise.map(this.getRecords(), function(record){
				return that.deleteRecord(record);
			});
		}

		var records = this._data.records.splice(0, this.getNRecords());

		return this._qb.api('API_PurgeRecords', {
			dbid: this.getDBID(),
			query: [].concat(localQuery || [], this.getQuery()).join('AND')
		}).then(function(){
			return that;
		}).catch(function(err){
			that._data.records = that._data.records.concat(records);

			throw err;
		});
	};

	QBTable.prototype.getDBID = function(){
		return this._dbid;
	};

	QBTable.prototype.getFid = function(field, byId){
		var fids = this.getFids(),
			id = -1;

		if(byId !== true){
			if(fids.hasOwnProperty(field)){
				id = fids[field];
			}
		}else{
			field = +field;

			Object.keys(fids).some(function(name){
				if(fids[name] === field){
					id = name;

					return true;
				}

				return false;
			});
		}

		return id;
	};

	QBTable.prototype.getFids = function(field){
		return this._fids;
	};

	QBTable.prototype.getField = function(id){
		var fields = this.getFields(),
			i = indexOfObj(fields, 'id', +id);

		if(i === -1){
			return undefined;
		}

		return fields[i];
	};

	QBTable.prototype.getFields = function(){
		return this._data.fields;
	};

	QBTable.prototype.getNRecords = function(){
		return this._data.records.length;
	};

	QBTable.prototype.getOptions = function(options){
		return this._options;
	};

	QBTable.prototype.getQuery = function(query){
		return this._query;
	};

	QBTable.prototype.getSList = function(slist){
		return this._slist;
	};

	QBTable.prototype.getTableName = function(){
		return this._data.name;
	};

	QBTable.prototype.getRecord = function(value, fieldName, returnIndex){
		var records = this.getRecords(),
			i = -1;

		records.some(function(record, o){
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

	QBTable.prototype.getRecords = function(){
		return this._data.records;
	};

	QBTable.prototype.load = function(localQuery){
		var that = this,
			dbid = this.getDBID(),
			fids = this.getFids();

		return this._qb.api('API_DoQuery', {
			dbid: dbid,
			query: [].concat(localQuery || [], this.getQuery()).join('AND'),
			clist: Object.keys(fids).map(function(fid){
				return fids[fid];
			}),
			slist: this.getSList(),
			options: this.getOptions(),
			includeRids: true
		}).then(function(results){
			that._data = results.table;

			that._data.records = that._data.records.map(function(record){
				var newRecord = new QBRecord({
					quickbase: that._qb,
					dbid: dbid,
					fids: fids,
					recordid: record.rid
				});

				Object.keys(fids).forEach(function(fid){
					newRecord.set(fid, record[fids[fid]]);
				});

				newRecord._fields = that._data.fields;

				return newRecord;
			});

			return that;
		});
	};

	QBTable.prototype.save = function(individually){
		var that = this;

		if(individually){
			return QuickBase.Promise.map(this.getRecords(), function(record){
				return record.save();
			}).then(function(){
				return that;
			});
		}

		var fids = this.getFids(),
			names = Object.keys(fids),
			records = this.getRecords(),
			clist = [fids.recordid];

		names.forEach(function(name){
			var id = fids[name],
				field = that.getField(id);

			if(id <= 5 || (field && [
				'summary',
				'virtual',
				'lookup'
			].indexOf(field.mode) !== -1)){
				return;
			}

			clist.push(id);
		});

		var csv = records.reduce(function(csv, record){
			return csv.concat(clist.reduce(function(row, fid){
				var name = that.getFid(fid, true),
					value = record.get(name);

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
		}).then(function(results){
			records.forEach(function(record, i){
				record.set('recordid', results.rids[i].rid);
			});

			return that;
		});
	};

	QBTable.prototype.setDBID = function(dbid){
		this._dbid = dbid;

		this.getRecords().forEach(function(record){
			record.setDBID(dbid);
		});

		return this;
	};

	QBTable.prototype.setFid = function(name, id){
		this._fids[name] = +id;

		this.getRecords().forEach(function(record){
			record.setFid(name, id);
		});

		return this;
	};

	QBTable.prototype.setFids = function(fields){
		var that = this;

		Object.keys(fields).forEach(function(name){
			that.setFid(name, fields[name]);
		});

		return this;
	};

	QBTable.prototype.setOptions = function(options){
		this._options = options;

		return this;
	};

	QBTable.prototype.setQuery = function(query){
		this._query = query;

		return this;
	};

	QBTable.prototype.setSList = function(slist){
		this._slist = slist;

		return this;
	};

	QBTable.prototype.upsertRecord = function(options, autoSave){
		var that = this,
			record = undefined,
			_upsertRecord = function(){
				Object.keys(options).forEach(function(name){
					record.set(name, options[name]);
				});

				record._fields = that._data._fields;
			};

		if(!options){
			options = {};
		}

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

		if(autoSave === true){
			return record.save().then(function(){
				return record;
			});
		}

		return QuickBase.Promise.resolve(record);
	};

	/* Helpers */
	var indexOfObj = function(obj, key, value){
		if(typeof(obj) !== 'object'){
			return -1;
		}

		var result,
			i = 0, l = obj.length,
			o = 0, k = 0;

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

	var setAll = function(arr, value){
		for(var i = 0; i < arr.length; ++i){
			arr[i] = value;
		}

		return arr;
	};

	var val2csv = function(val){
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

			val = val.replace(/\"/g, '""').replace(/\&/g, '&amp;');

			val = '"' + val + '"';
		}

		return val;
	};

	/* Expose Version */
	QBTable.VERSION = [ VERSION_MAJOR, VERSION_MINOR, VERSION_PATCH ].join('.');

	return QBTable;

})();
