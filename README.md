ninjafire

## Overview

ninjafire is an ORM for Firebase written in Typescript. It is heavily based on the API for Ember Data. It is compatible with data in Firebase created by the [emberfire](https://github.com/firebase/emberfire) project.

It is intended to be used in node, and can be used in a Firebase Cloud Function, and it has the following features

* Strongly Typed
* Attribute types:
    * Boolean
    * Date
    * JSON
    * Number
    * String
* Relationships:
    * belongsTo <-> belongsTo (1-1)
    * belongsTo <-> hasMany (1-many)
    * hasMany <-> hasMany (many-many)
* Embedded Records. Both belongsTo and hasMany. Compatible with emberfire
* Atomic saving of relationship changes and, optionally, all changes
* An option to 'chroot' all the records under a base path
* An option to group a collection of records under an alternative path
* Optionally use Firebase push id's or UUID v1 or v4 for new records

### Defining Models

Models are defined by providing the following items

* `modelName` A string that identifies the name of the model. It should be unique to the model
* `pluralName` A string that defines the name of a collection of these records. It is used to define the path to store the data in firebase. In Ember Data this is automatically 'pluralized' from `modelName`. Currently you need to explicitly specify it.
* `schema` An object whose keys are the attributes of the model and whose values are the types of each attribute.
* The types of the attributes. These are used so Typescript can type check the model. Attributes that return relationships (that are not embedded) should be `ModelOrPromise<...>` or `ModelOrPromise<...>[]`.

For example (you can find this model at `tests/models/blog.ts`)


    import { attr, belongsTo, hasMany, Model, ModelOrPromise, Schema, Serializers} from 'ninjafire';
    import { Post, User } from '../models';

    export class Blog extends Model {

        public static modelName: string = 'blog';
        public static pluralName: string = 'blogs';

        public schema: Schema = {

            name: attr(Serializers.String),
            description: attr(Serializers.String),
            createdDate: attr(Serializers.Date, { defaultValue: (): Date => new Date() }),
            updatedTime: attr(Serializers.Number, { setToServerTimestampOnSave: true }),
            published: attr(Serializers.Boolean),
            featured: attr(Serializers.Boolean),
            ranking: attr(Serializers.Number),
            config: attr(Serializers.JSON),

            owner: belongsTo(User, { inverse: 'blog' }),
            posts: hasMany(Post, { inverse: 'blog' }),
        };

        public name: string;
        public description: string | null;
        public createdDate: Date;
        public updatedTime: number | null;
        public published: boolean;
        public featured: boolean;
        public ranking: number;
        public config: {} | null;

        public owner: ModelOrPromise<User> | null;
        public posts: ModelOrPromise<Post>[];
    }

### Schema Attributes

To define an attribute set the schema to `attr(Serializers.[Type])` the following are included:

* `Serializers.Boolean`
* `Serializers.Date`
* `Serializers.JSON` This will call JSON.stringify and JSON.parse on the value when serializing / deserializing
* `Serializers.Number` You can configure this type to automatically set the value to the server timestamp on save by passing options including `setToServerTimestampOnSave: true`
* `Serializers.String`

All serializers take a options object that can include a `defaultValue` function. It will be called when accessing the attribute if a value has not been specified and also `.save()`ing a record with no value set.

### Schema Relationships

Relationships to other records are either `belongsTo` or `hasMany`. Specify the class of the model for the relationship eg

    owner: belongsTo(User),
    posts: hasMany(Post),

Inverse relationships are _not_ automatically discovered (unlike Ember Data). You must explicitly state the key on the inverse model that is the inverse. You need to do this on both sides of the relationship.

    owner: belongsTo(User, { inverse: 'blog' }),
    posts: hasMany(Post, { inverse: 'blog' }),

`belongsTo` relationships return an object of `ModelOrPromise<T>`, where T is the model type. eg:

    public owner: ModelOrPromise<User>;

`hasMany` relationships return an object of `ModelOrPromise<T>[]`, which is to say an array containing `ModelOrPromise<T>` objects. eg:

    public posts: ModelOrPromise<Post>[];

If the related record(s) are loaded then they will be returned immediately, otherwise it will return a promise resolving to the record(s).

Unset relationships will return `null`. If the relationship may be `null` then specify this in the type definition, eg:

    public owner: ModelOrPromise<User> | null;

This will then ensure that you have appropriate null checks in place when using Typescript. Whether a record can be null or not should match your Firebase rule configuration.

When the `ModelOrPromise<T>` is currently a `Promise` it has `id` and `isLoading` properties in addition to the regular `Promise` properties.

If the related record is not found, i.e. the relationship is invalid, then an exception will be thrown.

### Initializing a Store

A store is initialized like so (where admin is an initialized firebase-admin instance). The module should also work with the regular firebase client but that has not yet been tested.

    const store: Store = new Store(admin.database());

You can optionally provide a basePath, eg `/local` that will 'chroot' all records under this location

    const store: Store = new Store(admin.database(), { basePath });

This 'basePath' functionality is not supported natively in emberfire yet, but there is a [PR to implement it](https://github.com/firebase/emberfire/pull/513) 

Additionally you can configure the store to use create records using a v1 or v4 UUID, rather than a Firebase push id. Like so

    const store: Store = new Store(admin.database(), { useUUID: 4 });

It is important to note that the created `store` is _not_ a singleton. Each store created will be independent. If you require a singleton then wrap a store in your own singleton.

### Creating a Record

Create a record like this

    const blog: Blog = store.createRecord(Blog, {
        id: '1234567890',
        name: 'The Blog Name,
    });

If an id is not provided a [Firebase push id](https://firebase.googleblog.com/2015/02/the-2120-ways-to-ensure-unique_68.html) will be assigned. Optionally you can configure the store to use a UUID instead, see above.

You can get/set attributes using the models properties eg

    const oldName = blog.name
    blog.name = 'An updated Name'

It can then be saved by calling

    await blog.save();

### Finding a Record

    const blog: Blog = await store.findRecord(Blog, '1234567890');

`store.findRecord` returns an object of `ModelOrPromise<T>` meaning it either immediately returns a model, or it returns a promise that will resolve to the model. If the model is not found an exception will be thrown

### Relating Records

Two way relationships in Firebase require an entry in the record on both sides of the relationship. `ninjafire` ensures these records stay in sync by performing the Firebase updates in a single atomic operation.

`ninjafire` tracks which relationships have changed and will save all related record when any one of the records is saved.

For example

    const blog: Blog = store.createRecord(Blog, { name: 'The Blog Name', });
    const post1: Post = store.createRecord(Post, { name: 'Post 1', });
    const post2: Post = store.createRecord(Post, { name: 'Post 2', });
    const user: Post = store.createRecord(Post, { name: 'User', });

    blog.posts = [post1, post];
    blog.owner = user;

Then saving any of the 4 objects will cause all 4 to save in one atomic update eg

    await user.save();

For this to work records that have had relationship changes must already be loaded into the store, either with findRecord, createRecord, or through traversing relationships. An exception will be thrown if they are not.

`ninjafire` will also unlink relationships when they change. Eg continuing with the above example:


    const newUser: Post = store.createRecord(Post, { name: 'Another User', });
    blog.owner = newUser;

    await blog.save();

This will update `blog`, `user` and `newUser`. Again for this to work all 3 records must be in the store. An exception will be thrown if they are not.

### Deleting Records

To delete a record call the `.deleteRecord()` method on the record. For relationships that have an inverse the related record will also be updated to remove the reference back to the record.

Note that this is an `async` operation, unlike in Ember Data. This is to support the retrieval and update of related records.

    await blog.deleteRecord();

Similarly to Ember Data `deleteRecord` will not automatically save that change. You will later need to perform a `save()` on the record.

If you want to immediately delete the record then perform `destroyRecord()`. This will delete and commit the deletion.

    await blog.destroyRecord();

### Embedded Records

`ninjafire` supports the same 'embedded records' style as used in emberfire ([details](https://github.com/firebase/emberfire/blob/master/docs/guide/relationships.md#embedded)). This means that a record can contain a belongsTo or hasMany relationship where the data for the target is nested under the parent record. 

Embedded records can be useful when you want to include an array like structure in a record and always want to retrieve the members in the same request as the parent record. It can result in fewer calls to Firebase. However embedded records can't be referenced in a relationship from anything other than their parent record. The embedded record can however reference other records via relationships.

To embed a record the model must be marked as embeddable like so (see `test/models/blog/post/photos.ts`)

    public static embedded: boolean = true;

Then in the parent record the relationship must contains an `embedded: true` option like so (see `test/models/blog/post.ts`):

    heroImage: belongsTo(Photo, { embedded: true }),
    photos: hasMany(Photo, { embedded: true }),


### Grouping Records

In addition to being able to set a base path for all records, you can 'group' types under an additional prefix. This is useful for, say, grouping all records relating to a team under a single path. This can help with performance and makes Firebase rules easier to write.

To set a group define an additional static property on the model, eg: 

    public static pathPrefixGroup: string = 'team';

Then tell the store what path to use for this group:

    store.pathPrefix.team = `/team/1234-1234-1234`;

Not all requests for models with the 'post' `pathPrefixGroup` will have `/team/1234-1234-1234` prefixed to their references.

See the `test/path-prefix-group.ts` file for an example of this in action.


### Saving all changes

You can commit all outstanding changes in an atomic operation by calling `saveAll()` on the store. Like this:

    await store.saveAll();

It will either commit all changes or error and commit none of them.

## Progress

The intent is to implement a largely similar API to Ember Data. All the documented features above have been implemented.

The following API has been implemented on the store

* createRecord
* findRecord
* unloadRecord
* unloadAll

Notably these methods have not yet been implemented

* query

The following API has been implemented on models

* save
* changedAttributes
* dirtyType
* hasDirtyAttributes
* isValid
* isLoading
* isSaving
* isNew
* rollbackAttributes
* unloadRecord
* deleteRecord
* destroyRecord


## Installation

This package is not yet published to npm/yarn. So you will need to install it directly form github like so:

With Yarn: 

  
```bash
yarn add "https://github.com/lineupninja/ninjafire.git"
```

Or alternatively with npm:

```bash
npm install --save-dev "https://github.com/lineupninja/ninjafire.git"
```

Because the package is not yet published to NPM it will compile itself when yarn/npm installs the module. This should happen transparently.

## Development

This project currently has 100% code coverage. The tests are currently performed against a live Firebase and need a bit of setup to run:

* Configure Firebase so that a user called `ninjafire` can access a path in the database
* Create a `.env` file with:
    * `FIREBASE_DATABASE_URL` set to your Firebase instance.
    * `FIREBASE_BASE_PATH` the path you want the tests to occur at. The `ninjafire` user must be able to read/write at this path.
* Place `serviceAccountKey.json` in the root of the project
* Install dependencies with `yarn`
* Open the project in VSCode and run either of the test launch configurations
    * `Run mocha tests` Has source maps, but no code coverage, test output is in the debug console
    * `Run mocha tests with code coverage` Has code coverage but no source maps, test output in the embedded terminal.
* Alternatively run `yarn test` which will perform the tests without code coverage.

## Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/lineupninja/ninjafire.

## Acknowledgements

This project was created by [Lineup Ninja](http://lineup.ninja). If you're planning a complex event, we can help you build your timetable!

## License

MIT License.
