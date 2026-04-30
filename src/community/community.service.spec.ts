import { BadRequestException } from '@nestjs/common';

import { CommunityService } from './community.service';

describe('CommunityService', () => {
  let postModel: any;
  let commentModel: any;
  let service: CommunityService;

  beforeEach(() => {
    postModel = {
      find: jest.fn(),
      findById: jest.fn(),
      exists: jest.fn(),
      create: jest.fn(),
      deleteOne: jest.fn(),
    };
    commentModel = {
      find: jest.fn(),
      exists: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      deleteMany: jest.fn(),
      insertMany: jest.fn(),
    };
    service = new CommunityService(postModel as any, commentModel as any);

    jest.spyOn(service as any, 'restoreLegacyPostsIfMissing').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'migrateEmbeddedCommentsToCollection').mockResolvedValue(undefined);
  });

  it('lists posts with nested comment trees and orphan comments as roots', async () => {
    postModel.find.mockReturnValue({
      sort: () => ({
        lean: () => ({
          exec: () => Promise.resolve([
            { _id: 'post-1', title: 'First' },
          ]),
        }),
      }),
    });

    commentModel.find.mockReturnValue({
      lean: () => ({
        exec: () => Promise.resolve([
          { _id: 'c1', postId: 'post-1', parentCommentId: null, text: 'root', createdAt: '2026-04-29T10:00:00.000Z' },
          { _id: 'c2', postId: 'post-1', parentCommentId: 'c1', text: 'child', createdAt: '2026-04-29T11:00:00.000Z' },
          { _id: 'c3', postId: 'post-1', parentCommentId: 'missing', text: 'orphan', createdAt: '2026-04-29T12:00:00.000Z' },
        ]),
      }),
    });

    const posts = await service.listPosts();

    expect(posts).toHaveLength(1);
    expect(posts[0].comments).toHaveLength(2);
    expect(posts[0].comments[0]._id).toBe('c3');
    expect(posts[0].comments[1]._id).toBe('c1');
    expect(posts[0].comments[1].replies[0]._id).toBe('c2');
  });

  it('creates trimmed posts and normalizes tags', async () => {
    postModel.create.mockResolvedValue({
      toObject: () => ({ _id: 'post-2', title: 'My Post' }),
    });

    const created = await service.createPost(
      {
        title: '  My Post  ',
        content: '  Hello world  ',
        type: 'problem',
        tags: [' React ', '', 'API', null],
        problemType: 'bug',
      } as any,
      { userId: 'user-1', username: 'alice', avatar: '/alice.png' },
    );

    expect(created).toEqual({ _id: 'post-2', title: 'My Post' });
    expect(postModel.create).toHaveBeenCalledWith(expect.objectContaining({
      title: 'My Post',
      content: 'Hello world',
      tags: ['react', 'api'],
      authorId: 'user-1',
      authorUsername: 'alice',
      authorAvatar: '/alice.png',
    }));
  });

  it('adds comments after validating the parent comment and returns the saved tree payload', async () => {
    postModel.exists.mockReturnValue({ exec: () => Promise.resolve(true) });
    commentModel.exists.mockReturnValue({ exec: () => Promise.resolve(true) });
    commentModel.create.mockResolvedValue({
      toObject: () => ({ _id: 'comment-1', text: 'Reply' }),
    });
    jest.spyOn(service as any, 'getPostWithComments').mockResolvedValue({ ok: true });

    const result = await service.addComment(
      '0123456789abcdef01234567',
      { text: '  Reply  ', parentCommentId: '1234567890abcdef12345678' } as any,
      { userId: 'user-2', username: 'bob' },
    );

    expect(result).toEqual({ ok: true });
    expect(commentModel.create).toHaveBeenCalledWith(expect.objectContaining({
      postId: '0123456789abcdef01234567',
      parentCommentId: '1234567890abcdef12345678',
      authorId: 'user-2',
      authorUsername: 'bob',
      text: 'Reply',
    }));
  });
});