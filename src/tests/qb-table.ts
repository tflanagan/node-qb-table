'use strict';

/* Dependencies */
import * as dotenv from 'dotenv';
import { serial as test } from 'ava';
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

const qbTable = new QBTable({
	quickbase: qb
});

let newAppId: string;
let newField: QBField;

test.after.always('deleteApp()', async (t) => {
	if(!newAppId){
		return t.pass();
	}

	const results = await qb.deleteApp({
		appId: newAppId,
		name: 'Test Node Quick Base Application'
	});

	t.truthy(results.deletedAppId === newAppId);
});

test('QuickBase:createApp()', async (t) => {
	const results = await qb.createApp({
		name: 'Test Node Quick Base Application',
		assignToken: true
	});

	newAppId = results.id;
	qbTable.setAppId(newAppId);

	t.truthy(newAppId && results.name === 'Test Node Quick Base Application');
});
	
test('saveTable() - create', async (t) => {
	qbTable.set('name', 'Test Table');

	const results = await qbTable.saveTable();

	t.truthy(qbTable.getDBID() === results.id);
});

test('upsertField()', async (t) => {
	const results = await qbTable.upsertField({
		fieldType: 'text',
		label: 'Test'
	}, true);

	newField = results;

	qbTable.setFid('test', results.getFid());

	t.truthy(results.getFid() > 0);
});

test('upsertRecord()', async (t) => {
	const results = await qbTable.upsertRecord({
		test: 'Test'
	}, true);

	t.truthy(results.get('recordid') > 0);
});

test('deleteRecords()', async (t) => {
	const results = await qbTable.deleteRecords();

	t.truthy(results.numberDeleted > 0);
});

test('QBField:delete()', async (t) => {
	const oldFid = newField.getFid();

	const results = await newField.delete();

	t.truthy(results.deletedFieldIds[0] === oldFid);
});

test('delete()', async (t) => {
	const oldDbid = qbTable.getDBID();

	const results = await qbTable.delete();

	t.truthy(results.deletedTableId === oldDbid);
});
