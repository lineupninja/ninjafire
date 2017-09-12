
'use strict';

import { expect } from 'chai';
import * as debug from 'debug';
import * as dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import { v4 } from 'uuid';
import { ModelOrPromise, ModelPromise, Store } from '../src';
import { HasManyArray, hasManyArrayProxyHandler } from '../src/handlers/has-many';
import { Blog, Post, User } from './models';
import { resetFirebase, testData } from './test-data';

// tslint:disable:no-unused-expression

// tslint:disable:mocha-no-side-effect-code
const basePath = process.env.BASE_PATH ? process.env.BASE_PATH as string : undefined;

async function createdLinkedUserAndPost(): Promise<void> {

    await resetFirebase(basePath);
    const store: Store = new Store(admin.database(), { basePath });

    const post: Post = store.createRecord(Post, {
        id: testData.post[1].id,
        title: testData.post[1].title,
    });

    const user: User = store.createRecord(User, {
        id: testData.user[1].id,
        name: testData.user[1].name,
        posts: [post],
    });

    await user.save();
}

async function createdLinkedUserAndTwoPosts(): Promise<void> {
    await resetFirebase(basePath);
    const store: Store = new Store(admin.database(), { basePath });

    const post1: Post = store.createRecord(Post, {
        id: testData.post[1].id,
        title: testData.post[1].title,
    });

    const post2: Post = store.createRecord(Post, {
        id: testData.post[2].id,
        title: testData.post[2].title,
    });

    const user: User = store.createRecord(User, {
        id: testData.user[1].id,
        name: testData.user[1].name,
        posts: [post1, post2],
    });
    await user.save();
}
describe('Has Many - Has Many', function (): void {

    // Allow longer for the tests to run, in case of slow network access to firebase etc
    // tslint:disable-next-line:no-invalid-this
    this.timeout(15000);

    before(async () => await resetFirebase(basePath));
    after(async () => await resetFirebase(basePath));

    it('should create a post and user and save the post', async () => {

        /**
         * Creates a new post then creates a new user linking to that post.
         * Saving the post should also save the user
         *
         * Relationship should show in user.posts and post.authors
         *
         * This tests adding to a hasMany <-> hasMany relationship
         */

        await resetFirebase(basePath);
        const store: Store = new Store(admin.database(), { basePath });

        const post: Post = store.createRecord(Post, {
            id: testData.post[1].id,
            title: testData.post[1].title,
        });

        const user: User = store.createRecord(User, {
            id: testData.user[1].id,
            name: testData.user[1].name,
            posts: [post],
        });

        const userPosts = user.posts;
        expect(userPosts.length, 'user has 1 post').to.equal(1);
        const userPost = await userPosts[0];
        expect(userPost.title, 'user post is post').to.equal(testData.post[1].title);

        const postAuthors = post.authors;
        expect(postAuthors.length, 'post has 1 author').to.equal(1);
        const postAuthor = await postAuthors[0];
        expect(postAuthor.name, 'post author name is user name').to.equal(testData.user[1].name);

        await post.save();

        const postAuthorsInFirebase = await post.rawFirebaseValue('authors');
        expect(postAuthorsInFirebase[testData.user[1].id], 'saved post is author').to.be.true;

        const userPostsInFirebase = await user.rawFirebaseValue('posts');
        expect(userPostsInFirebase[testData.post[1].id], 'user posts contains new post').to.be.true;

        store.unloadAll();
    });

    it('should retrieve related records from firebase', async () => {

        /**
         * Retrieves the user, then retrieves the users post via the hasMany relationship
         */

        await createdLinkedUserAndPost();
        const store: Store = new Store(admin.database(), { basePath });

        const user = await store.findRecord(User, testData.user[1].id);

        const userPosts = user.posts;

        expect(userPosts.length, 'blog haves 1 post').to.equal(1);
        const userPost = await userPosts[0];
        expect(userPost.title, 'user post is post').to.equal(testData.post[1].title);

        store.unloadAll();
    });

    it('should set both sides of the relationship to null when removing one side', async () => {

        /**
         * Retrieves a user and post and then sets the users posts to the empty array
         */

        await createdLinkedUserAndPost();
        const store: Store = new Store(admin.database(), { basePath });

        const user = await store.findRecord(User, testData.user[1].id);
        const post = await store.findRecord(Post, testData.post[1].id);

        user.posts = [];

        await user.save();

        const postAuthorInFirebase = await post.rawFirebaseValue('authors');
        expect(postAuthorInFirebase, 'post has no authors').to.be.an('undefined');

        const userPostsInFirebase = await user.rawFirebaseValue('posts');
        expect(userPostsInFirebase, 'user has no posts').to.be.an('undefined');

        store.unloadAll();
    });

    it('should set add multiple items to has many relationship', async () => {

        /**
         * Creates 2 posts then assigns them to the user via the users hasMany relationship
         */

        await resetFirebase(basePath);
        const store: Store = new Store(admin.database(), { basePath });

        const post1: Post = store.createRecord(Post, {
            id: testData.post[1].id,
            title: testData.post[1].title,
        });

        const post2: Post = store.createRecord(Post, {
            id: testData.post[2].id,
            title: testData.post[2].title,
        });

        const user1: User = store.createRecord(User, {
            id: testData.user[1].id,
            name: testData.user[1].name,
            posts: [post1, post2],
        });

        const user2: User = store.createRecord(User, {
            id: testData.user[2].id,
            name: testData.user[2].name,
            posts: [post1, post2],
        });

        const user1Posts = user1.posts;
        expect(user1Posts.length, 'user has 2 posts').to.equal(2);
        const user1Post1 = await user1Posts[0];
        expect(user1Post1.title, 'user post 1 is post 1').to.equal(testData.post[1].title);
        const user1Post2 = await user1Posts[1];
        expect(user1Post2.title, 'user post 2 is post 2').to.equal(testData.post[2].title);

        // Should save both users and posts
        await user2.save();

        const user1PostsInFirebase = await user1.rawFirebaseValue('posts');
        expect(user1PostsInFirebase[testData.post[1].id], 'user posts contains post 1').to.be.true;
        expect(user1PostsInFirebase[testData.post[2].id], 'user posts contains post 2').to.be.true;


        const user2PostsInFirebase = await user2.rawFirebaseValue('posts');
        expect(user2PostsInFirebase[testData.post[1].id], 'user posts contains post 1').to.be.true;
        expect(user2PostsInFirebase[testData.post[2].id], 'user posts contains post 2').to.be.true;

        const post1AuthorsInFirebase = await post1.rawFirebaseValue('authors');
        expect(post1AuthorsInFirebase[testData.user[1].id], 'saved post1 has author user1').to.be.true;
        expect(post1AuthorsInFirebase[testData.user[2].id], 'saved post1 has author user2').to.be.true;

        const post2AuthorsInFirebase = await post2.rawFirebaseValue('authors');
        expect(post1AuthorsInFirebase[testData.user[1].id], 'saved post1 has author user1').to.be.true;
        expect(post1AuthorsInFirebase[testData.user[2].id], 'saved post1 has author user2').to.be.true;

        store.unloadAll();
    });

    it('should retrieve multiple items in a has many relationship', async () => {

        /**
         * Retrieves the user and two linked posts
         */

        await createdLinkedUserAndTwoPosts();
        const store: Store = new Store(admin.database(), { basePath });

        const post1: Post = await store.findRecord(Post, testData.post[1].id);
        const post2: Post = await store.findRecord(Post, testData.post[2].id);
        const user: User = await store.findRecord(User, testData.user[1].id);

        const userPosts = user.posts;
        expect(userPosts.length, 'user has 2 posts').to.equal(2);

        // Firebase does not preserve array ordering so the two posts attached to the user may be in either order

        await Promise.all(userPosts.map(async (userPostPromise: ModelOrPromise<Post>) => {
            const userPost = await userPostPromise;
            if (userPost.id === testData.post[1].id) {
                expect(userPost.title, 'user post 1 is post 1').to.equal(testData.post[1].title);

            } else {
                expect(userPost.title, 'user post 2 is post 2').to.equal(testData.post[2].title);
            }
        }));

        store.unloadAll();
    });

    it('should remove a post from a user with two posts by updating the users posts', async () => {

        /**
         * Retrieves the user and two linked posts then removes one of the posts from the user
         */

        await createdLinkedUserAndTwoPosts();
        const store: Store = new Store(admin.database(), { basePath });

        const post1: Post = await store.findRecord(Post, testData.post[1].id);
        const post2: Post = await store.findRecord(Post, testData.post[2].id);
        const user: User = await store.findRecord(User, testData.user[1].id);

        let userPosts = user.posts;

        const filteredPosts = user.posts.filter((post: ModelOrPromise<Post>) => post.id !== testData.post[2].id);
        user.posts = filteredPosts;

        userPosts = user.posts;

        expect(userPosts.length, 'user has 1 post').to.equal(1);
        await user.save();

        const userPostsInFirebase = await user.rawFirebaseValue('posts');
        expect(userPostsInFirebase[testData.post[1].id], 'user posts contains post 1').to.be.true;
        expect(userPostsInFirebase[testData.post[2].id], 'user posts does not contain post 2').to.be.a('undefined');

        const post1AuthorsInFirebase = await post1.rawFirebaseValue('authors');
        expect(post1AuthorsInFirebase[testData.user[1].id], 'saved post1 has author').to.be.true;

        const post2AuthorsInFirebase = await post2.rawFirebaseValue('authors');
        expect(post2AuthorsInFirebase, 'saved post2 has no authors').to.be.a('undefined');

        store.unloadAll();
    });

    it('should remove a post from a user with two posts by removing the authors from a post', async () => {

        /**
         * Retrieves the user and two linked posts then removes the author from one of the posts
         */

        await createdLinkedUserAndTwoPosts();
        const store: Store = new Store(admin.database(), { basePath });

        const post1: Post = await store.findRecord(Post, testData.post[1].id);
        const post2: Post = await store.findRecord(Post, testData.post[2].id);
        const user: User = await store.findRecord(User, testData.user[1].id);

        post2.authors = [];

        const userPosts = user.posts;

        expect(userPosts.length, 'user has 1 post').to.equal(1);
        await user.save();

        const userPostsInFirebase = await user.rawFirebaseValue('posts');
        expect(userPostsInFirebase[testData.post[1].id], 'user posts contains post 1').to.be.true;
        expect(userPostsInFirebase[testData.post[2].id], 'user posts does not contain post 2').to.be.a('undefined');

        const post1AuthorsInFirebase = await post1.rawFirebaseValue('authors');
        expect(post1AuthorsInFirebase[testData.user[1].id], 'saved post1 has author').to.be.true;

        const post2AuthorsInFirebase = await post2.rawFirebaseValue('authors');
        expect(post2AuthorsInFirebase, 'saved post2 has no authors').to.be.a('undefined');

        store.unloadAll();
    });

    it('should remove a post from a user with two posts by setting the author for a post to a new user', async () => {

        /**
         * Retrieves the user and two linked posts then changes the one of the posts posts to be authored by a new user
         */

        await createdLinkedUserAndTwoPosts();
        const store: Store = new Store(admin.database(), { basePath });

        const post1: Post = await store.findRecord(Post, testData.post[1].id);
        const post2: Post = await store.findRecord(Post, testData.post[2].id);
        const user1: User = await store.findRecord(User, testData.user[1].id);

        const user2: User = store.createRecord(User, {
            id: testData.user[2].id,
            name: testData.user[2].name,
            posts: [post1, post2],
        });

        let user1Posts = user1.posts;
        expect(user1Posts.length, 'user1 has 2 posts').to.equal(2);

        let user2Posts = user2.posts;
        expect(user2Posts.length, 'user2 has 2 posts').to.equal(2);

        post2.authors = [user2];

        user1Posts = user1.posts;
        expect(user1Posts.length, 'user1 has 1 posts').to.equal(1);

        user2Posts = user2.posts;
        expect(user2Posts.length, 'user2 has posts').to.equal(2);

        await user1.save(); // This should also save post2, and user2

        const user1PostsInFirebase = await user1.rawFirebaseValue('posts');
        expect(user1PostsInFirebase[testData.post[1].id], 'user1 posts contains post 1').to.be.true;
        expect(user1PostsInFirebase[testData.post[2].id], 'user1 posts does not contain post 2').to.be.a('undefined');

        const post2AuthorsInFirebase = await post2.rawFirebaseValue('authors');
        expect(post2AuthorsInFirebase[testData.user[2].id], 'saved post2 has author user2').to.be.true;

        const user2PostsInFirebase = await user2.rawFirebaseValue('posts');
        expect(user2PostsInFirebase[testData.post[2].id], 'user2 posts contains post 2').to.be.true;

        store.unloadAll();
    });

    it('should not fail to add items to a HasMany array if it does not have an associated record', async () => {

        /**
         * Internally there should be no reason that a HasManyMap array would not have an associated record
         * This test checks that the expected behavior works in case it is used
         */

        const store: Store = new Store(admin.database(), { basePath });
        const records: HasManyArray<Post | ModelPromise<Post>> = [];

        const recordProxy = new Proxy(records, hasManyArrayProxyHandler) as HasManyArray<Post | ModelPromise<Post>>;

        recordProxy.push(store.createRecord(Post, {}));
        recordProxy.push(store.createRecord(Post, {}));

        expect(recordProxy.length, 'Proxy wrapped has many array should have two records').to.equal(2);

    });
});
