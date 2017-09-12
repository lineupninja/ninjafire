
import { attr, belongsTo, hasMany, Model, ModelOrPromise, Schema, Serializers } from '../../../src';
import { Blog, Comment, Photo, User } from '../../models';

export class Post extends Model {

    public static modelName: string = 'blog/post';
    public static pluralName: string = 'blog/posts';

    public schema: Schema = {

        title: attr(Serializers.String),
        blog: belongsTo(Blog, { inverse: 'posts' }),
        createdBy: belongsTo(User),
        authors: hasMany(User, { inverse: 'posts' }),
        heroImage: belongsTo(Photo, { embedded: true }),
        photos: hasMany(Photo, { embedded: true }),
        comments: hasMany(Comment, { inverse: 'post' }),
    };

    public title: string;
    public blog: ModelOrPromise<Blog> | null; // nullable to help with testing
    public createdBy: ModelOrPromise<User> | null;
    public authors: ModelOrPromise<User>[];
    public heroImage: Photo | null;
    public photos: Photo[];
    public comments: Comment[];

}

