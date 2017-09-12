
import * as admin from 'firebase-admin';
import { Store } from '../src';

export async function resetFirebase(basePath: string | undefined): Promise<void> {

    await Promise.all(
        ['user', 'blog', 'post', 'comment', 'vote'].map(async (thing: string) => {
            await Promise.all([1, 2, 3].map(async (instance: number) => {
                let path = '';
                if (basePath !== undefined) {
                    path += basePath;
                }
                if (testData[thing].path !== undefined) {
                    path += `/${testData[thing].path}/${testData[thing][instance].id}`;
                    await admin.database().ref(path).set(null);
                }
            }));
        }),
    );
}

export const testData = {
    blog: {
        path: 'blogs',
        1: {
            id: 'mocha-blog-id-1',
            name: 'mocha-blog-name-1',
        },
        2: {
            id: 'mocha-blog-id-2',
            name: 'mocha-blog-name-2',
        },
        3: {
            id: 'mocha-blog-id-3',
            name: 'mocha-blog-name-3',
        },
    },
    user: {
        path: 'users',
        1: {
            id: 'mocha-user-id-1',
            name: 'mocha-user-name-1',
        },
        2: {
            id: 'mocha-user-id-2',
            name: 'mocha-user-name-2',
        },
        3: {
            id: 'mocha-user-id-3',
            name: 'mocha-user-name-3',
        },
    },
    post: {
        path: 'blog/posts',
        1: {
            id: 'mocha-post-id-1',
            title: 'mocha-post-title-1',
        },
        2: {
            id: 'mocha-post-id-2',
            title: 'mocha-post-title-2',
        },
        3: {
            id: 'mocha-post-id-3',
            title: 'mocha-post-title-3',
        },
    },
    photo: {
        // No path for embedded records, they will be reset by clearing the parent record
        1: {
            id: 'mocha-photo-id-1',
            caption: 'mocha-photo-caption-1',
        },
        2: {
            id: 'mocha-photo-id-2',
            caption: 'mocha-photo-caption-2',
        },
        3: {
            id: 'mocha-photo-id-3',
            caption: 'mocha-photo-caption-3',
        },
    },
    comment: {
        // Comments are intended to be used in blog1 only and with a path prefix group set
        path: 'post/mocha-post-id-1/comments',
        1: {
            id: 'mocha-comment-id-1',
            text: 'mocha-comment-text-1',
        },
        2: {
            id: 'mocha-comment-id-2',
            text: 'mocha-comment-text-2',
        },
        3: {
            id: 'mocha-comment-id-2',
            text: 'mocha-comment-text-2',
        },
    },
    vote: {
        // Votes are intended to be used in blog1 only and with a path prefix group set
        path: 'post/mocha-post-id-1/votes',
        1: {
            id: 'mocha-vote-id-1',
            score: 1,
        },
        2: {
            id: 'mocha-vote-id-2',
            score: 2,
        },
        3: {
            id: 'mocha-vote-id-2',
            score: 3,
        },
    },
};
