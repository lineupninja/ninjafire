
import { Serializer } from './serializer';

/**
 * Firebase supports string as a native type so this serializer just passes values through unmodified
 */

export class StringSerializer extends Serializer {
    public serialize(value: string): string {
        if (typeof value !== 'string') {
            throw Error(`serializing ${value} got ${typeof value} but expected string`);
        }
        return value;
    }

    public deserialize(value: string): string {
        if (typeof value !== 'string') {
            throw Error(`deserializing ${value} got ${typeof value} but expected string`);
        }
        return value;
    }
}
