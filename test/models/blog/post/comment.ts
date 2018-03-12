
import { attr, belongsTo, hasMany, Model, ModelOrPromise, Schema, Serializers } from '../../../../src';
import { Post, User, Vote } from '../../../models';

export class Comment extends Model {

    public static modelName: string = 'comment';
    public static modelPath: string = 'comments';
    public static pathPrefixGroup: string = 'post';

    public schema: Schema = {

        post: belongsTo(Post, { inverse: 'comments' }),
        text: attr(Serializers.String),
        votes: hasMany(Vote, { inverse: 'comment' }),
    };

    public post: ModelOrPromise<Post>;
    public text: string;
    public votes: ModelOrPromise<Vote>[];

}

