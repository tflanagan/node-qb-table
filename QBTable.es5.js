'use strict';

/* Versioning */

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var VERSION_MAJOR = 0;
var VERSION_MINOR = 7;
var VERSION_PATCH = 0;

/* Dependencies */
var merge = require('lodash.merge');
var QBRecord = require('qb-record');
var QuickBase = require('quickbase');

/* Default Settings */
var defaults = {
	quickbase: {
		realm: window ? window.location.host.split('.')[0] : '',
		appToken: ''
	},

	dbid: function () {
		if (!window) {
			return '';
		}

		var dbid = window.location.pathname.match(/^\/db\/(?!main)(.*)$/);

		return dbid ? dbid[1] : '';
	}(),
	query: '',
	fids: {
		recordid: 3,
		primaryKey: 3
	},
	slist: '',
	options: ''
};

/* Main Class */

var QBTable = function () {
	function QBTable(options) {
		_classCallCheck(this, QBTable);

		this._dbid = '';
		this._query = '';
		this._fids = {};
		this._slist = '';
		this._options = '';
		this._data = {
			records: []
		};

		if (options && options.quickbase instanceof QuickBase) {
			this._qb = options.quickbase;

			delete options.quickbase;
		}

		var settings = merge({}, QBTable.defaults, options || {});

		this.setDBID(settings.dbid).setQuery(settings.query).setFids(settings.fids).setSList(settings.slist).setOptions(settings.options);

		if (!this._qb) {
			this._qb = new QuickBase(settings.quickbase);
		}

		return this;
	}

	_createClass(QBTable, [{
		key: 'clear',
		value: function clear() {
			this._data = {
				records: []
			};

			return this;
		}
	}, {
		key: 'deleteRecord',
		value: function deleteRecord(record) {
			var _this = this;

			var i = -1;

			this.getRecords().some(function (r, o) {
				if (record._id === r._id) {
					i = o;

					return true;
				}

				return false;
			});

			if (i === -1) {
				return QuickBase.Promise.resolve();
			}

			record = this._data.records.splice(i, 1)[0];

			if (record.get('recordid')) {
				return record.delete().then(function (results) {
					return _this;
				}).catch(function (err) {
					_this._data.records.push(record);

					throw err;
				});
			}

			return QuickBase.Promise.resolve();
		}
	}, {
		key: 'deleteRecords',
		value: function deleteRecords(individually) {
			var _this2 = this;

			if (individually) {
				return QuickBase.Promise.map(this.getRecords(), function (record) {
					return _this2.deleteRecord(record);
				});
			}

			var records = this._data.records.splice(0, this.getNRecords());

			return this._qb.api('API_PurgeRecords', {
				dbid: this.getDBID(),
				query: this.getQuery()
			}).then(function () {
				return _this2;
			}).catch(function (err) {
				_this2._data.records = _this2._data.records.concat(records);

				throw err;
			});
		}
	}, {
		key: 'getDBID',
		value: function getDBID() {
			return this._dbid;
		}
	}, {
		key: 'getFid',
		value: function getFid(field, byId) {
			var fids = this.getFids();
			var id = -1;

			if (byId !== true) {
				if (fids.hasOwnProperty(field)) {
					id = fids[field];
				}
			} else {
				field = +field;

				Object.keys(fids).some(function (name) {
					if (fids[name] === field) {
						id = name;

						return true;
					}

					return false;
				});
			}

			return id;
		}
	}, {
		key: 'getFids',
		value: function getFids() {
			return this._fids;
		}
	}, {
		key: 'getField',
		value: function getField(id) {
			var fields = this.getFields();
			var i = indexOfObj(fields, 'id', +id);

			if (i === -1) {
				return undefined;
			}

			return fields[i];
		}
	}, {
		key: 'getFields',
		value: function getFields() {
			return this._data.fields;
		}
	}, {
		key: 'getNRecords',
		value: function getNRecords() {
			return this._data.records.length;
		}
	}, {
		key: 'getOptions',
		value: function getOptions() {
			return this._options;
		}
	}, {
		key: 'getQuery',
		value: function getQuery() {
			return this._query;
		}
	}, {
		key: 'getRecord',
		value: function getRecord(value, fieldName, returnIndex) {
			var records = this.getRecords();
			var i = -1;

			records.some(function (record, o) {
				if (record.get(fieldName) !== value) {
					return false;
				}

				i = o;

				return true;
			});

			if (returnIndex) {
				return i;
			} else if (i === -1) {
				return undefined;
			}

			return records[i];
		}
	}, {
		key: 'getRecords',
		value: function getRecords() {
			return this._data.records;
		}
	}, {
		key: 'getSList',
		value: function getSList() {
			return this._slist;
		}
	}, {
		key: 'getTableName',
		value: function getTableName() {
			return this._data.name;
		}
	}, {
		key: 'getVariable',
		value: function getVariable(name) {
			return this._data.variables[name];
		}
	}, {
		key: 'getVariables',
		value: function getVariables() {
			return this._data.variables;
		}
	}, {
		key: 'load',
		value: function load(localQuery) {
			var _this3 = this;

			var dbid = this.getDBID();
			var fids = this.getFids();

			return this._qb.api('API_DoQuery', {
				dbid: dbid,
				query: [].concat(localQuery || [], this.getQuery()).join('AND'),
				clist: Object.keys(fids).map(function (fid) {
					return fids[fid];
				}),
				slist: this.getSList(),
				options: this.getOptions(),
				includeRids: true
			}).then(function (results) {
				_this3._data = results.table;

				_this3._data.records = _this3._data.records.map(function (record) {
					var newRecord = new QBRecord({
						quickbase: _this3._qb,
						dbid: dbid,
						fids: fids,
						recordid: record.rid
					});

					Object.keys(fids).forEach(function (fid) {
						newRecord.set(fid, record[fids[fid]]);
					});

					newRecord._fields = _this3._data.fields;

					return newRecord;
				});

				return _this3.getRecords();
			});
		}
	}, {
		key: 'loadSchema',
		value: function loadSchema() {
			var _this4 = this;

			return this._qb.api('API_GetSchema', {
				dbid: this.getDBID()
			}).then(function (results) {
				var records = _this4._data.records;

				_this4._data = results.table;

				_this4._data.records = records;

				return _this4.getFields();
			});
		}
	}, {
		key: 'save',
		value: function save(individually) {
			var _this5 = this;

			if (individually) {
				return QuickBase.Promise.map(this.getRecords(), function (record) {
					return record.save();
				}).then(function () {
					return _this5;
				});
			}

			var fids = this.getFids();
			var names = Object.keys(fids);
			var records = this.getRecords();

			var clist = [fids.recordid];

			names.forEach(function (name) {
				var id = fids[name];
				var field = _this5.getField(id);

				if (id <= 5 || field && ['summary', 'virtual', 'lookup'].indexOf(field.mode) !== -1) {
					return;
				}

				clist.push(id);
			});

			var csv = records.reduce(function (csv, record) {
				return csv.concat(clist.reduce(function (row, fid) {
					var name = _this5.getFid(fid, true);
					var value = record.get(name);

					if (value === null) {
						value = '';
					}

					return row.concat(val2csv(value));
				}, []).join(','));
			}, []).join('\n');

			if (csv.length === 0) {
				return QuickBase.Promise.resolve();
			}

			return this._qb.api('API_ImportFromCSV', {
				dbid: this.getDBID(),
				clist: clist,
				records_csv: csv
			}).then(function (results) {
				var now = Date.now();

				records.forEach(function (record, i) {
					if (fids.dateCreated && !record.get('recordid')) {
						record.set('dateCreated', now);
					}

					record.set('recordid', results.rids[i].rid);

					if (fids.dateModified) {
						record.set('dateModified', now);
					}
				});

				return _this5;
			});
		}
	}, {
		key: 'setDBID',
		value: function setDBID(dbid) {
			this._dbid = dbid;

			this.getRecords().forEach(function (record) {
				record.setDBID(dbid);
			});

			return this;
		}
	}, {
		key: 'setFid',
		value: function setFid(name, id) {
			this._fids[name] = +id;

			this.getRecords().forEach(function (record) {
				record.setFid(name, id);
			});

			return this;
		}
	}, {
		key: 'setFids',
		value: function setFids(fields) {
			var _this6 = this;

			Object.keys(fields).forEach(function (name) {
				_this6.setFid(name, fields[name]);
			});

			return this;
		}
	}, {
		key: 'setOptions',
		value: function setOptions(options) {
			this._options = options;

			return this;
		}
	}, {
		key: 'setQuery',
		value: function setQuery(query) {
			this._query = query;

			return this;
		}
	}, {
		key: 'setSList',
		value: function setSList(slist) {
			this._slist = slist;

			return this;
		}
	}, {
		key: 'upsertRecord',
		value: function upsertRecord(options, autoSave) {
			var _this7 = this;

			var record = undefined;

			if (!options) {
				options = {};
			}

			if (options instanceof QBRecord) {
				record = options;

				this._data.records.push(record);
			} else {
				var _upsertRecord = function _upsertRecord() {
					Object.keys(options).forEach(function (name) {
						record.set(name, options[name]);
					});

					record._fields = _this7._data._fields;
				};

				if (options.recordid) {
					record = this.getRecord(options.recordid, 'recordid');
				} else if (options.primaryKey) {
					record = this.getRecord(options.primaryKey, 'primaryKey');
				}

				if (record) {
					_upsertRecord();
				} else {
					record = new QBRecord({
						quickbase: this._qb,
						dbid: this.getDBID(),
						fids: this.getFids()
					});

					_upsertRecord();

					this._data.records.push(record);
				}
			}

			if (autoSave === true) {
				return record.save().then(function () {
					return record;
				});
			}

			return QuickBase.Promise.resolve(record);
		}
	}]);

	return QBTable;
}();

/* Expose Static Methods */


QBTable.NewRecord = function (table, options) {
	var record = new QBRecord({
		quickbase: table._qb,
		dbid: table.getDBID(),
		fids: table.getFids()
	});

	Object.keys(options).forEach(function (name) {
		record.set(name, options[name]);
	});

	return record;
};

/* Expose Properties */
QBTable.defaults = defaults;

/* Helpers */
var indexOfObj = function indexOfObj(obj, key, value) {
	if ((typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) !== 'object') {
		return -1;
	}

	var result = void 0,
	    i = 0,
	    o = 0,
	    k = 0;
	var l = obj.length;

	for (; i < l; ++i) {
		if ((typeof key === 'undefined' ? 'undefined' : _typeof(key)) === 'object') {
			result = new Array(key.length);
			result = setAll(result, false);

			for (o = 0, k = result.length; o < k; ++o) {
				if (obj[i][key[o]] === value[o]) {
					result[o] = true;
				}
			}

			if (result.indexOf(false) === -1) {
				return i;
			}
		} else {
			if (obj[i][key] === value) {
				return i;
			}
		}
	}

	return -1;
};

var setAll = function setAll(arr, value) {
	for (var i = 0; i < arr.length; ++i) {
		arr[i] = value;
	}

	return arr;
};

var val2csv = function val2csv(val) {
	if (!val) {
		return val;
	}

	if (typeof val === 'boolean') {
		val = val ? 1 : 0;
	}

	if (typeof val !== 'number' && (isNaN(val) || !isFinite(val) || val.match(/e/))) {
		if (val.match(/e/)) {
			val = val.toString();
		}

		val = val.replace(/\"/g, '""');

		val = '"' + val + '"';
	}

	return val;
};

/* Expose Version */
QBTable.VERSION = [VERSION_MAJOR, VERSION_MINOR, VERSION_PATCH].join('.');

/* Export Module */
if (typeof module !== 'undefined' && module.exports) {
	module.exports = QBTable;
} else if (typeof define === 'function' && define.amd) {
	define('QBTable', [], function () {
		return QBTable;
	});
}

if (typeof global !== 'undefined' && typeof window !== 'undefined' && global === window) {
	global.QBTable = QBTable;
}

