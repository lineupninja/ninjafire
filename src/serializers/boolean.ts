
import { Serializer } from './serializer';
/**
 * Firebase supports boolean as a native type so this serializer just passes values through unmodified
 */

export class BooleanSerializer extends Serializer {
    public serialize(value: boolean): boolean {
        if (typeof value !== 'boolean') {
            throw Error(`serializing ${value} got ${typeof value} but expected boolean`);
        }
        return value;
    }

    public deserialize(value: boolean): boolean {
        if (typeof value !== 'boolean') {
            throw Error(`deserializing ${value} got ${typeof value} but expected boolean`);
        }
        return value;
    }
}
