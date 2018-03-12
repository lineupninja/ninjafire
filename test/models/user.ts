
import { attr, belongsTo, hasMany, Model, ModelOrPromise, Schema, Serializers } from '../../src';
import { Blog, Post } from '../models';

export class User extends Model {

    public static modelName: string = 'user';
    public static modelPath: string = 'users';

    public schema: Schema = {

        name: attr(Serializers.String),
        blog: belongsTo(Blog, { inverse: 'owner' }),
        posts: hasMany(Post, { inverse: 'authors' }),
    };

    public name: string;
    public blog: ModelOrPromise<Blog> | null;
    public posts: ModelOrPromise<Post>[];
}
