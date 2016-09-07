# QBTable
========

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
#### `.deleteRecord(record)`
#### `.deleteRecords(individually)`
#### `.getDBID()`
#### `.getFid(field, byId)`
#### `.getFids(field)`
#### `.getField(id)`
#### `.getFields()`
#### `.getNRecords()`
#### `.getOptions(options)`
#### `.getQuery(query)`
#### `.getSList(slist)`
#### `.getTableName()`
#### `.getRecord(value, fieldName, returnIndex)`
#### `.getRecords()`
#### `.load(localQuery)`
#### `.loadSchema()`
#### `.save(individually)`
#### `.setDBID(dbid)`
#### `.setFid(name, id)`
#### `.setFids(fields)`
#### `.setOptions(options)`
#### `.setQuery(query)`
#### `.setSList(slist)`
#### `.upsertRecord(options, autoSave)`

### Static Methods
-------
#### `QBTable.NewRecord(table, options)`
