# QBTable
========

A lightweight abstraction layer for QuickBase

### Initialization
--------------

```js
var table = new QBTable({
	quickbase: {
		realm: '',
		appToken: ''
	},
	// quickbase: QuickBase Instance
	dbid: '' // defaults to dbid in url if found
	query: '',
	fids: {
		recordid: 3,
		primaryKey: 3,
		...
	},
	slist: '',
	options: ''
});
```

### Methods
-------
#### `.clear()`
This method clears the QBTable instance of any trace of existing data,
but preserves defined settings

#### `.deleteRecord(record)`
 - `record`: QBRecord, required

Removes the passed in QBRecord, `record`, instance from the local cache. If the
QBRecord has a Record ID, then it is deleted via API_DeleteRecord

#### `.deleteRecords(individually)`
 - `individually`: boolean, defaults to false

If `individually` is `true`, then it executes and API_DeleteRecord for each
locally loaded QBRecord.
If `individually` is `false`, then it executes an API_PurgeRecords for all of
the locally loaded QBRecord's.

#### `.getAppID()`
This method returns the stored App ID.

#### `.getDBID()`
This method returns the stored DBID.

#### `.getFid(field, byId)`
 - `field`: string or integer, required
 - `byId`: boolean, default: `true`

If `byId` is `true`, then this returns the Field Id of the passed in `field`
(string).
If `byId` is `false`, then this returns the Field Name of the passed in `field`
(integer).

#### `.getFids()`
Returns the configured `fids` object.

#### `.getField(id)`
 - `id`: integer, required

If a DoQuery has been loaded, then returns the field object from the DoQuery
with the Field ID of `id`.

#### `.getFields()`
If a DoQuery has been loaded, then returns the `fields` object from the
DoQuery.

#### `.getNRecords()`
If `.load()` has been executed, returns the number of loaded records.

#### `.getOptions()`
Returns the configured `options`.

#### `.getQuery()`
Returns the configured `query`.

#### `.getRecord(value, fieldName, returnIndex)`
 - `value`: mixed, required
 - `fieldName`: string, required
 - `returnIndex`: boolean, default: `false`

Find a specific record in the locally loaded QBRecords where `fieldName` is
equal to `value`.

If `returnIndex` is true, then it returns the index of the internal array for
that record.
If `returnIndex` is false, then it returns the QBRecord instance.

#### `.getRecords()`
If a `.load()` has been executed, return the loaded QBRecords;

#### `.getSList()`
Returns the configured `slist`.

#### `.getTableName()`
If `.load()` or `.loadSchema()` has been executed, returns the table name.

#### `.getVariable(name)`
 - `name`: string, required

If `.load()` or `.loadSchema()` has been executed, returns defined requested
variable.

#### `.getVariables()`
If `.load()` or `.loadSchema()` has been executed, returns defined variables.

#### `.load(localQuery, localClist, localSlist, localOptions)`
 - `localQuery`: string
 - `localClist`: string
 - `localSlist`: string
 - `localOptions`: string

This method executes an API_DoQuery. Will automatically map all values defined
in the `fids` or `localClist` object.

If `localQuery` is defined, it will be appended to the defined table query.
If `localClist` is defined, this will be used instead of the defined `fids`.
If `localSlist` is defined, this will be used instead of the defined `slist`.
if `localOptions` is defined, this will be used instead of the defined
`options`.

#### `.loadNRecords(localQuery)`
 - `localQuery`: string

This method executes an API_DoQueryCount.

If `localQuery` is defined, it will be appended to the defined table query.

#### `.loadSchema()`
Executes an API_GetSchema and stores the returned results internally.

#### `.save(individually, fidsToSave)`
 - `individually`: boolean, defaults to false
 - `fidsToSave`: array, defaults to undefined

If `individually` is `true`, then it executes an API_AddRecord or
API_EditRecord for each locally loaded QBRecord.
If `individually` is `false`, then it executes an API_ImportFromCSV which
includes every locally loaded QBRecord.

If `fidsToSave` is defined, then only configured fids in this array will be
saved.

If this adds a new record to the table, the newly assigned Record ID is
automatically stored internally. If the defined primaryKey FID is also a
defined field in the `fids` object, then this is also automatically stored
internally.

#### `.setDBID(dbid)`
 - `dbid`: string, required

Sets the `dbid` setting.

#### `.setFid(name, id)`
 - `name`: string, required
 - `id`: integer, required

Adds/Updates configured field with the name of `name` and the field id of `id`.

#### `.setFids(fields)`
 - `fields`: array, required

`fields` is an array of `.setFid()` arguments.

IE:
```js
table.setFids([
	{ name: 'label', id: 6 },
	{ name: 'total', id: 7 }
]);
```

#### `.setOptions(options)`
 - `options`: string, required

Sets the internally stored `options` as `options`.

#### `.setQuery(query)`
 - `query`: string, required

Sets the internally stored `query` as `query`.

#### `.setSList(slist)`
 - `slist`: string, required

Sets the internally stored `slist` as `slist`.

#### `.upsertField(options, autoSave)`
 - `options`: obj, required
 - `autoSave`: boolean, default: `true`

Inserts the passed in `options` as a new QBRecord instance in the interal
records array. If the `options` object has a `recordid` key and value pair,
and a QBRecord instance with the same value exists, then it will update the
internally stored QBRecord rather than inserting a new one.

If `autoSave` is `true`, then it will execute an API_AddField if no fid is
defined, then an API_EditFieldProperties, and if required an
API_FieldAddChoices and/or API_FieldRemoveChoices.

#### `.upsertFields(fields, autoSave)`
 - `fields`: arr, required
 - `autoSave`: boolean, default: `true`

Inserts the passed in `fields` as new QBField instances in the interal
fields array. If the `field` objects withing `fields` has a `fid` or `id` key
and value pair, and a QBField instance with the same value exists, then it
will update the internally stored QBField rather than inserting a new one.

If `autoSave` is `true`, then it will execute, for each `field`, an
API_AddField if no fid is defined, then an API_EditFieldProperties, and if
required an API_FieldAddChoices and/or API_FieldRemoveChoices.

#### `.upsertRecord(options, autoSave)`
 - `options`: obj, required
 - `autoSave`: boolean, default: `false`

Inserts the passed in `options` as a new QBRecord instance in the interal
records array. If the `options` object has a `recordid` key and value pair,
and a QBRecord instance with the same value exists, then it will update the
internally stored QBRecord rather than inserting a new one.

If `autoSave` is `true`, then it will execute an API_AddRecord or
API_EditRecord.

#### `.upsertRecords(records, autoSave, individually)`
 - `records`: arr, required
 - `autoSave`: boolean, default: `false`
 - `individually`: boolean, defaults to false

Inserts the passed in `records` as new QBRecord instances in the interal
records array. If the `record` objects withing `records` has a `recordid` key
and value pair, and a QBRecord instance with the same value exists, then it
will update the internally stored QBRecord rather than inserting a new one.

If `autoSave` is `true`, then it will execute an API_AddRecord or
API_EditRecord or API_ImportFromCSV depending on `individually`.

If `individually` is `true`, then it executes an API_AddRecord or
API_EditRecord for each locally loaded QBRecord.
If `individually` is `false`, then it executes an API_ImportFromCSV which
includes every locally loaded QBRecord.

### Static Methods
-------
#### `QBTable.NewRecord(table, options)`
 - `table`: QBTable, required
 - `options`: obj, required

Returns a new QBRecord instance built off of `options`, that inherits
configuration data from the passed in `QBTable`, `table` argument.
