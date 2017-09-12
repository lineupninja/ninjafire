
import { Model } from '../model';
import { Serializer } from '../serializers/serializer';
import { AttrHandlerOptions } from './attr';
import { BelongsToHandlerOptions } from './belongs-to';
import { HasManyHandlerOptions } from './has-many';

export enum HandlerTypes {
    attr,
    hasMany,
    belongsTo,
}

export interface AttributeHandler {
    // tslint:disable-next-line:no-any
    get(record: Model): any;
    set<T, U extends Model | Serializer>(record: Model, value: T, handlingClass: { modelName?: string; new(): U; }): T;
}

export type HandlerOptions = AttrHandlerOptions | BelongsToHandlerOptions | HasManyHandlerOptions;

export interface AttributeHandlerAndType<T extends Model | Serializer> {
    options: AttrHandlerOptions | BelongsToHandlerOptions | HasManyHandlerOptions;
    handlingClass: { modelName?: string; new(): T; };
    handlerType: HandlerTypes;
    handler(attribute: string): AttributeHandler;
}

export interface Schema {
    [attribute: string]: AttributeHandlerAndType<Model | Serializer>;
}
/**
 * Returns true if the options object looks like a AttrHandlerOptions. It also informs tsc that this is the case.
 * @param object options to check
 */
export function isAttrHandlerOptions(object: HandlerOptions): object is AttrHandlerOptions {
    const allowedOptions = ['setToServerTimestampOnSave', 'defaultValue'];
    return objectContainsAllowableOptions(object, allowedOptions);
}

/**
 * Returns true if the options object looks like BelongsToHandlerOptions. It also informs tsc that this is the case.
 * @param object options to check
 */
export function isBelongsToHandlerOptions(object: HandlerOptions): object is BelongsToHandlerOptions {
    const allowedOptions = ['embedded', 'inverse'];
    return objectContainsAllowableOptions(object, allowedOptions);
}

/**
 * Returns true if the options object looks like HasManyHandlerOptions. It also informs tsc that this is the case.
 * @param object options to check
 */
export function isHasManyHandlerOptions(object: HandlerOptions): object is HasManyHandlerOptions {
    const allowedOptions = ['embedded', 'inverse'];
    return objectContainsAllowableOptions(object, allowedOptions);
}

/**
 * This function exists to ensure that switches for handler types are exhaustive.
 * It should be set as the 'default' case on the switch statement, it will only be reached if all handler types are not covered
 * See https://stackoverflow.com/a/39419171/8296409
 * @param handler an uncovered handler type
 */

export function throwBadHandler(handler: never): never {
    throw Error('invalid handler type reached. Is the case statement exhaustive?');
}

/**
 * Utility function to check whether the supplied object contains keys that are not in the supplied list
 */

function objectContainsAllowableOptions(object: HandlerOptions, options: string[]): boolean {

    return Object.keys(object).reduce(
        (previous: boolean, current: string) => options.includes(current) === false ? false : previous, true,
    );

}
