
'use strict';

import { expect } from 'chai';
import * as debug from 'debug';
import * as dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import { v4 } from 'uuid';
import { AttrHandlerOptions, BelongsToHandlerOptions, HasManyHandlerOptions, isAttrHandlerOptions, isBelongsToHandlerOptions, isHasManyHandlerOptions } from '../src';
import { Blog, User } from './models';
import { resetFirebase, testData } from './test-data';

// tslint:disable:no-unused-expression

// tslint:disable:mocha-no-side-effect-code
const basePath = process.env.BASE_PATH ? process.env.BASE_PATH as string : undefined;

describe('handler options', function (): void {


    // Allow longer for the tests to run, in case of slow network access to firebase etc
    // tslint:disable-next-line:no-invalid-this
    this.timeout(15000);


    it('should identify options as the right type', async () => {

        /**
         * Checks that various handler options can be identified as the right type
         */

        const attrOptions: AttrHandlerOptions = { setToServerTimestampOnSave: true, defaultValue: (): string => { return 'test'; } };
        expect(isAttrHandlerOptions(attrOptions), 'a valid set of attribute handler options').to.be.true;

        const belongsToOptions: BelongsToHandlerOptions = { embedded: true, inverse: 'test' };
        expect(isBelongsToHandlerOptions(belongsToOptions), 'a valid set of belongsTo handler options').to.be.true;

        const hasManyOptions: HasManyHandlerOptions = { embedded: true, inverse: 'test' };
        expect(isHasManyHandlerOptions(hasManyOptions), 'a valid set of hasMany handler options').to.be.true;

        expect(isAttrHandlerOptions(belongsToOptions), 'belongsTo options is not identified as attr').to.be.false;
        expect(isBelongsToHandlerOptions(attrOptions), 'attr options is not identified as belongsTo').to.be.false;
        expect(isHasManyHandlerOptions(attrOptions), 'attr options is not identified as hasMany').to.be.false;

        // As belongsTo and hasMany have the same options ve DO expect them to be identified as each other
        expect(isBelongsToHandlerOptions(hasManyOptions), 'hasMany options is be identified as belongsTo as they are the same shape').to.be.true;
        expect(isHasManyHandlerOptions(belongsToOptions), 'belongsTo options is be identified as hasMAny as they are the same shape').to.be.true;

        const attrOptionsWithExtraKey: {} = { setToServerTimestampOnSave: true, defaultValue: 'test', extraKey: 'test' };
        expect(isAttrHandlerOptions(attrOptionsWithExtraKey), 'invalid options is not identified as attr').to.be.false;

        const otherOptionsWithExtraKey: {} = { embedded: true, inverse: 'test', extraKey: 'test' };
        expect(isBelongsToHandlerOptions(attrOptionsWithExtraKey), 'invalid options is not identified as belongsTo').to.be.false;
        expect(isBelongsToHandlerOptions(attrOptionsWithExtraKey), 'invalid options is not identified as hasMany').to.be.false;

    });
});
