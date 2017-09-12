
import { attr, belongsTo, hasMany, Model, ModelOrPromise, Schema, Serializers } from '../../../../../src';
import { Comment, User } from '../../../../models';

export class Vote extends Model {

    public static modelName: string = 'comment/vote';
    public static pluralName: string = 'comment/votes';
    public static pathPrefixGroup: string = 'post';

    public schema: Schema = {

        score: attr(Serializers.Number),

        comment: belongsTo(Comment, { inverse: 'votes' }),
        user: belongsTo(User),
    };

    public score: Number;

    public comment: ModelOrPromise<Comment>;
    public user: ModelOrPromise<User>;

}

