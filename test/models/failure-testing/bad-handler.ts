
import * as Debug from 'debug';
import { AttributeHandler, AttributeHandlerAndType, HandlerTypes } from '../../../src/handlers/types';
import { Model } from '../../../src/model';
import { Serializer } from '../../../src/serializers/serializer';

const log: debug.IDebugger = Debug('ninjafire:attr');

// tslint:disable-next-line:no-empty-interface
export interface BadHandlerOptions { }


export function badHandler<T extends Model>(recordClass: { modelName?: string; new(): T; }, options: BadHandlerOptions = {}): AttributeHandlerAndType<T> {
    return {
        handlerType: 9999999,
        handlingClass: recordClass,
        options,
        handler: (attribute: string): AttributeHandler => {
            return {
                // tslint:disable-next-line:no-any
                get: (record: Model): any | null => {
                    return null;
                },
                set: <U, V extends Model | Serializer>(record: Model, value: U, handlingClass: { new(): V; }): U => {
                    return value;
                },
            };
        },
    };
}
