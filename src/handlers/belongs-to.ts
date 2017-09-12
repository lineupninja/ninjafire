
import * as debug from 'debug';
import { Model } from '../model';
import { Serializer } from '../serializers/serializer';
import { AttributeHandler, AttributeHandlerAndType, HandlerTypes } from './types';
import { setInverse } from './utils/inverse';

const log: debug.IDebugger = debug('ninjafire:belongs-to');

export interface BelongsToHandlerOptions {
    embedded?: boolean;
    inverse?: string;
}

export function belongsTo<T extends Model>(recordClass: { modelName?: string; new(): T; }, options: BelongsToHandlerOptions = {}): AttributeHandlerAndType<T> {
    return {
        handlerType: HandlerTypes.belongsTo,
        options,
        handlingClass: recordClass,
        handler: (attribute: string): AttributeHandler => {
            return {
                // tslint:disable-next-line:no-any
                get: (record: Model): any => {
                    if (record.isDeleted) {
                        throw Error(`Record is deleted cannot get ${attribute}`);
                    }
                    if (record._localAttributes[attribute] !== undefined) {
                        return record._localAttributes[attribute] === null ? null : record.store.findRecord(recordClass, record._localAttributes[attribute]);
                    } else {
                        if (record._remoteAttributes[attribute] === undefined) {
                            return null;
                        } else if (options.embedded === true) {
                            // The id of an embedded record is stored as a property on the record itself
                            const id: string | undefined = record._remoteAttributes[attribute].id;
                            if (id === undefined) {
                                throw Error('Embedded record does not have an id property, cannot retrieve it');
                            } else {
                                const embeddedRecord = record._embeddedRecords[attribute][id] as T;
                                embeddedRecord._embeddedIn = record;
                                return embeddedRecord;
                            }
                        } else {
                            return record.store.findRecord(recordClass, record._remoteAttributes[attribute]);
                        }
                    }
                },
                set: <U, V extends Model | Serializer>(record: Model, value: U, handlingClass: { modelName?: string; new(): V; }): U => {
                    if (record.isDeleted) {
                        throw Error(`Record is deleted cannot set ${attribute}`);
                    }

                    // Regardless of whether the record is embedded or not, store the id in _localAttributes
                    // When saving the parent record the embedded record will be found in the store and embedded

                    // If this relationship points to an existing record, ensure that, if it has an inverse back to this record, that the inverse is set to null

                    // We know the type of value is a Model as belongsTo can only be set to models, so force that here
                    // tslint:disable-next-line:no-any

                    const otherRecord = value as {} as Model | null;

                    const existingRelatedRecordId: string | null = record._localAttributes[attribute] !== undefined ? record._localAttributes[attribute] : record._remoteAttributes[attribute] !== undefined ? record._remoteAttributes[attribute] : null;
                    if (existingRelatedRecordId !== null) {
                        setInverse(record, attribute, handlingClass, existingRelatedRecordId, options, false);
                    }

                    if (options.embedded && otherRecord !== null) {
                        otherRecord._embeddedIn = record;
                    }

                    if (otherRecord instanceof Model) {
                        if (options.embedded && otherRecord.embedded !== true) {
                            throw Error(`Record with id ${otherRecord.id} is not an embeddable record`);
                        }
                        record._localAttributes[attribute] = otherRecord.id;
                        setInverse(record, attribute, handlingClass, otherRecord.id, options, true);
                        return value;
                    } else if (otherRecord === null) {
                        record._localAttributes[attribute] = null;
                        return value;
                    } else if (typeof otherRecord === 'string') {
                        record._localAttributes[attribute] = otherRecord;
                        setInverse(record, attribute, handlingClass, otherRecord, options, true);
                        return value;
                    } else {
                        throw Error(`supplied value to set ${otherRecord} is not an instance of a model nor an id string`);
                    }
                },
            };
        },
    };
}

