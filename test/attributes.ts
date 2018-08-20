
'use strict';

import { expect } from 'chai';
import * as debug from 'debug';
import * as dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import { v4 } from 'uuid';
import { ModelOrPromise, Store } from '../src';
import { Blog } from './models';
import { resetFirebase, testData } from './test-data';

// tslint:disable:no-unused-expression

// tslint:disable:mocha-no-side-effect-code
const basePath = process.env.BASE_PATH ? process.env.BASE_PATH as string : undefined;

async function createBlog(): Promise<void> {

    await resetFirebase(basePath);
    const store: Store = new Store(admin.database(), { basePath });

    const blog: Blog = store.createRecord(Blog, {
        id: testData.blog[1].id,
        name: testData.blog[1].name,
        published: false,
    });

    await blog.save();
}

describe('Attribute Tests', function (): void {

    // Allow longer for the tests to run, in case of slow network access to firebase etc
    // tslint:disable-next-line:no-invalid-this
    this.timeout(15000);

    before(async () => await resetFirebase(basePath));
    after(async () => await resetFirebase(basePath));

    before(async () => {

        /**
         * Reset the data in firebase before starting
         */

        await resetFirebase(basePath);

    });

    it('should create blog', async () => {

        /**
         * Creates a new blog record, saves it in Firebase and verifies that defaultValue and setServerTimestampOnSave
         * options are successfully applied
         */

        const store: Store = new Store(admin.database(), { basePath });

        const testStartTime = new Date();
        testStartTime.setMilliseconds(0); // Date will lose millisecond resolution when saved

        const blog: Blog = store.createRecord(Blog, {
            id: testData.blog[1].id,
            name: testData.blog[1].name,
        });
        expect(blog.id, 'Blog id is blog id').to.equal(testData.blog[1].id);
        expect(blog.name, 'Blog name is blog name').to.equal(testData.blog[1].name);

        // Created date should default to the current time
        expect(blog.createdDate.getTime(), 'Blog created time is greater than the test start time').to.be.at.least(testStartTime.getTime());

        // Updated time should start as 'null'
        expect(blog.updatedTime, 'Blog updated time is null').to.be.an('null');

        // Save the record
        await blog.save();

        // Verified the saved values in firebase
        const blog1Name = await blog.rawFirebaseValue('name');
        // Name should the string value set
        expect(blog1Name, 'Name of blog in firebase is blog name').to.equal(testData.blog[1].name);

        // The createdDate should be set to the current time automatically
        const createdDate = await blog.rawFirebaseValue('createdDate');
        expect(new Date(Date.parse(createdDate)).getTime(), 'remote created date is current time').to.be.at.least(testStartTime.getTime());

        store.unloadAll();

    });

    it('should have set an updatedTime on the record when saved', async () => {

        /**
         * Checks that the setServerTimestampOnSave applied successfully
         */

        // Check via the store
        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);
        // Check against a fixed unix time here as a local time / server time offset might cause the test to fail if we rely on an accurate local time
        expect(blog.updatedTime, 'updated time in retrieved record').to.be.greaterThan(1500000000000);

        // Check firebase directly
        const updatedTime = await blog.rawFirebaseValue('updatedTime');
        expect(updatedTime, 'updated time in firebase').to.be.greaterThan(1500000000000);

        store.unloadAll();
    });

    it('should not update existing value with defaultValue if already set', async () => {

        /**
         * Sets the time stamp on the new 'blog' created record to a specific value
         * Then retrieves it, verifies it and saves the record again
         *
         * This ensures that the defaultValue is not overriding the existing value
         */

        // Set the value in Firebase
        const path = `${basePath}/blogs/${testData.blog[1].id}`;

        const testDateString = 'Sat, 01 Jan 2000 00:00:00 GMT';
        const testDateInteger = 946684800000;

        await admin.database().ref(path).update({ createdDate: testDateString });

        // Retrieve the record
        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);
        // Verify it is retrieved correctly
        expect(blog.createdDate.getTime()).to.equal(testDateInteger);

        // Save the record
        await blog.save();
        // Verify it is saved correctly - I.e. no update to the date
        const createdDate = await blog.rawFirebaseValue('createdDate');
        expect(createdDate).to.equal(testDateString);

        // Set a new value on the record
        const testUpdatedDateString = 'Mon, 01 Jan 2001 00:00:00 GMT';

        blog.createdDate = new Date(Date.parse(testUpdatedDateString));
        await blog.save();
        // Confirm it was saved correctly
        const updatedCreatedDate = await blog.rawFirebaseValue('createdDate');
        expect(updatedCreatedDate).to.equal(testUpdatedDateString);

        store.unloadAll();
    });

    it('should handle null values', async () => {

        /**
         * Firebase does not have 'null' values (the key is removed) so ninjafire
         * will return 'null' for schema attributes that have no value in firebase
         *
         * It then sets the null value and then clears it again, checking the value in firebase
         */

        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);
        expect(blog.description, 'description is null').to.be.a('null');

        blog.description = 'test-description';

        await blog.save();
        expect(blog.description, 'description is test description').to.equal('test-description');

        blog.description = null;
        await blog.save();
        expect(blog.description, 'description is null again').to.be.a('null');

        const description = await blog.rawFirebaseValue('description');
        expect(description, 'description in firebase is undefined').to.be.an('undefined');

        store.unloadAll();
    });

    it('should throw when setting a string attribute to a non string value', async () => {

        /**
         * Tries to set a string attribute to a boolean
         */

        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);
        // tslint:disable-next-line:no-any
        expect(() => { blog.name = true as any as string; }).to.throw('expected string');

        store.unloadAll();
    });

    it('should throw when a non string value is found in Firebase for a string attribute', async () => {

        /**
         * Simulates receiving a non string value from Firebase when a string was expected
         */

        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);
        // Using setAttributesFrom simulates receiving data from Firebase
        blog.setAttributesFrom({
            name: true,
        });
        expect(() => { blog.name; }).to.throw('expected string');

        store.unloadAll();
    });


    it('should should serialize JSON', async () => {

        /**
         * Sets the config attribute on the blog entry to a simple object
         * saves it and ensures it is set correctly in firebase
         */

        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);

        const jsonTestData = {
            aKey: 'A VALUE',
            bKey: {
                bSubKey: 'ANOTHER VALUE',
            },
        };

        blog.config = testData;
        await blog.save();

        const config = await blog.rawFirebaseValue('config');
        expect(config, 'Firebase value matches stringified JSON').to.equal(JSON.stringify(testData));

        store.unloadAll();
    });

    it('should should deserialize JSON', async () => {

        /**
         * Retrieves the config property set in the previous test
         */

        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);

        const jsonTestData = {
            aKey: 'A VALUE',
            bKey: {
                bSubKey: 'ANOTHER VALUE',
            },
        };

        expect(JSON.stringify(blog.config), 'parsed JSON matches original object').to.equal(JSON.stringify(testData));

        store.unloadAll();
    });

    it('should throw when setting a JSON attribute to a non string value', async () => {

        /**
         * Tries to set a json attribute to a boolean
         */

        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);
        // tslint:disable-next-line:no-any
        expect(() => { blog.config = true as any; }).to.throw('serializing true got boolean but expected object');

        store.unloadAll();
    });

    it('should throw when a non string value is found in Firebase for a JSON attribute', async () => {

        /**
         * Simulates receiving a non string value from Firebase when a string was expected
         */

        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);
        // Using setAttributesFrom simulates receiving data from Firebase
        blog.setAttributesFrom({
            config: true,
        });
        expect(() => { blog.config; }).to.throw('expected string');

        store.unloadAll();
    });



    it('should save boolean attributes', async () => {

        /**
         * Set boolean values and confirm they are saved in firebase
         */

        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);
        blog.published = true;
        blog.featured = false;

        expect(blog.published, 'blog published').to.be.true;
        expect(blog.featured, 'blog not featured').to.be.false;

        await blog.save();

        const publishedInFirebase = await blog.rawFirebaseValue('published');
        const featuredInFirebase = await blog.rawFirebaseValue('featured');
        expect(publishedInFirebase, 'blog published').to.be.true;
        expect(featuredInFirebase, 'blog not featured').to.be.false;

        store.unloadAll();
    });

    it('should retrieve boolean attributes', async () => {

        /**
         * Check the boolean values set in the previous test can be retrieved
         */

        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);

        expect(blog.published, 'blog published').to.be.true;
        expect(blog.featured, 'blog not featured').to.be.false;

        store.unloadAll();
    });

    it('should throw when setting a boolean attribute to a non boolean value', async () => {

        /**
         * Tries to set a boolean value to a string
         */

        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);
        // tslint:disable-next-line:no-any
        expect(() => { blog.published = 'not-a-boolean' as any as boolean; }).to.throw('expected boolean');

        store.unloadAll();
    });

    it('should throw when a non boolean value was found Firebase for a boolean attribute', async () => {

        /**
         * Simulates receiving a non boolean value from Firebase when a boolean was expected
         */

        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);
        // Using setAttributesFrom simulates receiving data from Firebase
        blog.setAttributesFrom({
            published: 'not-a-boolean',
        });
        expect(() => { blog.published; }).to.throw('expected boolean');

        store.unloadAll();
    });


    it('should save numbers', async () => {

        /**
         * Save number attributes
         */

        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);
        blog.ranking = 42;

        expect(blog.ranking, 'ranking set').to.equal(42);

        await blog.save();

        const rankingInFirebase = await blog.rawFirebaseValue('ranking');
        expect(rankingInFirebase, 'ranking set in Firebase').to.equal(42);

        store.unloadAll();
    });

    it('should retrieve numbers', async () => {

        /**
         * Check the attributes set in the above test can be retrieved
         */

        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);

        expect(blog.ranking, 'ranking retrieved').to.equal(42);

        store.unloadAll();
    });

    it('should throw when setting a number attribute to a non number value', async () => {

        /**
         * Tries to set a number attribute to a string
         */

        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);
        // tslint:disable-next-line:no-any
        expect(() => { blog.ranking = 'not-a-number' as any as number; }).to.throw('expected number');

        store.unloadAll();
    });

    it('should throw when a non number value is found in Firebase for a number attribute', async () => {

        /**
         * Simulates receiving a non boolean value from Firebase when a boolean was expected
         */

        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);
        // Using setAttributesFrom simulates receiving data from Firebase
        blog.setAttributesFrom({
            ranking: 'not-a-number',
        });
        expect(() => { blog.ranking; }).to.throw('expected number');

        store.unloadAll();
    });


    it('should serialize numbers to dates for date attributes', async () => {

        /**
         * If a number is passed to a date is should be serialized to a date
         */

        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);

        const testDateString = 'Sat, 01 Jan 2000 00:00:00 GMT';
        const testDateInteger = 946684800000;

        // tslint:disable-next-line:no-any
        blog.createdDate = testDateInteger as any; // Typescript will prevent assigning a number but a JS application might do

        blog.save();

        const createdDate = await blog.rawFirebaseValue('createdDate');
        expect(createdDate, 'value in Firebase is date string').to.equal(testDateString);

    });

    it('should pass through strings for date attributes', async () => {

        /**
         * If a number is passed to a date is should be serialized to a date
         */
        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);

        const testDateString = 'Sat, 01 Jan 2000 00:00:00 GMT';

        // tslint:disable-next-line:no-any
        blog.createdDate = testDateString as any; // Typescript will prevent assigning a string but a JS application might do

        blog.save();

        const createdDate = await blog.rawFirebaseValue('createdDate');
        expect(createdDate, 'value in Firebase is date string').to.equal(testDateString);

    });

    it('should convert numbers in firebase to dates for date attributes', async () => {

        /**
         * For 'Date' attributes if a number is provided it should be serialized to a date
         */

        let store: Store = new Store(admin.database(), { basePath });
        let blog: Blog = await store.findRecord(Blog, testData.blog[1].id);

        const testDateInteger = 946684800000;

        await admin.database().ref(blog._path).update({ createdDate: testDateInteger });

        // Retrieve the record from a fresh store
        store = new Store(admin.database(), { basePath });
        blog = await store.findRecord(Blog, testData.blog[1].id);

        expect(blog.createdDate.getTime(), 'Value in model is date').to.equal(testDateInteger);

        store.unloadAll();
    });

    it('should throw when a non string or number value is found in Firebase for a Date attribute', async () => {

        /**
         * Simulates receiving a non string or number value from Firebase when a date was expected
         */

        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);
        // Using setAttributesFrom simulates receiving data from Firebase
        blog.setAttributesFrom({
            createdDate: true,
        });
        expect(() => { blog.createdDate; }).to.throw('expected number or string');

        store.unloadAll();
    });

    it('should rollback unsaved attributes', async () => {

        /**
         * Makes a change to the name of the blog entry then rolls it back
         * Then confirms the value was not saved to firebase or locally
         */

        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);

        blog.name = 'New Name';
        blog.rollbackAttributes();
        await blog.save();

        // Check name in firebase
        const name = await blog.rawFirebaseValue('name');
        expect(name, 'Name in Firebase has not changed').to.equal(testData.blog[1].name);

        // Check name in the store
        expect(blog.name, 'Name in the store has rolled back').to.equal(testData.blog[1].name);

        store.unloadAll();
    });

    it('should mark a rolled back new record as deleted', async () => {

        /**
         * Creates a record then calls rollbackAttributes, this is expected to change the record's isDeleted to true
         */

        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.createRecord(Blog, {
            id: testData.blog[1].id,
            name: testData.blog[1].name,
        });

        blog.rollbackAttributes();

        expect(blog.isDeleted, 'blog is deleted').to.be.true;

        store.unloadAll();
    });


    it('should report the dirtyState of a rolled back new record as `deleted`', async () => {

        /**
         * Creates a record then calls rollbackAttributes, the record should have a dirtyType of deleted, rather than created
         */

        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.createRecord(Blog, {
            id: testData.blog[1].id,
            name: testData.blog[1].name,
        });

        blog.rollbackAttributes();

        expect(blog.dirtyType, 'dirtyType is deleted').to.equal('deleted');

        store.unloadAll();
    });


    it('should provide changed attributes', async () => {

        /**
         * Checks that 'changedAttributes' returns the correct changed attributes
         */

        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);

        blog.name = 'New Name';

        let changedAttributes = blog.changedAttributes();

        expect(changedAttributes).to.be.an('object');
        expect(changedAttributes.name).to.be.an('array');

        const [oldVal, newVal] = changedAttributes.name;

        expect(oldVal, 'old value is original blog name').to.equal(testData.blog[1].name);
        expect(newVal, 'new value is new blog name').to.equal('New Name');

        blog.rollbackAttributes();

        changedAttributes = blog.changedAttributes();

        expect(changedAttributes, 'changed attributes should be empty after rollback').to.be.empty;

        store.unloadAll();
    });

    it('should default `id` to push id if store is not set to use uuid', async () => {

        /**
         * If no id is provided when creating a record it should default to a firebase push id
         *
         * Checked here by checking it is 20 chars long
         *
         * See https://firebase.googleblog.com/2015/02/the-2120-ways-to-ensure-unique_68.html
         * and https://gist.github.com/mikelehen/3596a30bd69384624c11
         */

        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = store.createRecord(Blog, {
            name: testData.blog[1].name,
            published: false,
        });
        expect(blog.id.length, 'id is the length of a Firebase push id').to.equal(20);

        store.unloadAll();
    });

    it('should default `id` to uuid v1 if if store is set to use uuid v1', async () => {

        /**
         * If no id is provided when creating a record it should create a uuid v1 if the store has been initialized with { useUUID: 1 }
         */

        const store: Store = new Store(admin.database(), { basePath, useUUID: 1 });
        const blog: Blog = store.createRecord(Blog, {
            name: testData.blog[1].name,
            published: false,
        });

        const pattern = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;
        expect(pattern.test(blog.id), 'blog is is uuid v1').to.be.true;

        store.unloadAll();
    });


    it('should default `id` to uuid v4 if if store is set to use uuid v4', async () => {

        /**
         * If no id is provided when creating a record it should create a uuid v4 if the store has been initialized with { useUUID: 4 }
         */

        const store: Store = new Store(admin.database(), { basePath, useUUID: 4 });
        const blog: Blog = store.createRecord(Blog, {
            name: testData.blog[1].name,
            published: false,
        });

        const pattern = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;
        expect(pattern.test(blog.id), 'blog is is uuid v4').to.be.true;

        store.unloadAll();
    });

    it('should thrown an exception if an invalid uuid version is requested', async () => {

        /**
         * Only uuid versions 1 and 4 are supported
         */

        const store: Store = new Store(admin.database(), { basePath, useUUID: 9999 });

        let errorWasThrown = false;

        try {
            const blog: Blog = store.createRecord(Blog, {
                name: testData.blog[1].name,
                published: false,
            });
        } catch (e) {
            errorWasThrown = true;
            expect(e).to.be.a('error');
        }

        expect(errorWasThrown, 'error was thrown').to.be.true;

        store.unloadAll();
    });

    it('should proxy `has` to the schema', async () => {

        /**
         * ninjafire records are wrapped in an ES6 proxy. The `has` hook should return true/false based on existence of the key in the schema
         */

        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = store.createRecord(Blog, {
            name: testData.blog[1].name,
            published: false,
        });

        expect('name' in blog, 'name attribute for blog should be found in schema').to.be.true;

        store.unloadAll();
    });

    it('should identify dirty attributes', async () => {

        /**
         * Tests that hasDirtyAttributes and dirtyType return correctly for each state
         */

        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = store.createRecord(Blog, {
            name: testData.blog[1].name,
            published: false,
        });

        expect(blog.hasDirtyAttributes, 'new record has dirty attributes').to.be.true;
        expect(blog.dirtyType, 'new record is dirty type - created').to.equal('created');

        await blog.save();
        expect(blog.hasDirtyAttributes, 'saved record has no dirty attributes').to.be.false;
        expect(blog.dirtyType, 'saved record has null dirty type').to.be.a('null');

        blog.published = true;
        expect(blog.hasDirtyAttributes, 'updated record has dirty attributes').to.be.true;
        expect(blog.dirtyType, 'updated record has updated dirty type').to.equal('updated');

        await blog.save();
        expect(blog.hasDirtyAttributes, 'saved, after update, record has no dirty attributes').to.be.false;
        expect(blog.dirtyType, 'saved, after update, record has null dirty type').to.be.a('null');

        store.unloadAll();
    });

    it('should ignore unknown local attributes', async () => {

        /**
         * When saving a record, if there are any _localAttributes that are not in the schema, they should be ignored.
         * Theoretically attributes should not appear in _localAttributes if they are not in the schema, but in case they do, ignore them!
         */
        await createBlog();
        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);

        blog._localAttributes['ignore-this'] = 'test';
        await blog.save();

        const ignoredAttributeInFirebase = await blog.rawFirebaseValue('ignore-this');
        expect(ignoredAttributeInFirebase, 'attribute not in the schema was not').to.be.a('undefined');

        store.unloadAll();
    });

    it('should ignore unknown remote attributes', async () => {

        /**
         * If there are fields in firebase that are not expected they should be ignored.
         */

        await createBlog();
        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);

        blog.setAttributesFrom({
            id: testData.blog[1].id,
            name: testData.blog[1].name,
            'ignore-this': 'test',
        });

        expect('ignore-this' in blog._remoteAttributes, 'attribute not in the schema but seen in the remote data should be ignored').to.be.false;

        store.unloadAll();
    });

    it('should delete a record', async () => {

        /**
         * Load the blog record then delete it
         */
        await createBlog();
        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);
        await blog.deleteRecord();
        await blog.save();

        // Check the path in firebase is now null
        const path = `${basePath}/blogs/${blog.id}`;
        const blogInFirebase = await admin.database().ref(path).once('value');
        expect(blogInFirebase.val(), 'blog is null in Firebase').to.be.an('null');
        store.unloadAll();

    });

    it('should destroy a record', async () => {

        /**
         * Load the blog record then detroy it
         */
        await createBlog();
        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);
        await blog.destroyRecord();

        // Check the path in firebase is now null
        const path = `${basePath}/blogs/${blog.id}`;
        const blogInFirebase = await admin.database().ref(path).once('value');
        expect(blogInFirebase.val(), 'blog is null in Firebase').to.be.an('null');
        store.unloadAll();

    });

    it('should throw when accessing an attribute on a deleted record', async () => {

        /**
         * Load the blog record then delete it
         */
        await createBlog();
        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);
        await blog.deleteRecord();

        expect(() => { const test = blog.name; }).to.throw('Record is deleted');
        expect(() => { blog.name = 'test'; }).to.throw('Record is deleted');
        store.unloadAll();

    });

    it('should throw when rolling back attributes on a deleted record', async () => {

        /**
         * Rolling back attributes on a deleted record has not yet been implemented
         * Rolling the attributes back would be easy but the relationships also need to be restored
         */
        await createBlog();
        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);
        await blog.deleteRecord();

        expect(() => { blog.rollbackAttributes(); }).to.throw('Rollback of attributes on deleted records has not yet been implemented');
        store.unloadAll();

    });

});
