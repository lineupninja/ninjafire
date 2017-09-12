
import { Serializer } from './serializer';

export class DateSerializer extends Serializer {
    public serialize(value: Date | number): string {
        if (typeof value === 'number') {
            const date = new Date(value);
            return date.toUTCString();
        } else if (typeof value === 'string') {
            return value;
        } else {
            return value.toUTCString();
        }
    }

    public deserialize(value: string | number): Date {
        if (typeof value === 'string') {
            return new Date(Date.parse(value));
        } else {
            if (typeof value !== 'number') {
                throw Error(`deserializing ${value} got ${typeof value} but expected number or string`);
            }
            return new Date(value);
        }
    }
}
