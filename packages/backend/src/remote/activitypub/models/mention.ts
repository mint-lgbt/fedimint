import promiseLimit from 'promise-limit';
import { toArray, unique } from '@/prelude/array.js';
import { CacheableUser } from '@/models/entities/user.js';
import { Resolver } from '@/remote/activitypub/resolver.js';
import { IObject, isMention, IApMention } from '../type.js';
import { resolvePerson } from './person.js';

export async function extractApMentions(tags: IObject | IObject[] | null | undefined, resolver: Resolver): Promise<CacheableUser[]> {
	const hrefs = unique(extractApMentionObjects(tags).map(x => x.href as string));

	const limit = promiseLimit<CacheableUser | null>(2);
	const mentionedUsers = (await Promise.all(
		hrefs.map(x => limit(() => resolvePerson(x, resolver).catch(() => null))),
	)).filter((x): x is CacheableUser => x != null);

	return mentionedUsers;
}

export function extractApMentionObjects(tags: IObject | IObject[] | null | undefined): IApMention[] {
	if (tags == null) return [];
	return toArray(tags).filter(isMention);
}
