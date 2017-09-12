
'use strict';

import { expect } from 'chai';
import * as debug from 'debug';
import * as dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import { v4 } from 'uuid';
import { ModelOrPromise, Store } from '../src';
import { Blog } from './models';
// tslint:disable:mocha-no-side-effect-code
dotenv.config();

// tslint:disable-next-line:no-var-requires
const serviceAccount: {} = require('../serviceAccountKey.json');

const app: admin.app.App = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseAuthVariableOverride: {
        uid: 'ninjafire',
    },
    databaseURL: process.env.FIREBASE_DATABASE_URL,
});
