
'use strict';

import { expect } from 'chai';
import * as debug from 'debug';
import * as dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import { v4 } from 'uuid';
import { ModelOrPromise, Store } from '../src';
import { Comment, Post, User, Vote } from './models';
import { resetFirebase, testData } from './test-data';

// tslint:disable:no-unused-expression

// tslint:disable:mocha-no-side-effect-code
const basePath = process.env.BASE_PATH ? process.env.BASE_PATH as string : undefined;

describe('Path Prefix Groups', function (): void {

    // Allow longer for the tests to run, in case of slow network access to firebase etc
    // tslint:disable-next-line:no-invalid-this
    this.timeout(15000);

    before(async () => await resetFirebase(basePath));
    after(async () => await resetFirebase(basePath));

    it('should create a comment and vote under the path prefix', async () => {

        /**
         * Create a post, then set the pathPrefix for 'post' in the store to be the new post
         *
         * Then create a comment, which will be placed under the path prefix, save it and check it is correctly saved
         */

        await resetFirebase(basePath);
        const store: Store = new Store(admin.database(), { basePath });

        const post: Post = store.createRecord(Post, {
            id: testData.post[1].id,
            title: testData.post[1].title,
        });

        store.pathPrefix.post = `/post/${post.id}`;

        const comment = store.createRecord(Comment, {
            id: testData.comment[1].id,
            text: testData.comment[1].text,
            post,
        });

        await comment.save();

        // Query the path directly, rather than using the utility function, to ensure it contains the expected path prefix
        const path = `${basePath}/post/${post.id}/comments/${testData.comment[1].id}`;
        const commentInFirebase = await admin.database().ref(path).once('value');
        expect(commentInFirebase.val().text, 'Comment text in firebase is be comment text').to.equal(testData.comment[1].text);

        store.unloadAll();

    });

    it('should retrieve a comment under the path prefix', async () => {

        /**
         * Check that the comment saved under the posts pathPrefix can be retrieved with findRecord
         */

        const store: Store = new Store(admin.database(), { basePath });
        store.pathPrefix.post = `/post/${testData.post[1].id}`;

        const comment = await store.findRecord(Comment, testData.comment[1].id);

        expect(comment.text, 'comment has correct text').to.equal(testData.comment[1].text);

        store.unloadAll();

    });
    it('should retrieve a comment under the path prefix via the post', async () => {

        /**
         * Check that the comment saved under the posts pathPrefix can be retrieved by accessing the comments attribute of post
         */

        const store: Store = new Store(admin.database(), { basePath });
        store.pathPrefix.post = `/post/${testData.post[1].id}`;
        const post = await store.findRecord(Post, testData.post[1].id);
        const comment = await post.comments[0];

        expect(comment.text, 'comment has correct text').to.equal(testData.comment[1].text);

        store.unloadAll();

    });

    it('should relate a vote to the comment under the path prefix', async () => {

        /**
         * Create a vote, which is also a model with the 'post' path prefix and relate it to the comment
         * Ensure this relationship is saved as expected and to the correct path
         */

        const store: Store = new Store(admin.database(), { basePath });
        store.pathPrefix.post = `/post/${testData.post[1].id}`;

        const comment = await store.findRecord(Comment, testData.comment[1].id);

        const vote = store.createRecord(Vote, {
            id: testData.vote[1].id,
            score: testData.vote[1].score,
            comment,
        });

        expect(vote.score, 'vote has correct score').to.equal(testData.vote[1].score);

        await vote.save();

        const voteScoreInFirebase = await vote.rawFirebaseValue('score');
        expect(voteScoreInFirebase, 'vote has correct saved score').to.equal(testData.vote[1].score);

        const commentVotesInFirebase = await comment.rawFirebaseValue('votes');
        expect(commentVotesInFirebase[testData.vote[1].id], 'comment has related vote').to.be.true;

        store.unloadAll();

    });

    it('should retrieve a vote under the path prefix then related comment and post', async () => {

        /**
         * Check that the vote saved above can be retrieved and that the relationships to comment and post can be traversed
         */

        const store: Store = new Store(admin.database(), { basePath });
        store.pathPrefix.post = `/post/${testData.post[1].id}`;

        const vote = await store.findRecord(Vote, testData.vote[1].id);
        const comment = await vote.comment;
        const post = await comment.post;

        expect(post.title, 'retrieved correct post').to.equal(testData.post[1].title);

        store.unloadAll();
    });

});

