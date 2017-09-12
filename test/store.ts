
'use strict';

import { expect } from 'chai';
import * as debug from 'debug';
import * as dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import { v4 } from 'uuid';
import { Model, ModelOrPromise, Store } from '../src';
import { Blog, User } from './models';
import { resetFirebase, testData } from './test-data';

// tslint:disable:mocha-no-side-effect-code
const basePath = process.env.BASE_PATH ? process.env.BASE_PATH as string : undefined;

describe('findRecord', function (): void {


    // Allow longer for the tests to run, in case of slow network access to firebase etc
    // tslint:disable-next-line:no-invalid-this
    this.timeout(15000);

    before(async () => await resetFirebase(basePath));
    after(async () => await resetFirebase(basePath));

    it('should find the existing loaded record when performed on a record that was just created', async () => {

        /**
         * Creates a new user, saves it, retrieves it and checks the model is retrieved rather than a promise
         * As the record is already in the store a Promise should not be returned
         */

        const store: Store = new Store(admin.database(), { basePath });

        const blog: Blog = store.createRecord(Blog, {
            id: testData.blog[1].id,
            name: testData.blog[1].name,
            published: false,
        });

        await blog.save();

        const foundBlogOrPromise = store.findRecord(Blog, testData.blog[1].id) as Blog;
        expect(foundBlogOrPromise, 'findRecord returns a Blog').to.be.an.instanceOf(Blog);

        store.unloadAll();
    });

    it('should return a proxy promise for a record that is not yet loaded', async () => {

        /**
         * Perform findRecord for an existing record that is not in the store, checks that a promise is returned
         */

        const store: Store = new Store(admin.database(), { basePath });

        const foundBlogOrPromise = store.findRecord(Blog, testData.blog[1].id) as Blog;
        expect(foundBlogOrPromise, 'findRecord returns a Promise').to.be.an.instanceOf(Promise);

        store.unloadAll();
    });

    it('should return a model for a record that is already loaded', async () => {

        /**
         * Perform findRecord for a record that is already in the store, checks that the record is returned
         */


        const store: Store = new Store(admin.database(), { basePath });

        const firstFind = await store.findRecord(Blog, testData.blog[1].id) as Blog;
        const secondFind = await store.findRecord(Blog, testData.blog[1].id) as Blog;
        expect(secondFind, 'findRecord returns a Blog').to.be.an.instanceOf(Blog);

        store.unloadAll();
    });

    it('should peek a model for a record that is already loaded', async () => {

        /**
         * Retrieves an existing record, the performs a peekRecord to retrieve it again without performing a network request
         */

        const store: Store = new Store(admin.database(), { basePath });

        const find = await store.findRecord(Blog, testData.blog[1].id) as Blog;
        const peek = await store.peekRecord(Blog, testData.blog[1].id) as Blog;
        expect(peek, 'peeked records is a Blog').to.be.an.instanceOf(Blog);
        expect(peek.name, 'peeked record has blog name').to.equal(testData.blog[1].name);

        store.unloadAll();
    });

    it('should unload a record', async () => {

        /**
         * Retrieves an existing record, unloads it and checks it cannot be peeked
         */

        const store: Store = new Store(admin.database(), { basePath });

        const find = await store.findRecord(Blog, testData.blog[1].id) as Blog;
        find.unloadRecord();
        const peek = await store.peekRecord(Blog, testData.blog[1].id) as Blog;
        expect(peek, 'peekedRecord is null after unloading').to.be.a('null');

        store.unloadAll();
    });

    it('should unload all records', async () => {

        /**
         * Retrieves an existing record, unloads all records from the store and checks the originally loaded cannot be peeked
         */

        const store: Store = new Store(admin.database(), { basePath });

        const find = await store.findRecord(Blog, testData.blog[1].id) as Blog;
        store.unloadAll();
        const peek = await store.peekRecord(Blog, testData.blog[1].id) as Blog;
        expect(peek, 'peekedRecord is null after unloading').to.be.a('null');

        store.unloadAll();
    });

    it('should unload all records of one model', async () => {

        /**
         * Retrieves an existing record, unloads all records of that type from the store and checks the originally loaded cannot be peeked
         */

        const store: Store = new Store(admin.database(), { basePath });

        const find = await store.findRecord(Blog, testData.blog[1].id) as Blog;
        store.unloadAll(Blog);
        const peek = await store.peekRecord(Blog, testData.blog[1].id) as Blog;
        expect(peek, 'peekedRecord is null after unloading').to.be.a('null');

        store.unloadAll();
    });

    it('should create a store without a basePath', async () => {

        /**
         * Check that creating a store without any options, results in paths that do not contain any initial prefix
         */

        const store: Store = new Store(admin.database());

        const blog: Blog = store.createRecord(Blog, {
            id: testData.blog[1].id,
            name: testData.blog[1].name,
            published: false,
        });
        expect(blog._path.substr(0, 7), 'blog path does not include any prefix').to.equal('/blogs/');

        store.unloadAll();
    });

    it('should create a store with options but without a basePath', async () => {

        /**
         * Check that creating a store without a basePath option, results in paths that do not contain any initial prefix
         */

        const store: Store = new Store(admin.database(), {});

        const blog: Blog = store.createRecord(Blog, {
            id: testData.blog[1].id,
            name: testData.blog[1].name,
            published: false,
        });
        expect(blog._path.substr(0, 7), 'blog path does not include any prefix').to.equal('/blogs/');

        store.unloadAll();
    });

    it('should allow the same id to be used by different types', async () => {

        /**
         * Creates, saves, and retrieves records of different types but with the same id
         */

        const store: Store = new Store(admin.database(), { basePath });

        const blog: Blog = store.createRecord(Blog, {
            id: testData.blog[1].id,
            name: testData.blog[1].name,
        });

        const user: User = store.createRecord(User, {
            id: testData.blog[1].id, // Use same id as blog
            name: testData.user[1].name,
            blog,
        });

        await user.save();

        const blogName = await blog.rawFirebaseValue('name');
        const userName = await user.rawFirebaseValue('name');

        expect(blogName, 'blog has blog name').to.equal(testData.blog[1].name);
        expect(userName, 'user has user name').to.equal(testData.user[1].name);

    });

    it('should save all dirty records with saveAll', async () => {

        /**
         * Creates two unlinked records, performs a 'saveAll' and checks all records are saved
         */

        const store: Store = new Store(admin.database(), { basePath });

        const blog: Blog = store.createRecord(Blog, {
            id: testData.blog[1].id,
            name: testData.blog[1].name,
        });

        const user: User = store.createRecord(User, {
            id: testData.user[1].id, // Use same id as blog
            name: testData.user[1].name,
        });

        await store.saveAll();

        const blogName = await blog.rawFirebaseValue('name');
        const userName = await user.rawFirebaseValue('name');

        expect(blogName, 'blog has blog name').to.equal(testData.blog[1].name);
        expect(userName, 'user has user name').to.equal(testData.user[1].name);

    });

    it('should save skip non dirty records saveAll', async () => {

        /**
         * This test exists mostly for code coverage and checks that records
         * without dirty records are skipped when performing a saveAll
         */

        const store: Store = new Store(admin.database(), { basePath });

        const blog: Blog = store.createRecord(Blog, {
            id: testData.blog[1].id,
            name: testData.blog[1].name,
        });

        await store.saveAll();
        await store.saveAll(); // Second saveAll should trigger alternate path in saveAll code

        const blogName = await blog.rawFirebaseValue('name');
        expect(blogName, 'blog has blog name').to.equal(testData.blog[1].name);

    });

});
