
'use strict';

import { expect } from 'chai';
import * as debug from 'debug';
import * as dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import { v4 } from 'uuid';
import { ModelOrPromise, Store } from '../src';
import { Blog, Post, User } from './models';
import { resetFirebase, testData } from './test-data';

// tslint:disable:no-unused-expression

// tslint:disable:mocha-no-side-effect-code
const basePath = process.env.BASE_PATH ? process.env.BASE_PATH as string : undefined;

async function createdLinkedBlogAndPost(): Promise<void> {
    await resetFirebase(basePath);
    const store: Store = new Store(admin.database(), { basePath });

    const blog: Blog = store.createRecord(Blog, {
        id: testData.blog[1].id,
        name: testData.blog[1].name,
        published: false,
    });

    const post: Post = store.createRecord(Post, {
        id: testData.post[1].id,
        title: testData.post[1].title,
        blog,
    });

    await blog.save();
}

describe('Has Many - Belongs To', function (): void {

    // Allow longer for the tests to run, in case of slow network access to firebase etc
    // tslint:disable-next-line:no-invalid-this
    this.timeout(15000);

    before(async () => await resetFirebase(basePath));
    after(async () => await resetFirebase(basePath));


    it('should create a post and blog and save the post', async () => {

        /**
         * Creates a new blog then creates a new post linking to that blog.
         * Saving the blog should also save the post
         *
         * Relationship should show in blog.posts and post.blog
         *
         * This tests adding to a hasMany <-> belongsTo relationship from the belongsTo side
         */

        await resetFirebase(basePath);
        const store: Store = new Store(admin.database(), { basePath });

        const blog: Blog = store.createRecord(Blog, {
            id: testData.blog[1].id,
            name: testData.blog[1].name,
            published: false,
        });

        const post: Post = store.createRecord(Post, {
            id: testData.post[1].id,
            title: testData.post[1].title,
            blog,
        });

        const blogPosts = blog.posts;
        expect(blogPosts.length, 'blog has 1 post').to.equal(1);
        const blogPost = await blogPosts[0];
        expect(blogPost.title, 'blog post is post').to.equal(testData.post[1].title);

        const postBlog = await post.blog;

        expect(postBlog, 'post blog is defined').to.not.be.an('null');
        // If statement here for typescript's benefit, not null is checked above.
        if (postBlog !== null) {
            expect(postBlog.name, 'post blog name is blog name').to.equal(testData.blog[1].name);
        }

        post.save();

        const postBlogInFirebase = await post.rawFirebaseValue('blog');
        expect(postBlogInFirebase, 'saved post is blog').to.equal(testData.blog[1].id);

        const blogPostsInFirebase = await blog.rawFirebaseValue('posts');
        expect(blogPostsInFirebase[testData.post[1].id], 'blogs posts contains new post').to.be.true;

        store.unloadAll();

    });

    it('should create a post and blog and save the blog', async () => {

        /**
         * This is the same as the previous test but saves the blog rather than the post
         * The outcome should be the same
         */

        await resetFirebase(basePath);
        const store: Store = new Store(admin.database(), { basePath });

        const blog: Blog = store.createRecord(Blog, {
            id: testData.blog[1].id,
            name: testData.blog[1].name,
            published: false,
        });

        const post: Post = store.createRecord(Post, {
            id: testData.post[1].id,
            title: testData.post[1].title,
            blog,
        });

        blog.save();

        const postBlogInFirebase = await post.rawFirebaseValue('blog');
        expect(postBlogInFirebase, 'saved post links to blog').to.equal(testData.blog[1].id);

        const blogPostsInFirebase = await blog.rawFirebaseValue('posts');
        expect(blogPostsInFirebase[testData.post[1].id], 'blogs posts contains new post').to.be.true;

        store.unloadAll();
    });

    it('should add a post to a blog then save the blog', async () => {

        /**
         * Creates a new blog then creates a new post linking to that blog.
         *
         * Relationship should show in blog.posts and post.blog
         *
         * This tests adding to a hasMany <-> belongsTo relationship from the hasMany side
         */

        await resetFirebase(basePath);
        const store: Store = new Store(admin.database(), { basePath });

        const blog: Blog = store.createRecord(Blog, {
            id: testData.blog[1].id,
            name: testData.blog[1].name,
            published: false,
        });

        const post: Post = store.createRecord(Post, {
            id: testData.post[1].id,
            title: testData.post[1].title,
        });

        blog.posts.push(post);

        const blogPosts = blog.posts;
        expect(blogPosts.length, 'blog has post').to.equal(1);
        const blogPost = await blogPosts[0];
        expect(blogPost.title, 'blog post is post').to.equal(testData.post[1].title);

        const postBlog = await post.blog;
        expect(postBlog, 'post blog is defined').to.not.be.an('null');

        // If statement here for typescript's benefit, not null is checked above.
        if (postBlog !== null) {
            expect(postBlog.name, 'post blog name is blog name').to.equal(testData.blog[1].name);

            blog.save();

            const postBlogInFirebase = await post.rawFirebaseValue('blog');
            expect(postBlogInFirebase, 'saved post is blog').to.equal(testData.blog[1].id);

            const blogPostsInFirebase = await blog.rawFirebaseValue('posts');
            expect(blogPostsInFirebase[testData.post[1].id], 'blogs posts contains new post').to.be.true;
        }

        store.unloadAll();
    });

    it('should retrieve related records from firebase from the hasMany side', async () => {

        /**
         * Retrieves the blog from the store then retrieves the post by accessing the blogs 'posts' property
         */

        await createdLinkedBlogAndPost();
        const store: Store = new Store(admin.database(), { basePath });

        const blog = await store.findRecord(Blog, testData.blog[1].id);

        const blogPosts = blog.posts;

        expect(blogPosts.length, 'blog has 1 post').to.equal(1);
        const blogPost = await blogPosts[0];
        expect(blogPost.title, 'blog post is post').to.equal(testData.post[1].title);

    });

    it('should retrieve related records from firebase from the belongsTo side', async () => {

        /**
         * Retrieves the blog from the store then retrieves the post by accessing the blogs 'posts' property
         */

        await createdLinkedBlogAndPost();
        const store: Store = new Store(admin.database(), { basePath });

        const post = await store.findRecord(Post, testData.post[1].id);

        const postBlog = await post.blog;
        expect(postBlog, 'post blog is defined').to.not.be.an('null');

        // If statement here for typescript's benefit, not null is checked above.
        if (postBlog !== null) {
            expect(postBlog.name, 'posts blog name is blog name').to.equal(testData.blog[1].name);
        }

        store.unloadAll();
    });

    it('should set both sides of the relationship to null when setting the belongsTo side to null', async () => {

        /**
         * Starting with linked post and blog. Set the post's blog to null and verify that this is updated
         * in both the post and the blog
         */

        await createdLinkedBlogAndPost();
        const store: Store = new Store(admin.database(), { basePath });

        const post = await store.findRecord(Post, testData.post[1].id);
        const blog = await store.findRecord(Blog, testData.blog[1].id);

        post.blog = null;

        expect(post.blog, 'posts blog is null').to.be.a('null');
        const blogPosts = blog.posts;
        expect(blogPosts.length, 'blog has 0 posts').to.equal(0);

        post.save();

        const postBlogInFirebase = await post.rawFirebaseValue('blog');
        expect(postBlogInFirebase, 'post blog is undefined').to.be.a('undefined');

        const blogPostsInFirebase = await blog.rawFirebaseValue('posts');
        expect(blogPostsInFirebase, 'blogs posts is undefined').to.be.a('undefined');

        store.unloadAll();
    });

    it('should set both sides of the relationship to null when setting the hasMany side to null', async () => {

        /**
         * Starting with linked post and blog. Remove the post from the blogs posts and verify that this is updated
         * in both the post and the blog
         */

        await createdLinkedBlogAndPost();
        const store: Store = new Store(admin.database(), { basePath });

        const post = await store.findRecord(Post, testData.post[1].id);
        const blog = await store.findRecord(Blog, testData.blog[1].id);

        const blogPosts = blog.posts;
        blogPosts.pop();
        blog.posts = blogPosts;

        expect(post.blog, 'posts blog is null').to.be.a('null');
        expect(blogPosts.length, 'blog has 0 posts').to.equal(0);

        post.save();

        const postBlogInFirebase = await post.rawFirebaseValue('blog');
        expect(postBlogInFirebase, 'post blog is undefined').to.be.a('undefined');

        const blogPostsInFirebase = await blog.rawFirebaseValue('posts');
        expect(blogPostsInFirebase, 'blogs posts is undefined').to.be.a('undefined');

        store.unloadAll();
    });

    it('should should thrown an exception if both records being linked are not currently in the store', async () => {

        /**
         * Setting the post blog to null should also remove the blog->post relationship
         * This tests the behavior when only the post is available in the store
         *
         * Currently this behavior is not implemented so the test checks the expected exception is thrown
         */

        await createdLinkedBlogAndPost();
        const store: Store = new Store(admin.database(), { basePath });
        const post = await store.findRecord(Post, testData.post[1].id);

        // Unlink owner from blog, both user.blog and blog.owner should become null
        expect(() => post.blog = null).to.throw('not in the store');

        store.unloadAll();
    });

    it('should throw an exception if setting hasMany to something invalid', async () => {

        /**
         * If something that is not a record is passed to a hasMany handler an exception should be thrown
         */

        const store: Store = new Store(admin.database(), { basePath });

        const blog: Blog = store.createRecord(Blog, {
            id: testData.blog[1].id,
            name: testData.blog[1].name,
            published: false,
        });
        // tslint:disable-next-line:no-any
        expect(() => { blog.posts = 1234 as any as Post[]; }).to.throw('is not an instance of a model nor a mapping of ids'); // Weird typing to bypass typescript checking

    });

    it('should delete a record and automatically update a belongsTo<->hasMany relationship', async () => {

        /**
         * Load the blog record then delete it
         */
        await createdLinkedBlogAndPost();
        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);
        await blog.deleteRecord();
        await blog.save();

        // Check the path in firebase is now null
        const path = `${basePath}/blogs/${blog.id}`;
        const blogInFirebase = await admin.database().ref(path).once('value');
        expect(blogInFirebase.val(), 'blog is null in Firebase').to.be.an('null');

        // Check the posts blog is now null
        const post: Post = await store.findRecord(Post, testData.post[1].id);
        expect(post.blog, 'post blog is null').to.be.a('null');
    });

    it('should delete a record and automatically update a hasMany<->belongsTo relationship', async () => {

        /**
         * Load the post record then delete it
         */
        await createdLinkedBlogAndPost();
        const store: Store = new Store(admin.database(), { basePath });
        const post: Post = await store.findRecord(Post, testData.post[1].id);
        await post.deleteRecord();
        await post.save();

        // Check the path in firebase is now null
        const path = `${basePath}/posts/${post.id}`;
        const postInFirebase = await admin.database().ref(path).once('value');
        expect(postInFirebase.val(), 'post is null in Firebase').to.be.an('null');

        // Check the posts blog is now null
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);
        expect(blog.posts.length, 'blog has no posts').to.equal(0);
    });

    it('should throw when accessing an hasMany relationship on a deleted record', async () => {

        /**
         * Load the blog, delete it, then try to get/set the owner relationship
         */
        await createdLinkedBlogAndPost();
        const store: Store = new Store(admin.database(), { basePath });
        const blog: Blog = await store.findRecord(Blog, testData.blog[1].id);
        await blog.deleteRecord();

        expect(() => { const posts = blog.posts; }).to.throw('Record is deleted');
        expect(() => { blog.posts = []; }).to.throw('Record is deleted');
    });


});
