import { CacheableRemoteUser } from '@/models/entities/user.js';
import { addPinned } from '@/services/i/pin.js';
import { resolveNote } from '@/remote/activitypub/models/note.js';
import { IAdd } from '@/remote/activitypub/type.js';
import { Resolver } from '@/remote/activitypub/resolver.js';

export default async (actor: CacheableRemoteUser, activity: IAdd, resolver: Resolver): Promise<void> => {
	if ('actor' in activity && actor.uri !== activity.actor) {
		throw new Error('invalid actor');
	}

	if (activity.target == null) {
		throw new Error('target is null');
	}

	if (activity.target === actor.featured) {
		const note = await resolveNote(activity.object, resolver);
		if (note == null) throw new Error('note not found');
		await addPinned(actor, note.id);
		return;
	}

	throw new Error(`unknown target: ${activity.target}`);
};
