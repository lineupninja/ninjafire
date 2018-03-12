
import { attr, belongsTo, hasMany, Model, ModelOrPromise, Schema, Serializers } from '../../../src';
import { EmbeddedInverse, InvalidInverse, Photo, User } from '../../models';
import { badHandler } from './bad-handler';

// tslint:disable:no-any

export class Bad extends Model {

    public static modelName: string = 'bad';
    public static modelPath: string = 'bads';

    public schema: Schema = {
        aNumber: attr(Serializers.Number),
        embeddedInverse: belongsTo(EmbeddedInverse, { embedded: true, inverse: 'related' }),
        invalidEmbedBelongsTo: belongsTo(User, { embedded: true }), // The user model is valid but it is not embeddable
        invalidEmbedHasMany: hasMany(User, { embedded: true }), // The user model is valid but it is not embeddable
        invalidInverse: belongsTo(InvalidInverse, { inverse: 'invalidKey' }),
        badHandler: badHandler(InvalidInverse),
        invalidEmbedHandlerAttr: attr(Serializers.String, { embedded: true } as any),
        invalidEmbedHandlerOther: badHandler(Photo, { embedded: true } as any),
    };

    public aNumber: number;
    public embeddedInvese: ModelOrPromise<EmbeddedInverse>;
    public invalidEmbedBelongsTo: ModelOrPromise<User>;
    public invalidEmbedHasMany: ModelOrPromise<User>[];
    public invalidInverse: ModelOrPromise<InvalidInverse>;
}

