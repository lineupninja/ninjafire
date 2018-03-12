
import { attr, belongsTo, hasMany, Model, ModelOrPromise, Schema } from '../../../src';
import { Bad } from '../../models';

export class EmbeddedInverse extends Model {

    public static modelName: string = 'bad';
    public static modelPath: string = 'bads';
    public static embedded: boolean = true;

    public schema: Schema = {

        related: belongsTo(Bad, { inverse: 'embedded' }),

    };

    public related: ModelOrPromise<Bad>;
}

