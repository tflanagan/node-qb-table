'use strict';

/* Dependencies */
import * as dotenv from 'dotenv';
import ava from 'ava';
import { QuickBase } from 'quickbase';
import { QBTable } from '../qb-table';
import { QBField } from 'qb-field';

/* Tests */
dotenv.config();

const QB_REALM = process.env.QB_REALM!;
const QB_USERTOKEN = process.env.QB_USERTOKEN!;

const qb = new QuickBase({
	server: 'api.quickbase.com',
	version: 'v1',

	realm: QB_REALM,
	userToken: QB_USERTOKEN,
	tempToken: '',

	userAgent: 'Testing',

	connectionLimit: 10,
	connectionLimitPeriod: 1000,
	errorOnConnectionLimit: false,

	proxy: false
});

const qbTable = new QBTable<{
	test: string
}>({
	quickbase: qb
});

let newAppId: string;
let newField: QBField;

ava.serial.after.always('deleteApp()', async (t) => {
	if(!newAppId){
		return t.pass();
	}

	const results = await qb.deleteApp({
		appId: newAppId,
		name: 'Test Node Quick Base Application'
	});

	return t.truthy(results.deletedAppId === newAppId);
});

ava.serial('QuickBase:createApp()', async (t) => {
	const results = await qb.createApp({
		name: 'Test Node Quick Base Application',
		assignToken: true
	});

	newAppId = results.id;
	qbTable.setAppId(newAppId);

	return t.truthy(newAppId && results.name === 'Test Node Quick Base Application');
});
	
ava.serial('saveTable() - create', async (t) => {
	qbTable.set('name', 'Test Table');

	const results = await qbTable.saveTable();

	return t.truthy(qbTable.getTableId() === results.id);
});

ava.serial('upsertField()', async (t) => {
	const results = await qbTable.upsertField({
		fieldType: 'text',
		label: 'Test'
	}, true);

	newField = results;

	qbTable.setFid('test', results.getFid());

	return t.truthy(results.getFid() > 0);
});

ava.serial('upsertRecord()', async (t) => {
	const results = await qbTable.upsertRecord({
		test: 'asdf'
	}, true);

	return t.truthy(results.get('recordid') > 0);
});

ava.serial('QBTable.newRecord', async (t) => {
	const results = QBTable.NewRecord(qbTable, {
		test: 'some value'
	});

	return t.truthy(results.get('test') === 'some value');
});

ava.serial('deleteRecords()', async (t) => {
	const results = await qbTable.deleteRecords();

	return t.truthy(results.numberDeleted > 0);
});

ava.serial('QBField:delete()', async (t) => {
	const oldFid = newField.getFid();

	const results = await newField.delete();

	return t.truthy(results.deletedFieldIds[0] === oldFid);
});

ava.serial('delete()', async (t) => {
	const oldDbid = qbTable.getTableId();

	const results = await qbTable.delete();

	return t.truthy(results.deletedTableId === oldDbid);
});
