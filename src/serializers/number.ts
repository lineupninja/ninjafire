
import { Serializer } from './serializer';
/**
 * Firebase supports number as a native type so this serializer just passes values through unmodified
 */

export class NumberSerializer extends Serializer {
    public serialize(value: number): number {
        if (typeof value !== 'number') {
            throw Error(`serializing ${value} got ${typeof value} but expected number`);
        }
        return value;
    }

    public deserialize(value: number): number {
        if (typeof value !== 'number') {
            throw Error(`deserializing ${value} got ${typeof value} but expected number`);
        }
        return value;
    }
}
