
'use strict';

import { expect } from 'chai';
import * as debug from 'debug';
import * as dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import { v4 } from 'uuid';
import { ModelOrPromise, Store } from '../src';
import { Bad, Blog, Photo, Post, User } from './models';
import { resetFirebase, testData } from './test-data';

// tslint:disable:no-unused-expression

// tslint:disable:mocha-no-side-effect-code
const basePath = process.env.BASE_PATH ? process.env.BASE_PATH as string : undefined;

async function createPostAndEmbeddedPhotos(): Promise<void> {

    await resetFirebase(basePath);
    const store: Store = new Store(admin.database(), { basePath });

    const post: Post = store.createRecord(Post, {
        id: testData.post[1].id,
        title: testData.post[1].title,
    });

    const user1: User = store.createRecord(User, {
        id: testData.user[1].id,
        name: testData.user[1].name,
    });

    const user2: User = store.createRecord(User, {
        id: testData.user[2].id,
        name: testData.user[2].name,
    });

    const user3: User = store.createRecord(User, {
        id: testData.user[3].id,
        name: testData.user[3].name,
    });

    const photo1: Photo = store.createRecord(Photo, {
        id: testData.photo[1].id,
        caption: testData.photo[1].caption,
    });

    const photo2: Photo = store.createRecord(Photo, {
        id: testData.photo[2].id,
        caption: testData.photo[2].caption,
    });

    const photo3: Photo = store.createRecord(Photo, {
        id: testData.photo[3].id,
        caption: testData.photo[3].caption,
    });

    post.heroImage = photo3;
    post.photos = [photo1, photo2];

    await post.save();
}

async function createPostAndEmbeddedPhotosAndUsers(): Promise<void> {

    await createPostAndEmbeddedPhotos();
    const store: Store = new Store(admin.database(), { basePath });

    const user1: User = store.createRecord(User, {
        id: testData.user[1].id,
        name: testData.user[1].name,
    });

    const user2: User = store.createRecord(User, {
        id: testData.user[2].id,
        name: testData.user[2].name,
    });

    const user3: User = store.createRecord(User, {
        id: testData.user[3].id,
        name: testData.user[3].name,
    });

    await user1.save();
    await user2.save();
    await user3.save();

}

describe('Embedded', function (): void {

    // Allow longer for the tests to run, in case of slow network access to firebase etc
    // tslint:disable-next-line:no-invalid-this
    this.timeout(15000);

    before(async () => await resetFirebase(basePath));
    after(async () => await resetFirebase(basePath));

    it('should create a post and embed a hasMany photo', async () => {

        /**
         * Creates a new post then creates a new photo and embeds it into the post
         * It then pushes an additional photo onto the posts photos
         *
         * This tests adding to a hasMany embedded relationship
         */

        await resetFirebase(basePath);
        const store: Store = new Store(admin.database(), { basePath });

        const post: Post = store.createRecord(Post, {
            id: testData.post[1].id,
            title: testData.post[1].title,
        });

        const photo: Photo = store.createRecord(Photo, {
            id: testData.photo[1].id,
            caption: testData.photo[1].caption,
        });


        post.photos = [photo];

        expect(post.photos.length, 'post has 1 photo').to.equal(1);
        const postPhoto = post.photos[0];
        expect(postPhoto.caption, 'photo photo has caption').to.equal(testData.photo[1].caption);

        expect(photo._embeddedIn, 'photo has embeddedIn property').to.not.be.an('undefined');

        if (photo._embeddedIn !== null) {
            expect(photo._embeddedIn.id, 'photos embeddedIn property is post').to.equal(post.id);
        }

        // Push another photo
        const photo2: Photo = store.createRecord(Photo, {
            id: testData.photo[2].id,
            caption: testData.photo[2].caption,
        });

        post.photos.push(photo2);
        expect(post.photos.length, 'post has 2 photo').to.equal(2);

        store.unloadAll();
    });

    it('should create and save a post with embedded hasMany photos', async () => {

        /**
         * Creates a new post then creates a two new photos and embeds them into the post
         *
         * This tests adding to a hasMany embedded relationship and saving it
         */

        await resetFirebase(basePath);
        const store: Store = new Store(admin.database(), { basePath });

        const post: Post = store.createRecord(Post, {
            id: testData.post[1].id,
            title: testData.post[1].title,
        });

        const photo1: Photo = store.createRecord(Photo, {
            id: testData.photo[1].id,
            caption: testData.photo[1].caption,
        });

        const photo2: Photo = store.createRecord(Photo, {
            id: testData.photo[2].id,
            caption: testData.photo[2].caption,
        });

        post.photos = [photo1, photo2];

        await post.save();

        const photosInPostInFirebase = await post.rawFirebaseValue('photos');
        expect(photosInPostInFirebase[testData.photo[1].id].caption, 'saved post contains photo1 in firebase').to.equal(testData.photo[1].caption);
        expect(photosInPostInFirebase[testData.photo[2].id].caption, 'saved post contains photo2 in firebase').to.equal(testData.photo[2].caption);

        store.unloadAll();
    });

    it('should retrieve a post with embedded hasMany photos', async () => {

        /**
         * Retrieve the post with two embedded photos created in the previous test
         */

        const store: Store = new Store(admin.database(), { basePath });
        const post: Post = await store.findRecord(Post, testData.post[1].id);

        expect(post.title, 'post has correct title').to.equal(testData.post[1].title);

        expect(post.photos.length, 'post has two photos').to.equal(2);

        // Embedded photos might be retrieved in any order as firebase does not support array ordering

        post.photos.map((photo: Photo) => {
            if (photo.id === testData.photo[1].id) {
                expect(photo.caption, 'photo 1 should have caption 1').to.equal(testData.photo[1].caption);
            } else {
                expect(photo.caption, 'photo 2 should have caption 2').to.equal(testData.photo[2].caption);
            }
        });

        store.unloadAll();
    });

    it('should create a post and embed a belongsTo hero image', async () => {

        /**
         * Creates a new post then creates a new photo and embeds it as the hero image into the post
         *
         * This tests adding to a belongsTo embedded relationship
         */

        await resetFirebase(basePath);
        const store: Store = new Store(admin.database(), { basePath });

        const post: Post = store.createRecord(Post, {
            id: testData.post[1].id,
            title: testData.post[1].title,
        });

        const photo: Photo = store.createRecord(Photo, {
            id: testData.photo[1].id,
            caption: testData.photo[1].caption,
        });

        post.heroImage = photo;

        const postHero = post.heroImage;

        expect(postHero.caption, 'photo photo has caption').to.equal(testData.photo[1].caption);

        expect(postHero._embeddedIn, 'photo has embeddedIn property').to.not.be.an('undefined');

        if (postHero._embeddedIn !== null) {
            expect(postHero._embeddedIn.id, 'photos embeddedIn property is post').to.equal(post.id);
        }

        store.unloadAll();
    });


    it('should create and save a post and embedded belongsTo hero image', async () => {

        /**
         * Creates a new post then creates a new photo and embeds it as the hero image into the post
         *
         * This tests adding to a belongsTo embedded relationship and saving the parent record
         */

        await resetFirebase(basePath);
        const store: Store = new Store(admin.database(), { basePath });

        const post: Post = store.createRecord(Post, {
            id: testData.post[1].id,
            title: testData.post[1].title,
        });

        const photo: Photo = store.createRecord(Photo, {
            id: testData.photo[1].id,
            caption: testData.photo[1].caption,
        });

        post.heroImage = photo;

        await post.save();

        const heroImageInPostInFirebase = await post.rawFirebaseValue('heroImage');
        // On embedded belongsTo items the 'id' is saved as a property on the record, rather than its key
        expect(heroImageInPostInFirebase.id, 'saved post contains photo in firebase').to.equal(testData.photo[1].id);
        expect(heroImageInPostInFirebase.caption, 'saved post contains photo in firebase').to.equal(testData.photo[1].caption);

        store.unloadAll();
    });

    it('should retrieve a post with embedded belongsTo hero photo', async () => {

        /**
         * Retrieves the post and embedded hero image created in the previous test
         */

        const store: Store = new Store(admin.database(), { basePath });
        const post: Post = await store.findRecord(Post, testData.post[1].id);

        const heroImage = post.heroImage;
        expect(heroImage, 'hero image is defined').to.not.be.a('null');

        if (heroImage !== null) {
            expect(heroImage.id, 'hero image has correct id').to.equal(testData.photo[1].id);
            expect(heroImage.caption, 'hero image has correct caption').to.equal(testData.photo[1].caption);
        }

        store.unloadAll();
    });


    it('saving an embedded record should save the parent', async () => {

        /**
         * Creates a new post then creates a new photo and embeds it as the hero image into the post
         *
         * This tests adding to a belongsTo embedded relationship and saving the embedded record
         */

        await resetFirebase(basePath);
        const store: Store = new Store(admin.database(), { basePath });

        const post: Post = store.createRecord(Post, {
            id: testData.post[1].id,
            title: testData.post[1].title,
        });

        const photo: Photo = store.createRecord(Photo, {
            id: testData.photo[1].id,
            caption: testData.photo[1].caption,
        });

        post.heroImage = photo;

        await photo.save();

        const heroImageInPostInFirebase = await post.rawFirebaseValue('heroImage');
        // On embedded belongsTo the 'id' is saved as a property on the record, rather than its key
        expect(heroImageInPostInFirebase.id, 'saved post contains photo in firebase').to.equal(testData.photo[1].id);
        expect(heroImageInPostInFirebase.caption, 'saved post contains photo in firebase').to.equal(testData.photo[1].caption);

        store.unloadAll();
    });


    it('should save an embedded record when it has been retrieved ', async () => {

        /**
         * When retrieving a record that has an embedded record the embedded record should be saveable.
         */

        await createPostAndEmbeddedPhotos();
        const store: Store = new Store(admin.database(), { basePath });

        const post: Post = await store.findRecord(Post, testData.post[1].id);
        const heroImage = post.heroImage;

        expect(heroImage).to.not.be.a('null');

        if (heroImage !== null) {
            heroImage.caption = 'new-caption';

            await heroImage.save();
            const heroImageInPostInFirebase = await post.rawFirebaseValue('heroImage');
            expect(heroImageInPostInFirebase.caption, 'saved post contains photo in firebase').to.equal('new-caption');

        }

        store.unloadAll();
    });



    it('should remove belongsTo embedded record when set to null', async () => {

        /**
         * Removes the embedded belongsTo hero image and saves it
         */

        await createPostAndEmbeddedPhotos();
        const store: Store = new Store(admin.database(), { basePath });
        const post: Post = await store.findRecord(Post, testData.post[1].id);

        const heroImage = post.heroImage;

        post.heroImage = null;

        await post.save();

        const heroImageInPostInFirebase = await post.rawFirebaseValue('heroImage');
        expect(heroImageInPostInFirebase, 'hero image removed in firebase').to.be.an('undefined');

    });


    it('should remove both hasMany embedded records when set to null', async () => {

        /**
         * Removes the embedded belongsTo hero image and saves it
         */

        await createPostAndEmbeddedPhotos();
        const store: Store = new Store(admin.database(), { basePath });
        const post: Post = await store.findRecord(Post, testData.post[1].id);

        const photos1 = post.heroImage;
        post.photos = [];

        await post.save();

        const photosInPostInFirebase = await post.rawFirebaseValue('photos');
        expect(photosInPostInFirebase, 'photos removed in firebase').to.be.an('undefined');

        store.unloadAll();
    });

    it('should remove one hasMany embedded records when filtered', async () => {

        /**
         * Removes the embedded belongsTo hero image and saves it
         */

        await createPostAndEmbeddedPhotos();
        const store: Store = new Store(admin.database(), { basePath });
        const post: Post = await store.findRecord(Post, testData.post[1].id);

        post.photos = post.photos.filter((photo: Photo) => photo.id === testData.photo[1].id);

        await post.save();

        const photosInPostInFirebase = await post.rawFirebaseValue('photos');
        expect(photosInPostInFirebase[testData.photo[1].id].caption, 'saved post contains photo1 in firebase').to.equal(testData.photo[1].caption);
        expect(photosInPostInFirebase[testData.photo[2].id], 'saved post does not contain photo2 in firebase').to.be.an('undefined');

        store.unloadAll();
    });

    it('should save changed attributes on embedded belongsTo records', async () => {

        /**
         * Tests that attributes changes on an embedded belongsTo record are saved
         */

        await createPostAndEmbeddedPhotos();
        const store: Store = new Store(admin.database(), { basePath });
        const post: Post = await store.findRecord(Post, testData.post[1].id);

        const heroImage = post.heroImage;
        expect(heroImage).to.not.be.an('null');

        if (heroImage !== null) {
            heroImage.caption = 'test-caption';
            await post.save();
            const heroImageInPostInFirebase = await post.rawFirebaseValue('heroImage');
            expect(heroImageInPostInFirebase.caption, 'saved post contains photo in firebase').to.equal('test-caption');
        }

        // Verify other embeds are unchanged
        const photosInPostInFirebase = await post.rawFirebaseValue('photos');
        expect(photosInPostInFirebase[testData.photo[1].id].caption, 'saved post contains photo1 in firebase').to.equal(testData.photo[1].caption);
        expect(photosInPostInFirebase[testData.photo[2].id].caption, 'saved post contains photo2 in firebase').to.equal(testData.photo[2].caption);

        store.unloadAll();
    });

    it('should save changed attributes on embedded hasMany records', async () => {

        /**
         * Tests that attributes changes on an embedded belongsTo record are saved
         */

        await createPostAndEmbeddedPhotos();
        const store: Store = new Store(admin.database(), { basePath });
        const post: Post = await store.findRecord(Post, testData.post[1].id);

        const firstPhoto = post.photos.filter((photo: Photo) => photo.id === testData.photo[1].id)[0];

        expect(firstPhoto, 'Photo with id of photo1 should be in post photos').to.not.be.an('undefined');

        firstPhoto.caption = 'test-caption';
        await post.save();

        const photosInPostInFirebase = await post.rawFirebaseValue('photos');
        expect(photosInPostInFirebase[testData.photo[1].id].caption, 'saved post contains updated photo1 in firebase').to.equal('test-caption');

        // Verify other embeds are unchanged
        expect(photosInPostInFirebase[testData.photo[2].id].caption, 'saved post contains photo2 in firebase').to.equal(testData.photo[2].caption);
        const heroImageInPostInFirebase = await post.rawFirebaseValue('heroImage');
        expect(heroImageInPostInFirebase.caption, 'saved post contains photo in firebase').to.equal(testData.photo[3].caption);

        store.unloadAll();
    });

    it('should save belongsTo and hasMany relationships in belongsTo embedded records', async () => {

        /**
         * A record embedded with a belongsTo relationship can contain belongsTo and hasMany relationships to other records, confirm they are saved successfully
         */

        await createPostAndEmbeddedPhotosAndUsers();
        const store: Store = new Store(admin.database(), { basePath });
        const post: Post = await store.findRecord(Post, testData.post[1].id);
        const user1: User = await store.findRecord(User, testData.user[1].id);
        const user2: User = await store.findRecord(User, testData.user[2].id);
        const user3: User = await store.findRecord(User, testData.user[3].id);

        // Set belongsTo and hasMany on the belongsTo embedded record

        expect(post.heroImage).to.not.be.a('null');

        if (post.heroImage !== null) {

            post.heroImage.takenBy = user3;
            post.heroImage.taggedUsers = [user1, user2];

            expect(post.heroImage.takenBy.name, 'hero image creator is user3').to.equal(testData.user[3].name);
            expect(post.heroImage.taggedUsers.length, 'hero image has two users').to.equal(2);
            await post.save();

            const heroImageInPostInFirebase = await post.rawFirebaseValue('heroImage');
            expect(heroImageInPostInFirebase.takenBy, 'saved heroImage creator is user3').to.equal(testData.user[3].id);
            expect(heroImageInPostInFirebase.taggedUsers[testData.user[1].id], 'tagged users includes user1').to.be.true;
            expect(heroImageInPostInFirebase.taggedUsers[testData.user[2].id], 'tagged users includes user2').to.be.true;

        }

        store.unloadAll();
    });

    it('should retrieve belongsTo and hasMany relationships in belongsTo embedded record', async () => {

        /**
         * A record embedded with a belongsTo relationship can contain belongsTo and hasMany relationships to other records, confirm they are retrieved successfully
         *
         * This retrieves the data created in the previous test
         */

        const store: Store = new Store(admin.database(), { basePath });
        const post: Post = await store.findRecord(Post, testData.post[1].id);

        expect(post.heroImage).to.not.be.a('null');

        if (post.heroImage !== null) {

            const takenBy = await post.heroImage.takenBy;
            expect(takenBy.name, 'taken by is be user3').to.equal(testData.user[3].name);

            const taggedUsers = post.heroImage.taggedUsers;

            // Firebase does not preserve array ordering so the two tagged users

            await Promise.all(taggedUsers.map(async (taggedUserPromise: ModelOrPromise<User>) => {
                const user = await taggedUserPromise;
                if (user.id === testData.user[1].id) {
                    expect(user.name, 'tagged user 1 is user 1').to.equal(testData.user[1].name);
                } else {
                    expect(user.name, 'tagged user 2 is user 2').to.equal(testData.user[2].name);
                }
            }));

        }

        store.unloadAll();
    });

    it('should save belongsTo and hasMany relationships in hasMany embedded records', async () => {

        /**
         * A record embedded with a hasMany relationship can contain belongsTo and hasMany relationships to other records, confirm they are saved successfully
         */

        await createPostAndEmbeddedPhotosAndUsers();
        const store: Store = new Store(admin.database(), { basePath });
        const post: Post = await store.findRecord(Post, testData.post[1].id);
        const user1: User = await store.findRecord(User, testData.user[1].id);
        const user2: User = await store.findRecord(User, testData.user[2].id);
        const user3: User = await store.findRecord(User, testData.user[3].id);

        // Set belongsTo and hasMany on the photo1 hasMany record

        const firstPhoto = post.photos.filter((photo: Photo) => photo.id === testData.photo[1].id)[0];
        expect(firstPhoto, 'Photo with id of photo1 is in post photos').to.not.be.an('undefined');

        firstPhoto.takenBy = user3;
        firstPhoto.taggedUsers = [user1, user2];

        expect(firstPhoto.takenBy.name, 'hero image creator is user3').to.equal(testData.user[3].name);
        expect(firstPhoto.taggedUsers.length, 'hero image has two users').to.equal(2);
        await post.save();

        const photosInPostInFirebase = await post.rawFirebaseValue('photos');
        expect(photosInPostInFirebase[testData.photo[1].id].takenBy, 'saved heroImage creator is user3').to.equal(testData.user[3].id);
        expect(photosInPostInFirebase[testData.photo[1].id].taggedUsers[testData.user[1].id], 'tagged users includes user1').to.be.true;
        expect(photosInPostInFirebase[testData.photo[1].id].taggedUsers[testData.user[2].id], 'tagged users includes user2').to.be.true;

        store.unloadAll();
    });

    it('should retrieve belongsTo and hasMany relationships in hasMany embedded record', async () => {

        /**
         * A record embedded with a hasMany relationship can contain belongsTo and hasMany relationships to other records, confirm they are retrieved successfully
         *
         * This retrieves the data created in the previous test
         */

        const store: Store = new Store(admin.database(), { basePath });
        const post: Post = await store.findRecord(Post, testData.post[1].id);

        const firstPhoto = post.photos.filter((photo: Photo) => photo.id === testData.photo[1].id)[0];
        expect(firstPhoto, 'Photo with id of photo1 is in post photos').to.not.be.an('undefined');

        const takenBy = await firstPhoto.takenBy;
        expect(takenBy.name, 'taken by is user3').to.equal(testData.user[3].name);

        const taggedUsers = firstPhoto.taggedUsers;

        // Firebase does not preserve array ordering so the two tagged users

        await Promise.all(taggedUsers.map(async (taggedUserPromise: ModelOrPromise<User>) => {
            const user = await taggedUserPromise;
            if (user.id === testData.user[1].id) {
                expect(user.name, 'tagged user 1 is user 1').to.equal(testData.user[1].name);
            } else {
                expect(user.name, 'tagged user 2 is user 2').to.equal(testData.user[2].name);
            }
        }));

        store.unloadAll();
    });

    it('should support additional hasMany embedded records appearing remotely', async () => {

        /**
         * Thanks to the real time nature of Firebase additional embedded records may appear in a hasMany relationship after the record has loaded.
         * Confirm they are successfully added to the record
         */

        await createPostAndEmbeddedPhotosAndUsers();
        const store: Store = new Store(admin.database(), { basePath });
        const post: Post = await store.findRecord(Post, testData.post[1].id);

        expect(post.photos.length, 'post initially has 2 photos').to.equal(2);

        // Use setAttributesFrom to simulate an additional record appearing in firebase
        post.setAttributesFrom({
            title: testData.post[1].title,
            photos: {
                [testData.photo[1].id]: {
                    caption: testData.photo[1].caption,
                },
                [testData.photo[2].id]: {
                    caption: testData.photo[2].caption,
                },

                'additional-photo-id': {
                    caption: 'additional-photo-caption',
                },
            },
        });

        expect(post.photos.length, 'post now has 3 photos').to.equal(3);

        store.unloadAll();
    });

    it('should thrown an exception if saving an embedded record when it is not embedded in anything', async () => {

        /**
         * Models that have 'embedded=true' must be embedded in something to be saved
         */

        const store: Store = new Store(admin.database(), { basePath });

        const photo = store.createRecord(Photo, {
            id: testData.photo[1].id,
            caption: testData.photo[1].caption,
        });

        let errorWasThrown = false;
        try {
            await photo.save();
        } catch (e) {
            errorWasThrown = true;
            expect(e).to.be.a('error');
        }
        expect(errorWasThrown, 'error was thrown').to.be.true;

    });

    it('should throw an exception if attempting to retrieve a record that contains an embedded belongsTo record that is missing an ID', async () => {

        /**
         * Creates a post with an embedded heroImage and then removes the ID from the heroImage in Firebase
         * Retrieving the heroImage should now throw an exception
         */

        const store: Store = new Store(admin.database(), { basePath });

        const post = store.createRecord(Post, {
            id: testData.post[1].id,
            title: testData.post[1].title,
        });

        const photo = store.createRecord(Photo, {
            id: testData.photo[1].id,
            caption: testData.photo[1].caption,
        });

        post.heroImage = photo;
        await photo.save();

        // Directly remove the 'id' attribute from the embedded record
        await admin.database().ref(post._path).update({ 'heroImage/id': null });

        // Retrieve the record in a new store
        const newStore: Store = new Store(admin.database(), { basePath });

        const retrievedPost: Post = await newStore.findRecord(Post, testData.post[1].id);
        expect(retrievedPost).to.not.be.a('null');
        expect(() => { retrievedPost.heroImage; }).to.throw('Embedded record does not have an id property');

        newStore.unloadAll();
    });

    it('should throw an exception when embedding a record that is not an embeddable model', async () => {

        /**
         * Models must have 'embedded=true' to be embedded in another record
         */

        const store: Store = new Store(admin.database(), { basePath });

        const user: User = store.createRecord(User, {});

        const bad: Bad = store.createRecord(Bad, {});

        expect(() => { bad.invalidEmbedBelongsTo = user; }).to.throw('is not an embeddable record');
        expect(() => { bad.invalidEmbedHasMany = [user]; }).to.throw('is not an embeddable record');
        store.unloadAll();
    });

    it('should throw an exception when saving if an embedded belongsTo record has been unloaded ', async () => {

        /**
         * If a belongsTo embedded record has been unloaded from the store, an exception should be thrown if the record it was embedded in is then saved
         */

        await resetFirebase(basePath);
        const store: Store = new Store(admin.database(), { basePath });

        const post: Post = store.createRecord(Post, {
            id: testData.post[1].id,
            title: testData.post[1].title,
        });

        const photo: Photo = store.createRecord(Photo, {
            id: testData.photo[1].id,
            caption: testData.photo[1].caption,
        });

        post.heroImage = photo;

        photo.unloadRecord();

        post.save();

        let errorWasThrown = false;
        try {
            await post.save();
        } catch (e) {
            errorWasThrown = true;
            expect(e).to.be.a('error');
        }
        expect(errorWasThrown, 'error was thrown').to.be.true;

        store.unloadAll();
    });

    it('should throw an exception when saving if an embedded hasMany record has been unloaded ', async () => {

        /**
         * If a hasMany embedded record has been unloaded from the store, an exception should be thrown if the record it was embedded in is then saved
         */

        await resetFirebase(basePath);
        const store: Store = new Store(admin.database(), { basePath });

        const post: Post = store.createRecord(Post, {
            id: testData.post[1].id,
            title: testData.post[1].title,
        });

        const photo: Photo = store.createRecord(Photo, {
            id: testData.photo[1].id,
            caption: testData.photo[1].caption,
        });

        post.photos = [photo];

        photo.unloadRecord();

        post.save();

        let errorWasThrown = false;
        try {
            await post.save();
        } catch (e) {
            errorWasThrown = true;
            expect(e).to.be.a('error');
        }
        expect(errorWasThrown, 'error was thrown').to.be.true;

        store.unloadAll();
    });


    it('should delete an embedded belongsTo record ', async () => {

        /**
         * Deleting an saving an embedded record in a belongsTo embed should remove the embedded record
         */

        await createPostAndEmbeddedPhotos();
        const store: Store = new Store(admin.database(), { basePath });

        const post: Post = await store.findRecord(Post, testData.post[1].id);
        const heroImage = post.heroImage;

        expect(heroImage).to.not.be.a('null');

        if (heroImage !== null) {
            await heroImage.deleteRecord();
            await heroImage.save();
            const heroImageInPostInFirebase = await post.rawFirebaseValue('heroImage');
            expect(heroImageInPostInFirebase, 'hero image removed in firebase').to.be.an('undefined');

        }

        store.unloadAll();
    });

    it('should delete an embedded hasMany record ', async () => {

        /**
         * Deleting an saving an embedded record in a hasMany embed should remove the embedded record
         */

        await createPostAndEmbeddedPhotos();
        const store: Store = new Store(admin.database(), { basePath });

        const post: Post = await store.findRecord(Post, testData.post[1].id);
        const photos = post.photos;

        const firstPhoto = photos.filter((photo: Photo) => photo.id = testData.photo[1].id)[0];

        await firstPhoto.deleteRecord();
        await firstPhoto.save();

        const photosInPostInFirebase = await post.rawFirebaseValue('photos');
        expect(photosInPostInFirebase[testData.photo[1].id], 'first photo is undefined').to.be.an('undefined');
        expect(photosInPostInFirebase[testData.photo[2].id].caption, 'saved post contains photo2 in firebase').to.equal(testData.photo[2].caption);

        store.unloadAll();
    });


});
