
import { attr, belongsTo, hasMany, Model, ModelOrPromise, Schema, Serializers } from '../../src';
import { Post, User } from '../models';

export class Blog extends Model {

    public static modelName: string = 'blog';
    public static pluralName: string = 'blogs';

    public schema: Schema = {

        name: attr(Serializers.String),
        description: attr(Serializers.String),
        createdDate: attr(Serializers.Date, { defaultValue: (): Date => new Date() }),
        updatedTime: attr(Serializers.Number, { setToServerTimestampOnSave: true }),
        published: attr(Serializers.Boolean),
        featured: attr(Serializers.Boolean),
        ranking: attr(Serializers.Number),
        config: attr(Serializers.JSON),

        owner: belongsTo(User, { inverse: 'blog' }),
        posts: hasMany(Post, { inverse: 'blog' }),
    };

    public name: string;
    public description: string | null;
    public createdDate: Date;
    public updatedTime: number | null;
    public published: boolean;
    public featured: boolean;
    public ranking: number;
    public config: {} | null;

    public owner: ModelOrPromise<User> | null;
    public posts: ModelOrPromise<Post>[];
}

