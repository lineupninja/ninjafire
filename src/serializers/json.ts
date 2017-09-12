
import { Serializer } from './serializer';

export class JSONSerializer extends Serializer {
    public serialize(value: {}): string {
        if (typeof value !== 'object') {
            throw Error(`serializing ${value} got ${typeof value} but expected string`);
        }
        return JSON.stringify(value);
    }

    public deserialize(value: string): {} {
        if (typeof value !== 'string') {
            throw Error(`deserializing ${value} got ${typeof value} but expected string`);
        }
        return JSON.parse(value);
    }
}
