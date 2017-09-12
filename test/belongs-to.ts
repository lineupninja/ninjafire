
'use strict';

import { expect } from 'chai';
import * as debug from 'debug';
import * as dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import { v4 } from 'uuid';
import { ModelOrPromise, Store } from '../src';
import { Blog, User } from './models';
import { resetFirebase, testData } from './test-data';

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

async function createBlogAndUser(): Promise<void> {

    await resetFirebase(basePath);
    const store: Store = new Store(admin.database(), { basePath });

    const blog: Blog = store.createRecord(Blog, {
        id: testData.blog[1].id,
        name: testData.blog[1].name,
        published: false,
    });

    const user: User = store.createRecord(User, {
        id: testData.user[1].id,
        name: testData.user[1].name,
        blog,
    });

    await user.save();
}

describe('Belongs To', function (): void {

    // Allow longer for the tests to run, in case of slow network access to firebase etc
    // tslint:disable-next-line:no-invalid-this
    this.timeout(15000);

    before(async () => await resetFirebase(basePath));
    after(async () => await resetFirebase(basePath));

    it('should link related records when creating a new record', async () => {

        /**
         * Creates a user as sets the 'blog' to be the blog
         * This should also set the user to the blogs 'owner'
         */

        await createBlog();

        const store: Store = new Store(admin.database(), { basePath });
        const blog = await store.findRecord(Blog, testData.blog[1].id);

        const user: User = store.createRecord(User, {
            id: testData.user[1].id,
            name: testData.user[1].name,
            blog,
        });

        const blogOwner = await blog.owner;
        const userBlog = await user.blog;

        expect(blogOwner, 'Blogs owner is set').to.not.be.a('null');
        expect(userBlog, 'Users blog is set').to.not.be.a('null');

        // This if statement is to satisfy typescript, The null value is checked with chai above
        if (blogOwner !== null && userBlog !== null) {

            expect(blogOwner.id, 'Blog owner is user').to.equal(user.id);

            // User blog should be blog
            expect(userBlog.id, 'Users blog is blog').to.equal(blog.id);

        }

        store.unloadAll();

    });

    it('should automatically save both sides of a relationship change', async () => {

        /**
         * Creates a user and sets the 'blog' to be the blog
         * Saves the user only, the blog should save automatically
         */

        await createBlog();

        const store: Store = new Store(admin.database(), { basePath });
        const blog = await store.findRecord(Blog, testData.blog[1].id);

        const user: User = store.createRecord(User, {
            id: testData.user[1].id,
            name: testData.user[1].name,
            blog,
        });

        await user.save();

        const blogOwnerInFirebase = await blog.rawFirebaseValue('owner');
        expect(blogOwnerInFirebase, 'Blog owner attribute is be user id').to.equal(testData.user[1].id);

        const userBlogInFirebase = await user.rawFirebaseValue('blog');
        expect(userBlogInFirebase, 'Users blog attribute is be blog id').to.equal(testData.blog[1].id);

        store.unloadAll();

    });

    it('should retrieve related records via their relationship', async () => {

        /**
         * Retrieves the blog record, then gets the user record via the blog.owner attribute
         */

        await createBlogAndUser();

        const store: Store = new Store(admin.database(), { basePath });
        const blog = await store.findRecord(Blog, testData.blog[1].id);

        const blogOwner = await blog.owner;

        expect(blogOwner, 'Blog owner should have a value').to.not.be.a('null');

        // This if statement is to satisfy typescript, The null value is checked with chai above
        if (blogOwner !== null) {
            expect(blogOwner.id, 'Blog owner is user').to.equal(testData.user[1].id);
            expect(blogOwner.name, 'Blog owner name is users name').to.equal(testData.user[1].name);
        }

        store.unloadAll();

    });

    it('should unlink blog and owner with both records retrieved', async () => {

        /**
         * Setting the blog owner to null should also remove the user-> blog relationship
         * This tests the behavior when both records are in the store
         * It should also only require saving of one side of the relationship
         */

        await createBlogAndUser();

        const store: Store = new Store(admin.database(), { basePath });
        const blog = await store.findRecord(Blog, testData.blog[1].id);
        const user = await store.findRecord(User, testData.user[1].id);

        // Unlink owner from blog, both user.blog and blog.owner should become null
        blog.owner = null;
        expect(blog.owner, 'Blog owner is null').to.be.a('null');
        expect(user.blog, 'User blog is null').to.be.a('null');

        await blog.save();

        const blogOwnerInFirebase = await blog.rawFirebaseValue('owner');
        expect(blogOwnerInFirebase, 'Blog owner attribute is undefined').to.be.an('undefined');

        const userBlogInFirebase = await user.rawFirebaseValue('blog');
        expect(userBlogInFirebase, 'Users blog attribute is undefined').to.be.an('undefined');

        store.unloadAll();

    });

    it('should link related records when setting the attribute', async () => {

        /**
         * Tests that setting a belongsTo attribute sets the record on both sides of the relationship
         *
         * Basically the same test as createRecord above but not performed during createRecord
         *
         * It should also only require saving one side of the relationship
         *
         * Uses the blog and user updated in the previous test
         */

        const store: Store = new Store(admin.database(), { basePath });
        const blog = await store.findRecord(Blog, testData.blog[1].id);
        const user = await store.findRecord(User, testData.user[1].id);

        user.blog = blog;

        const blogOwner = await blog.owner;
        const userBlog = await user.blog;

        expect(blogOwner, 'Blogs owner is set').to.not.be.a('null');
        expect(userBlog, 'Users blog is set').to.not.be.a('null');

        // This if statement is to satisfy typescript, The null value is checked with chai above
        if (blogOwner !== null && userBlog !== null) {

            expect(blogOwner.id, 'Blog owner is user').to.equal(user.id);

            // User blog should be blog
            expect(userBlog.id, 'Users blog is blog').to.equal(blog.id);

        }

        await blog.save();

        const blogOwnerInFirebase = await blog.rawFirebaseValue('owner');
        expect(blogOwnerInFirebase, 'Blog owner attribute should be user id').to.equal(testData.user[1].id);

        const userBlogInFirebase = await user.rawFirebaseValue('blog');
        expect(userBlogInFirebase, 'Users blog attribute should be blog id').to.equal(testData.blog[1].id);

        store.unloadAll();

    });

    it('should unlink originally linked relationship when changing to a new target', async () => {

        /**
         * Tests that, when changing a belongsTo relationship, that the originally linked relationship is updated
         */

        await createBlogAndUser();

        const store: Store = new Store(admin.database(), { basePath });
        const blog = await store.findRecord(Blog, testData.blog[1].id);
        const user = await store.findRecord(User, testData.user[1].id);

        const blog2: Blog = store.createRecord(Blog, {
            id: testData.blog[2].id,
            name: testData.blog[2].name,
            published: false,
            owner: user,
        });

        blog2.save();

        // This should result in 'blog' losing it's belongsTo relationship and user.blog pointing to blog2

        expect(blog.owner, 'Blog owner is null').to.be.an('null');

        expect(blog2.owner, 'Blogs owner is set').to.not.be.a('null');
        expect(user.blog, 'Users blog is set').to.not.be.a('null');

        // This if statement is to satisfy typescript, The null value is checked with chai above
        if (blog2.owner !== null && user.blog !== null) {

            expect(blog2.owner.id, 'Blog2 owner is user id').to.equal(user.id);
            expect(user.blog.id, 'User blog is blog2').to.equal(blog2.id);

        }

        let blogOwnerInFirebase = await blog.rawFirebaseValue('owner');
        expect(blogOwnerInFirebase, 'Blog owner attribute in Firebase is undefined').to.be.an('undefined');

        let blog2OwnerInFirebase = await blog2.rawFirebaseValue('owner');
        expect(blog2OwnerInFirebase, 'Blog2 owner attribute in Firebase user id').to.equal(testData.user[1].id);

        let userBlogInFirebase = await user.rawFirebaseValue('blog');
        expect(userBlogInFirebase, 'Users blog attribute in Firebase blog id').to.equal(testData.blog[2].id);

        // Change user blog back to first blog
        user.blog = blog;
        user.save();

        // Check that worked

        blogOwnerInFirebase = await blog.rawFirebaseValue('owner');
        expect(blogOwnerInFirebase, 'Blog owner attribute in Firebase is user id').to.equal(testData.user[1].id);

        blog2OwnerInFirebase = await blog2.rawFirebaseValue('owner');
        expect(blog2OwnerInFirebase, 'Blog2 owner attribute in Firebase is undefined').to.be.an('undefined');

        userBlogInFirebase = await user.rawFirebaseValue('blog');
        expect(userBlogInFirebase, 'Users blog attribute in Firebase is blog id').to.equal(testData.blog[1].id);

        store.unloadAll();
    });


    it('should throw an exception if both records being unlinked are not currently in the store', async () => {

        /**
         * Setting the blog owner to null should also remove the user-> blog relationship
         * This tests the behavior when only one record is available in the store
         *
         * Currently both records must be in the store prior to changing the relationship, if they are not an exception is thrown
         */

        await createBlogAndUser();

        const store: Store = new Store(admin.database(), { basePath });
        const blog = await store.findRecord(Blog, testData.blog[1].id);

        // Unlink owner from blog, both user.blog and blog.owner should become null
        expect(() => { blog.owner = null; }).to.throw('not in the store');

        store.unloadAll();

    });

    it('should throw an exception if setting belongsTo to something invalid', async () => {

        /**
         * Test that, when a belongsTo relationship is set to an invalid value an exception is thrown
         * If ninjafire is being used in a Typescript environment then it should be prevented automatically by tsc
         */

        const store: Store = new Store(admin.database(), { basePath });

        const blog: Blog = store.createRecord(Blog, {
            id: testData.blog[1].id,
            name: testData.blog[1].name,
            published: false,
        });

        // tslint:disable-next-line:no-any
        expect(() => { blog.owner = 1234 as any as User; }).to.throw('is not an instance of a model nor an id string'); // Type casting to bypass typescript checking

    });

    it('should delete a record and automatically update a belongsTo<->belongsTo relationship', async () => {

        /**
         * Load the blog record then delete it. It should also update the related user
         */
        await createBlogAndUser();
        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);
        await blog.deleteRecord();
        await blog.save();

        // Check the path in firebase is now null
        const path = `${basePath}/blogs/${blog.id}`;
        const blogInFirebase = await admin.database().ref(path).once('value');
        expect(blogInFirebase.val(), 'blog is null in Firebase').to.be.an('null');

        // Check the users blog is now null
        const user: User = await store.findRecord(User, testData.user[1].id);
        expect(user.blog, 'user blog is null').to.be.a('null');
    });

    it('should throw when accessing an belongsTo relationship on a deleted record', async () => {

        /**
         * Load the blog, delete it, then try to get/set the owner relationship
         */
        await createBlog();
        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);
        await blog.deleteRecord();

        const user: User = store.createRecord(User, {
            id: testData.user[1].id,
            name: testData.user[1].name,
        });

        expect(() => { const test = blog.owner; }).to.throw('Record is deleted');
        expect(() => { blog.owner = user; }).to.throw('Record is deleted');
    });


});
