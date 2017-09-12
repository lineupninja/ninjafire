
import * as Debug from 'debug';
import { Model } from '../model';
import { Serializer } from '../serializers/serializer';
import { AttributeHandler, AttributeHandlerAndType, HandlerTypes } from './types';

const log: debug.IDebugger = Debug('ninjafire:attr');

export interface AttrHandlerOptions {
    setToServerTimestampOnSave?: boolean;
    defaultValue?: (() => {});
}


export function attr<T extends Serializer>(serializer: { modelName?: string; new(): T; }, options: AttrHandlerOptions = {}): AttributeHandlerAndType<T> {
    const s: Serializer = new serializer();
    return {
        handlerType: HandlerTypes.attr,
        handlingClass: serializer,
        options,
        handler: (attribute: string): AttributeHandler => {
            return {
                // tslint:disable-next-line:no-any
                get: (record: Model): any | null => {
                    log(`attr handler getting ${attribute}`);
                    if (record.isDeleted) {
                        throw Error(`Record is deleted cannot get ${attribute}`);
                    }
                    // Firebase does not store 'null' values so explicity return null if no local or remote attribute is set
                    return record._localAttributes[attribute] !== undefined
                        ? s.deserialize(record._localAttributes[attribute])
                        : record._remoteAttributes[attribute] !== undefined
                            ? s.deserialize(record._remoteAttributes[attribute])
                            : options.defaultValue !== undefined
                                ? options.defaultValue()
                                : null;
                },
                set: <U, V extends Model | Serializer>(record: Model, value: U, handlingClass: { new(): V; }): U => {
                    if (record.isDeleted) {
                        throw Error(`Record is deleted cannot set ${attribute}`);
                    }
                    log(`setting attr ${attribute} to ${value}`);
                    record._localAttributes[attribute] = value !== null ? s.serialize(value) : null;
                    return value;
                },
            };
        },
    };
}
