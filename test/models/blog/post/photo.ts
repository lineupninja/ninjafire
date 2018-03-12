
import { attr, belongsTo, hasMany, Model, ModelOrPromise, Schema, Serializers } from '../../../../src';
import { User } from '../../../models';

export class Photo extends Model {

    public static modelName: string = 'blog/post/photo';
    public static modelPath: string = 'blog/post/photos';
    public static embedded: boolean = true;

    public schema: Schema = {

        caption: attr(Serializers.String),
        takenBy: belongsTo(User),
        taggedUsers: hasMany(User),
    };

    public caption: string;
    public url: string;
    public takenBy: ModelOrPromise<User>;
    public taggedUsers: ModelOrPromise<User>[];

}

