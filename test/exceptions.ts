
'use strict';

import { expect } from 'chai';
import * as admin from 'firebase-admin';
import { Store } from '../src';
import { Bad, Comment, EmbeddedInverse, InvalidInverse, MissingName, User } from './models';
import { resetFirebase, testData } from './test-data';

// tslint:disable:no-unused-expression

// tslint:disable:mocha-no-side-effect-code
const basePath = process.env.BASE_PATH ? process.env.BASE_PATH as string : undefined;

describe('Exceptions', function (): void {

    // Allow longer for the tests to run, in case of slow network access to firebase etc
    // tslint:disable-next-line:no-invalid-this
    this.timeout(15000);

    before(async () => await resetFirebase(basePath));
    after(async () => await resetFirebase(basePath));

    it('should throw an exception setting a relationship with an inverse on an embedded record', async () => {

        /**
         * Records that are embedded cannot have inverse relationships as it is not possible to track the inverse back to the location of the embedded record
         */

        const store: Store = new Store(admin.database(), { basePath });

        const embeddedInverse: EmbeddedInverse = store.createRecord(EmbeddedInverse, {});

        const bad: Bad = store.createRecord(Bad, {
            embeddedInverse,
        });

        expect(() => { embeddedInverse.related = bad; }).to.throw('Embedded records cannot contain relationships with inverses');

        store.unloadAll();
    });

    it('should throw an exception setting a relationship with an inverse that has an invalid key', async () => {

        /**
         * Inverse relationships need to specify the attribute the inverse applies to.
         * An exception should be raised if the inverse attribute does not exist
         */

        const store: Store = new Store(admin.database(), { basePath });

        const invalidInverse: InvalidInverse = store.createRecord(InvalidInverse, {});

        const bad: Bad = store.createRecord(Bad, {
            invalidInverse,
        });

        expect(() => { invalidInverse.invalidKey = bad; }).to.throw('not found on record of type');

        store.unloadAll();
    });

    it('should throw an exception setting a relationship with an inverse that is not hasMany or belongsTo', async () => {

        /**
         * Inverse relationships need to specify the attribute the inverse applies to.
         * An exception should be raised if the inverse attribute is an attr, rather than hasMany or belongsTo
         */

        const store: Store = new Store(admin.database(), { basePath });

        const invalidInverse: InvalidInverse = store.createRecord(InvalidInverse, {});

        const bad: Bad = store.createRecord(Bad, {});

        expect(() => { invalidInverse.invalidType = bad; }).to.throw('Inverse relationship attribute is attr, should be belongsTo or hasMany');

        store.unloadAll();
    });


    it('should throw an exception when finding a record that does not exist', async () => {

        /**
         * If the record that findRecord is looking for does not exist an exception named 'NinjaFireRecordNotFound' should be thrown
         */

        await resetFirebase(basePath);
        const store: Store = new Store(admin.database(), { basePath });

        let errorWasThrown = false;

        try {
            await store.findRecord(User, testData.user[1].id);
        } catch (e) {
            expect(e.name).to.equal('NinjaFireRecordNotFound');
            errorWasThrown = true;
        }

        expect(errorWasThrown, 'error was thrown').to.be.true;

        store.unloadAll();
    });

    it('should throw an exception when trying to find or peek or unload a record without a modelName', async () => {

        /**
         * If a model has no modelName configured then findRecord, peekRecord, createRecord and unloadAll should all thrown exceptions
         */

        const store: Store = new Store(admin.database(), { basePath });

        expect(() => { store.findRecord(MissingName, '1234'); }).to.throw('modelName is not defined on class');
        expect(() => { store.peekRecord(MissingName, '1234'); }).to.throw('modelName is not defined on class');
        expect(() => { store.createRecord(MissingName, {}); }).to.throw('modelName is not defined on class');
        expect(() => { store.unloadAll(MissingName); }).to.throw('modelName is not defined on class');

        store.unloadAll();
    });


    it('should throw an exception if attempting to create a record with a path prefix that is not configured in the store', async () => {

        /**
         * If a model has a defined path prefix the store must have the path prefix set before the record is created
         * If the path prefix is not set then an exception is thrown
         */

        await resetFirebase(basePath);

        const store: Store = new Store(admin.database(), { basePath });

        let errorWasThrown = false;
        try {
            const comment = store.createRecord(Comment, {
                id: testData.comment[1].id,
                text: testData.comment[1].text,
            });
        } catch (e) {
            errorWasThrown = true;
            expect(e, 'caught error').to.be.a('error');
        }
        expect(errorWasThrown, 'error was thrown').to.be.true;

        store.unloadAll();

    });

    it('should throw an exception if attempting to find a record with a path prefix that is not configured in the store', async () => {

        /**
         * If a model has a defined path prefix the store must have the path prefix set before a findRecord is performed
         * If the path prefix is not set then an exception is thrown
         */

        await resetFirebase(basePath);

        const store: Store = new Store(admin.database(), { basePath });

        let errorWasThrown = false;
        try {
            const comment = store.findRecord(Comment, testData.comment[1].id);
        } catch (e) {
            errorWasThrown = true;
            expect(e, 'caught error').to.be.a('error');
        }
        expect(errorWasThrown, 'error was thrown').to.be.true;

        store.unloadAll();

    });


    it('should throw an exception when constructing a model without using createRecord', async () => {

        /**
         * Records should be constructed by using createRecord, not by using the constructor on the model
         *
         * Calling the constructor directly raises and exception.
         */

        await resetFirebase(basePath);

        expect(() => { const comment = new Comment(); }).to.throw('Store must be provided when actually initializing the object');
    });

    it('should throw an exception setting an attribute with an inverse that has an invalid hander', async () => {

        /**
         * If the 'inverse' attribute for a relationship has a handler type that is not recognized an exception should be thrown
         */

        const store: Store = new Store(admin.database(), { basePath });

        const invalidInverse: InvalidInverse = store.createRecord(InvalidInverse, {});

        const bad: Bad = store.createRecord(Bad, {});

        expect(() => { invalidInverse.badHandlerOnInverse = bad; }).to.throw('invalid handler type reached');

        store.unloadAll();
    });

    it('should throw an exception setting data that includes an embedded record but for which the handler is attr', async () => {

        /**
         * If an attr has been defined as taking an embedded record and one is pushed raise an exception
         *
         * In Typescript environments tsc will error.
         */

        const store: Store = new Store(admin.database(), { basePath });

        const bad: Bad = store.createRecord(Bad, {});

        expect(() => {
            bad.setAttributesFrom({
                invalidEmbedHandlerAttr: {
                    id: 'test',
                    caption: 'photoCaption',
                },
            });
        }).to.throw('Handler Type must be belongsTo or hasMany for an embedded record');

        store.unloadAll();
    });


    it('should throw an exception setting data that includes an embedded record but for which the handler is not belongsTo or hasMany or attr', async () => {

        /**
         * If an attribute has an unknown handler and configured to take an embedded record then an exception should be raised when a record is passed to it.
         *
         * In Typescript environments tsc will error.
         */

        const store: Store = new Store(admin.database(), { basePath });

        const bad: Bad = store.createRecord(Bad, {});

        expect(() => {
            bad.setAttributesFrom({
                invalidEmbedHandlerOther: {
                    id: 'test',
                    caption: 'photoCaption',
                },
            });
        }).to.throw('invalid handler type reached');

        store.unloadAll();
    });

    it('should throw an exception when saving a record with a bad handler', async () => {

        /**
         * If an attribute contains a handler that is not recognized, i.e. not attr, belongsTo or hasMany then an exception should be raised when saving
         */

        const store: Store = new Store(admin.database(), { basePath });

        const bad: Bad = store.createRecord(Bad, {});

        // tslint:disable-next-line:no-string-literal
        bad._localAttributes['badHandler'] = true;

        let errorWasThrown = false;
        try {
            await bad.save();
        } catch (e) {
            errorWasThrown = true;
            expect(e).to.be.a('error');
        }
        expect(errorWasThrown, 'error was thrown').to.be.true;


        store.unloadAll();
    });

});
