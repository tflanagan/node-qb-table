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
	test: string;
	test2: number;
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

ava.serial('saveRecords()', async (t) => {
	// Test if the order we provide the records in matches the order returned by Quickbase
	const record1 = await qbTable.upsertRecord({
		test: 'Record 1'
	}, true);
	const record2 = await qbTable.upsertRecord({
		test: 'Record 2'
	}, true);
	const record3 = await qbTable.upsertRecord({
		test: 'Record 3'
	});
	const record4 = await qbTable.upsertRecord({
		test: 'Record 4'
	}, true);
	const record5 = await qbTable.upsertRecord({
		test: 'Record 5'
	}, true);
	const record6 = await qbTable.upsertRecord({
		test: 'Record 6'
	}, true);
	const record7 = await qbTable.upsertRecord({
		test: 'Record 7'
	});

	const r1Rid = record1.get('recordid');
	const r2Rid = record2.get('recordid');
	const r4Rid = record4.get('recordid');
	const r5Rid = record5.get('recordid');
	const r6Rid = record6.get('recordid');

	record2.set('test', 'Record 2 Changed');
	record4.set('test', 'Record 4 Changed');

	await qbTable.saveRecords({
		recordsToSave: [
			record5,
			record6,
			record4,
			record1,
			record2,
			record3,
			record7
		]
	});

	t.log('record 1', record1.get('recordid'), r1Rid);
	t.log('record 2', record2.get('recordid'), r2Rid);
	t.log('record 3', record3.get('recordid'));
	t.log('record 4', record4.get('recordid'), r4Rid);
	t.log('record 5', record5.get('recordid'), r5Rid);
	t.log('record 6', record6.get('recordid'), r6Rid);
	t.log('record 7', record7.get('recordid'));

	return t.truthy(
		record1.get('recordid') === r1Rid
		&&
		record2.get('recordid') === r2Rid
		&&
		record3.get('recordid') > r6Rid && record3.get('recordid') < record7.get('recordid')
		&&
		record4.get('recordid') === r4Rid
		&&
		record5.get('recordid') === r5Rid
		&&
		record6.get('recordid') === r6Rid
		&&
		record7.get('recordid') > r6Rid && record7.get('recordid') > record3.get('recordid')
	);
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
