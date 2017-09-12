
import * as debug from 'debug';
import * as admin from 'firebase-admin';
import { v1, v4 } from 'uuid';
import { HandlerOptions, HandlerTypes, isAttrHandlerOptions, isBelongsToHandlerOptions, isHasManyHandlerOptions, Schema, throwBadHandler } from './handlers';
import { Store } from './store';

const log: debug.IDebugger = debug('ninjafire:model');

/**
 * The promises returned by the model contain an extra 'id' attribute that is available prior to the promise being resolved.
 * This enables records to be added and removed from relationships without having to retrieve the record first
 */
export interface ModelPromise<T> extends Promise<T> {
    id: string;
    isLoading: boolean;
    _path?: string;
    _ref?: admin.database.Reference;
}

export type ModelOrPromise<T extends Model> = T | ModelPromise<T>;

export abstract class Model {

    public static modelName: string;
    public static pluralName: string;
    public static embedded: boolean = false; // The model is for embedding within another

    public get modelName(): string {
        return (this.constructor as typeof Model).modelName;
    }
    public get pluralName(): string {
        return (this.constructor as typeof Model).pluralName;
    }
    public get embedded(): boolean {
        return (this.constructor as typeof Model).embedded;
    }


    /**
     * A model can return a pathPrefixGroup to 'chroot' the record under a specific location
     * this will be inserted between the basePath configured in the store and the generated path from this.modelName
     * It is intended to be used to group records by team etc.
     *
     * The path for the group needs to be registered with the store
     */

    public static pathPrefixGroup: string | null = null;
    public get pathPrefixGroup(): string | null {
        return (this.constructor as typeof Model).pathPrefixGroup;
    }

    public abstract schema: Schema;

    public id: string;


    public isValid: boolean = false;
    public isLoading: boolean = false; // Always false on the model itself, true on the wrapped promise.
    public loadingPromise: ModelPromise<Model> | null = null;
    public isSaving: boolean = false;
    public isNew: boolean = false;
    public isDeleted: boolean = false;

    public get hasDirtyAttributes(): boolean {
        return Object.keys(this._localAttributes).length !== 0 || this.isNew || this.isDeleted;
    }

    /**
     * The reason the record is dirty
     * 'created' if the record is new
     * 'updated' if the record has been updated
     * 'deleted' if the record has been deleted but not yet committed
     */

    public get dirtyType(): string | null {

        return this.isDeleted ? 'deleted' : this.isNew ? 'created' : this.hasDirtyAttributes ? 'updated' : null;

    }

    /**
     * Returns the path to the record in firebase
     * Intended for use internally within `ninjafire` only
     *
     * The path to the record is the concatenation of
     * The base path in the store
     * Any specific path required for this PathPrefixGroup
     * The plural name for the model
     * The id for the record
     */
    public get _path(): string {
        let path: string = this.store.basePath;
        if (this.pathPrefixGroup !== null) {
            const pathPrefix = this.store.pathPrefix[this.pathPrefixGroup];
            if (pathPrefix === null || pathPrefix === undefined) {
                throw Error(`Path prefix ${this.pathPrefixGroup} is not configured in the store`);
            }
            path += pathPrefix;
        }
        path += `/${this.pluralName}/${this.id}`;
        return path;
    }

    public _ref: admin.database.Reference | null = null;

    public _remoteAttributes: object = {}; // The state of the object in Firebase (as last seen)
    public _localAttributes: object = {}; // Any local attribute changes that have not yet been submitted
    public _atomicallyLinked: Model[] = []; // Other records that will be saved when this record is saved

    public store: Store;

    public _embeddedRecords: { [attribute: string]: { [id: string]: Model } } = {}; // Any embedded records that have been accessed via their hasMany or belongsTo relationship - This is used to track future updates
    public _embeddedIn: Model | null = null; // The record this embedded record is attached to

    constructor(store: Store | null = null, id: string | null = null) {
        if (store === null) {
            // Store is not set to be required to make passing the class around easier
            throw Error('Store must be provided when actually initializing the object');
        }
        this.store = store;
        if (id) {
            this.id = id;
        } else {
            // The id is set to a v4 if not provided
            if (this.store._useUUID !== null) {
                switch (this.store._useUUID) {
                    case 1:
                        this.id = v1();
                        break;
                    case 4:
                        this.id = v4();
                        break;
                    default:
                        throw Error(`Unsupported UUID version requested ${this.store._useUUID}, valid versions are 1 and 4`);
                }
            } else {
                // Use the firebase generated key. See: https://firebase.google.com/docs/reference/js/firebase.database.Reference#push
                const path: string = this._path;
                log(`looking for record at path ${path}`);
                this._ref = this.store.database.ref(path).push();
                this.id = this._ref.key as string;
            }
        }
    }

    /**
     * Saves the record by informing the store, or the record this record is embedded in that it needs to be saved
     */
    public async save(): Promise<void> {

        if (this._embeddedIn !== null && this._embeddedIn !== undefined) {
            await this._embeddedIn.save();
        } else if (this.embedded === true) {
            throw Error('record can only be saved when embedded');
        } else {
            await this.store._save(this);
        }

    }
    /**
     * Returns the paths that need to be updated in firebase to save this record
     * @param parentPath Default null. By default the path will be determined from the model, but for embedded records provide the path to the record that the child is embedded in
     */

    public _pathsToSave(parentPath: string | null = null): { [key: string]: number | string | null } {

        if (this.isDeleted) {

            // If the entire record has been deleted the set the path for the record to null
            const recordPath: string = parentPath === null ? this._path : parentPath;
            return {
                [recordPath]: null,
            };

        } else {

            // Check for any 'defaultValue' schema fields and populate values if the local and remote value is not set
            Object.keys(this.schema).map((key: string) => {
                if (this.schema[key].handlerType === HandlerTypes.attr) {
                    const options: HandlerOptions = this.schema[key].options;
                    if (this._localAttributes[key] === undefined
                        && this._remoteAttributes[key] === undefined
                        && isAttrHandlerOptions(options)
                        && typeof options.defaultValue === 'function'
                    ) {
                        this[key] = options.defaultValue();
                    }
                }
            });
            // Set any 'setToServerTimestampOnSave' fields
            Object.keys(this.schema).map((key: string) => {
                if (this.schema[key].handlerType === HandlerTypes.attr) {
                    const options: HandlerOptions = this.schema[key].options;
                    if (isAttrHandlerOptions(options)
                        && options.setToServerTimestampOnSave === true
                    ) {
                        this._localAttributes[key] = admin.database.ServerValue.TIMESTAMP;
                    }
                }
            });

            const updates: {} = {};

            Object.keys(this._localAttributes).map((key: string) => {

                if (this.schema[key] !== undefined) { // Only process attributes that are in the schema

                    const attributePath: string = parentPath === null ? `${this._path}/${key}` : `${parentPath}/${key}`;
                    const options: HandlerOptions = this.schema[key].options;

                    const handlerType: HandlerTypes = this.schema[key].handlerType;

                    switch (handlerType) {

                        case HandlerTypes.attr:
                            updates[attributePath] = this._localAttributes[key];
                            break;

                        case HandlerTypes.belongsTo:
                            if (isBelongsToHandlerOptions(options)
                                && options.embedded === true
                                && this._localAttributes[key] !== null) {
                                // Skipping handled later

                            } else {
                                updates[attributePath] = this._localAttributes[key];
                            }

                            break;

                        case HandlerTypes.hasMany:
                            // Each change in the hasMany map needs to be applied as a single path update so unchanged relationships are not impacted
                            Object.keys(this._localAttributes[key]).map((relatedId: string) => {

                                const relatedPath: string = `${attributePath}/${relatedId}`;

                                // Handle Embedded Records
                                if (isHasManyHandlerOptions(options)
                                    && options.embedded === true) {
                                    // Skipping handled later
                                } else {
                                    updates[relatedPath] = this._localAttributes[key][relatedId];
                                }
                            });
                            break;

                        default:
                            throwBadHandler(handlerType);
                    }

                }
            });

            // Process embedded records. The 'localAttribute' may not change changed if the property change has only been made in the embedded record itself

            const allAttributes: object = {};
            Object.assign(allAttributes, this._localAttributes, this._remoteAttributes);

            // Map through active keys in the schema
            Object.keys(allAttributes).filter((key: string) => this.schema[key] !== undefined).map((key: string) => {

                const attributePath: string = parentPath === null ? `${this._path}/${key}` : `${parentPath}/${key}`;
                const options: HandlerOptions = this.schema[key].options;

                if (this.schema[key].handlerType === HandlerTypes.belongsTo) {

                    if (isBelongsToHandlerOptions(options)
                        && options.embedded === true) {

                        if (this._localAttributes[key] !== null) {

                            const relatedId = this._localAttributes[key] !== undefined ? this._localAttributes[key] : this._remoteAttributes[key].id;

                            // We know handlingClass is a model class not a serializer so cast it
                            const handlingClass = this.schema[key].handlingClass as { modelName?: string; new(store: Store, id: string): Model; };
                            const embeddedRecord = this.store.peekRecord(handlingClass, relatedId);

                            if (embeddedRecord) {
                                if (embeddedRecord.isDeleted) {
                                    // The embedded record is marked for deletion, just set the path to null
                                    updates[attributePath] = null;
                                } else {
                                    // Take the updates needed to save the embedded record and merge those into the paths being updated
                                    const updatePaths = embeddedRecord._pathsToSave(attributePath);
                                    // For embedded records the id of the record is stored as an attribute in firebase
                                    updatePaths[`${attributePath}/id`] = embeddedRecord.id;
                                    Object.assign(updates, updatePaths);
                                }
                            } else {
                                throw Error(`Embedded belongsTo record with id ${relatedId} was not found in store, it must be loaded before it can be saved`);
                            }
                        } else {
                            updates[attributePath] = null;
                        }
                    }

                } else if (this.schema[key].handlerType === HandlerTypes.hasMany) {

                    // Each change in the hasMany map needs to be applied as a single path update so unchanged relationships are not impacted
                    Object.keys(allAttributes[key]).map((relatedId: string) => {

                        const relatedPath: string = `${attributePath}/${relatedId}`;

                        // Handle Embedded Records
                        if (isHasManyHandlerOptions(options)
                            && options.embedded === true) {

                            // Test _localAttributes isn't null, because Object.Assign will overlay existing remoteAttributes over localAttributes if local is null

                            if (this._localAttributes[key] !== undefined && this._localAttributes[key][relatedId] === null) {
                                updates[`${attributePath}/${relatedId}`] = null;
                            } else {
                                // We know handlingClass is a model class not a serializer so cast it
                                const handlingClass = this.schema[key].handlingClass as { modelName?: string; new(store: Store, id: string): Model; };
                                const embeddedRecord = this.store.peekRecord(handlingClass, relatedId);

                                if (embeddedRecord) {
                                    // Take the updates needed to save the embedded record and merge those into the paths being updated
                                    const updatePaths = embeddedRecord._pathsToSave(relatedPath);
                                    Object.assign(updates, updatePaths);
                                } else {
                                    throw Error(`Embedded hasMany record with id ${relatedId} was not found in store, it must be loaded before it can be saved`);
                                }
                            }
                        }
                    });

                }
            });
            return updates;
        }
    }


    /**
     * Returns an object whose keys are changed attributes and value is an [oldProp, newProp] array
     * This array represents a diff of the canonical state with the local state of the model.
     * Note: If the model is created locally the canonical state is empty since there is no remote record
     */

    public changedAttributes(): { [key: string]: [{}, {}] } {
        const changedAttributes: {} = {};
        Object.keys(this._localAttributes).map((key: string) => {
            changedAttributes[key] = [this._remoteAttributes[key], this._localAttributes[key]];
        });
        return changedAttributes;
    }

    /**
     * If the record `hasDirtyAttributes` they will be rolled back.
     * If the record `isNew` it will be removed from the store
     */

    public rollbackAttributes(): void {
        if (this.isDeleted) {
            throw Error('Rollback of attributes on deleted records has not yet been implemented');
        }
        this._localAttributes = {};
        if (this.isNew) {
            this.isDeleted = true;
        }
    }

    /**
     * Unloads the record from the store. This will cause the record to be destroyed and freed up for garbage collection.
     */
    public async unloadRecord(): Promise<void> {
        await this.store.unloadRecord(this);
    }

    /**
     * Marks the record as deleted and removes inverse relationships on related records
     *
     * Please note this method is async unlike in Ember Data. This is because it will load related records
     * into the store if they are not already present so the inverse relationships can be updated.
     */

    public async deleteRecord(): Promise<void> {

        // Firstly ensure all related records, that have inverses, are loaded into the store then the relationships set to null
        // This will automatically atomically link the records so a future save operation will update both sides of the record

        await Promise.all(Object.keys(this.schema).map(async (key: string) => {
            const options = this.schema[key].options;
            if (this.schema[key].handlerType === HandlerTypes.belongsTo && isBelongsToHandlerOptions(options)) {
                if (options.inverse !== undefined) {
                    // record being deleted, potentially has a related record
                    await this[key];
                    this[key] = null;
                }
            } else if (this.schema[key].handlerType === HandlerTypes.hasMany && isHasManyHandlerOptions(options)) {

                if (options.inverse !== undefined) {

                    const relatedRecords: ModelOrPromise<Model>[] = this[key];

                    const inverseKey = options.inverse;
                    await Promise.all(
                        relatedRecords.map(
                            async (relatedRecordOrPromise: ModelOrPromise<Model>) => {
                                await relatedRecordOrPromise;
                            },
                        ),
                    );
                    this[key] = [];
                }
            }
        }));

        // Relationships nullified, mark this record as deleted
        this.isDeleted = true;
    }

    /**
     * Deletes the record then immediately saves that deletion
     */

    public async destroyRecord(): Promise<void> {
        await this.deleteRecord();
        await this.save();
    }

    /**
     * Set the attributes for the model from an object
     * All attributes must be passed. Any local changes will not be affected
     * @param object Any object describing the keys and values for the model
     */

    public setAttributesFrom(object: {}): void {
        this._remoteAttributes = {};
        Object.keys(object).map((key: string) => {
            if (key in this.schema) {
                log(`going to set ${key} -> ${object[key]}`);
                this._remoteAttributes[key] = object[key];

                const options = this.schema[key].options;
                if ((isBelongsToHandlerOptions(options) || isHasManyHandlerOptions(options)) && options.embedded === true) {
                    // Record is embedded
                    // We know handlingClass is a model class not a serializer so cast it
                    const handlingClass = this.schema[key].handlingClass as { modelName?: string; new(store: Store): Model; };

                    const handlerType: HandlerTypes = this.schema[key].handlerType;
                    switch (handlerType) {

                        case HandlerTypes.belongsTo:

                            const embeddedRecordId = object[key].id;
                            if (this._embeddedRecords[key] !== undefined) {
                                // A record has previously been loaded
                                if (this._embeddedRecords[key][embeddedRecordId] !== undefined) {
                                    // The loaded record is for this id
                                    this.store.pushRecordData(this._embeddedRecords[key][embeddedRecordId], object[key]);
                                } else {
                                    // The loaded record has a different id
                                    delete this._embeddedRecords[key][embeddedRecordId];
                                    const record = this.store.pushRecord(handlingClass, embeddedRecordId, object[key]);
                                    this._embeddedRecords[key][embeddedRecordId] = record;
                                }
                            } else {
                                // No record previously loaded for this key
                                const record = this.store.pushRecord(handlingClass, embeddedRecordId, object[key]);
                                this._embeddedRecords[key] = {};
                                this._embeddedRecords[key][embeddedRecordId] = record;

                            }
                            break;

                        case HandlerTypes.hasMany:

                            // hasMany embed
                            const ids: string[] = Object.keys(object[key]);

                            if (this._embeddedRecords[key] !== undefined) {

                                // There are some loaded records
                                ids.map((id: string) => {
                                    if (this._embeddedRecords[key][id] !== undefined) {
                                        // There is a loaded record with this ID
                                        this.store.pushRecordData(this._embeddedRecords[key][id], object[key]);
                                    } else {
                                        // There is no loaded record with this id
                                        const record = this.store.pushRecord(handlingClass, id, object[key]);
                                        this._embeddedRecords[key][id] = record;
                                    }
                                });

                            } else {

                                // There are no loaded records for this key
                                this._embeddedRecords[key] = {};
                                ids.map((id: string) => {
                                    const record = this.store.pushRecord(handlingClass, id, object[key][id]);
                                    this._embeddedRecords[key][id] = record;
                                });
                            }

                            break;
                        case HandlerTypes.attr:
                            throw Error('Handler Type must be belongsTo or hasMany for an embedded record, however schema has "attr"');
                        default:
                            throwBadHandler(handlerType);
                    }
                }
            }
        });
    }

    public _willUnload(): void {
        if (this._ref !== undefined && this._ref !== null) {
            log(`removing ref for ${this.id}`);
            this._ref.off();
            this._ref = null;
        }
    }
    /**
     * Creates a new firebase ref and retrieves the current value
     * Mostly used by the tests
     * @param attribute The attribute to retrieve
     */

    // tslint:disable-next-line:no-any
    public async rawFirebaseValue(attribute: string): Promise<any> {
        const snapshot = await this.store.database.ref(this._path).once('value');
        const val = snapshot.val();
        return val[attribute];
    }

    /**
     * Record will start saving
     * Called by the store
     */

    public _willSave(): void {
        this.isSaving = true;
    }

    /**
     * Record completed saving
     * Called by the store
     */

    public async _didSave(): Promise<void> {
        // Ensure this record is linked to firebase
        await this.store._linkToFirebase(this);
        this.isSaving = false;
        this.isNew = false;
        // Clear local attributes as change has been saved
        this._localAttributes = {};

    }
}
