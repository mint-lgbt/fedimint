import { createDeleteAccountJob } from '@/queue/index.js';
import { CacheableRemoteUser } from '@/models/entities/user.js';
import { Users } from '@/models/index.js';
import { apLogger } from '@/remote/activitypub/logger.js';

export async function deleteActor(actor: CacheableRemoteUser, uri: string): Promise<string> {
	apLogger.info(`Deleting the Actor: ${uri}`);

	if (actor.uri !== uri) {
		return `skip: delete actor ${actor.uri} !== ${uri}`;
	}

	const user = await Users.findOneBy({ id: actor.id });
	if (!user) {
		// maybe a race condition, relay or something else?
		// anyway, the user is gone now so dont care
		return 'ok: gone';
	}
	if (user.isDeleted) {
		apLogger.info('skip: already deleted');
	}

	const job = await createDeleteAccountJob(actor);

	await Users.update(actor.id, {
		isDeleted: true,
	});

	return `ok: queued ${job.name} ${job.id}`;
}