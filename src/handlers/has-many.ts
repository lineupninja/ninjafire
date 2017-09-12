
import * as debug from 'debug';
import { Model, ModelOrPromise, ModelPromise } from '../model';
import { Serializer } from '../serializers/serializer';
import { AttributeHandler, AttributeHandlerAndType, HandlerTypes } from './types';
import { setInverse } from './utils/inverse';

const log: debug.IDebugger = debug('ninjafire:has-many');

// https://ponyfoo.com/articles/more-es6-proxy-traps-in-depth

/**
 * Arrays representing a hasMany attribute are wrapped using this proxy handler
 * This ensures that changes to the array (such as pushing new items) are reflected in an update to the attribute
 */
export const hasManyArrayProxyHandler: ProxyHandler<HasManyArray<ModelOrPromise<Model>>> = {

    set(target: HasManyArray<ModelOrPromise<Model>>, key: string, value: Model): boolean {
        // tslint:disable-next-line:no-unused-expression
        Reflect.set(target, key, value);
        if (target._record !== undefined && target._attribute !== undefined) {
            target._record[target._attribute] = target;
        }
        return true;
    },
};

export interface HasManyArray<T> extends Array<T> {
    _record?: Model;
    _attribute?: string;
}

export interface HasManyHandlerOptions {
    embedded?: boolean;
    inverse?: string;
}

export function hasMany<T extends Model>(recordClass: { modelName?: string; new(): T; }, options: HasManyHandlerOptions = {}): AttributeHandlerAndType<T> {
    return {
        handlerType: HandlerTypes.hasMany,
        options,
        handlingClass: recordClass,
        handler: (attribute: string): AttributeHandler => {
            return {
                get: (record: Model): HasManyArray<T | ModelPromise<T>> => {

                    if (record.isDeleted) {
                        throw Error(`Record is deleted cannot get ${attribute}`);
                    }
                    // Current related items are the remotely stored relationships with local changed overlaid

                    const hasManyMap: {} = {};
                    Object.assign(hasManyMap, record._remoteAttributes[attribute], record._localAttributes[attribute]);

                    if (options.embedded === true) {
                        const relatedIds: string[] = Object.keys(hasManyMap);
                        const relatedRecords: HasManyArray<T> = [];
                        relatedIds.map((id: string) => {
                            if (record._embeddedRecords[attribute] && record._embeddedRecords[attribute][id]) {
                                // This record has already been seen
                                record._embeddedRecords[attribute][id]._embeddedIn = record;
                                relatedRecords.push(record._embeddedRecords[attribute][id] as T);
                            } else {
                                const embeddedRecord: T = record.store.pushRecord(recordClass, id, hasManyMap[id]) as T;
                                embeddedRecord._embeddedIn = record;
                                relatedRecords.push(embeddedRecord);
                                if (!record._embeddedRecords[attribute]) {
                                    record._embeddedRecords[attribute] = {};
                                }
                                record._embeddedRecords[attribute][id] = embeddedRecord;
                            }
                        });
                        relatedRecords._record = record;
                        relatedRecords._attribute = attribute;
                        return new Proxy(relatedRecords, hasManyArrayProxyHandler) as HasManyArray<T | ModelPromise<T>>;
                    } else {
                        // Filter out 'null' items from the hasManyMap. These are unlinked related items that are pending being saved
                        const relatedIds: string[] = Object.keys(hasManyMap).filter((id: string) => hasManyMap[id] === true);
                        const relatedRecords: HasManyArray<T | ModelPromise<T>> = [];
                        relatedIds.map((id: string) => relatedRecords.push(record.store.findRecord(recordClass, id)));
                        relatedRecords._record = record;
                        relatedRecords._attribute = attribute;
                        return new Proxy(relatedRecords, hasManyArrayProxyHandler) as HasManyArray<T | ModelPromise<T>>;
                    }
                },
                set: <U, V extends Model | Serializer>(record: Model, value: U, handlingClass: { modelName?: string; new(): V; }): U => {

                    if (record.isDeleted) {
                        throw Error(`Record is deleted cannot get ${attribute}`);
                    }

                    log('setting hasMany %O to array? %O %O', attribute, Array.isArray(value));
                    if (Array.isArray(value)) {

                        record._localAttributes[attribute] = record._localAttributes[attribute] === undefined ? {} : record._localAttributes[attribute];

                        // hasManyMap matches the data structure in firebase, i.e. a map of record id to true or null
                        // null will only be found in _localAttributes as when saved to firebase the value is removed
                        // Merge both remote and local attributes to get the current state. _removeAttributes may change
                        // in real time, so apply the local changes as an overlay

                        const existingMappedRecords: { [recordId: string]: true | null } = {};
                        Object.assign(existingMappedRecords, record._remoteAttributes[attribute], record._localAttributes[attribute]);


                        // Value contains the currently related items, add missing items to the hasManyMap
                        value.map((relatedRecord: Model) => {
                            const id = relatedRecord.id;
                            if (options.embedded && relatedRecord.embedded !== true) {
                                throw Error(`Record with id ${relatedRecord.id} is not an embeddable record`);
                            }
                            if (existingMappedRecords[id] !== true) {
                                setInverse(record, attribute, handlingClass, id, options, true);
                                record._localAttributes[attribute][id] = true;
                            }
                        });
                        // If a previous item in the hasManyMap is no longer in 'value' then it needs to be removed
                        Object.keys(existingMappedRecords).map((existingRelatedRecordId: string) => {
                            if (value.filter((recordInNewValue: Model) => recordInNewValue.id === existingRelatedRecordId).length === 0) {
                                // The exiting relationship is not in the new record so needs to be set to null
                                setInverse(record, attribute, handlingClass, existingRelatedRecordId, options, false);
                                record._localAttributes[attribute][existingRelatedRecordId] = null;

                            }
                        });
                        return value;
                    } else if (typeof value === 'object') {
                        // Format of value is already in { id: true/false } format
                        record._localAttributes[attribute] = value;
                        return value;
                    } else {
                        throw Error(`supplied value to set ${value} is not an instance of a model nor a mapping of ids`);
                    }
                },
            };
        },
    };
}
