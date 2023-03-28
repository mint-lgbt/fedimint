import config from '@/config/index.js';
import renderAdd from '@/remote/activitypub/renderer/add.js';
import renderRemove from '@/remote/activitypub/renderer/remove.js';
import { renderActivity } from '@/remote/activitypub/renderer/index.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { User } from '@/models/entities/user.js';
import { Note } from '@/models/entities/note.js';
import { Notes, UserNotePinings, Users } from '@/models/index.js';
import { UserNotePining } from '@/models/entities/user-note-pining.js';
import { genId } from '@/misc/gen-id.js';
import { deliverToFollowers } from '@/remote/activitypub/deliver-manager.js';
import { deliverToRelays } from '../relay.js';

/**
 * Pin a given post to a user profile.
 * @param user the user to pin the note to
 * @param noteId ID of note to pin
 */
export async function addPinned(user: { id: User['id']; host: User['host']; }, noteId: Note['id']): Promise<void> {
	// Fetch pinee
	const note = await Notes.findOneBy({
		id: noteId,
		userId: user.id,
	});

	if (note == null) {
		throw new IdentifiableError('70c4e51f-5bea-449c-a030-53bee3cce202', 'No such note.');
	}

	const pinings = await UserNotePinings.findBy({ userId: user.id });

	if (pinings.length >= 5) {
		throw new IdentifiableError('15a018eb-58e5-4da1-93be-330fcc5e4e1a', 'You can not pin notes any more.');
	}

	if (pinings.some(pining => pining.noteId === note.id)) {
		throw new IdentifiableError('23f0cf4e-59a3-4276-a91d-61a5891c1514', 'That note has already been pinned.');
	}

	await UserNotePinings.insert({
		id: genId(),
		createdAt: new Date(),
		userId: user.id,
		noteId: note.id,
	} as UserNotePining);

	// Deliver to remote followers
	if (Users.isLocalUser(user)) {
		deliverPinnedChange(user.id, note.id, true);
	}
}

/**
 * Unpin a given post from a user profile.
 * @param user the user to unpin a note from
 * @param noteId ID of note to unpin
 */
export async function removePinned(user: { id: User['id']; host: User['host']; }, noteId: Note['id']): Promise<void> {
	// Fetch unpinee
	const note = await Notes.findOneBy({
		id: noteId,
		userId: user.id,
	});

	if (note == null) {
		throw new IdentifiableError('b302d4cf-c050-400a-bbb3-be208681f40c', 'No such note.');
	}

	UserNotePinings.delete({
		userId: user.id,
		noteId: note.id,
	});

	// Deliver to remote followers
	if (Users.isLocalUser(user)) {
		deliverPinnedChange(user.id, noteId, false);
	}
}

/**
 * Notify followers and relays when a note is pinned/unpinned.
 * @param userId ID of user
 * @param noteId ID of note
 * @param isAddition whether the note was pinned or unpinned
 */
export async function deliverPinnedChange(userId: User['id'], noteId: Note['id'], isAddition: boolean): Promise<void> {
	const user = await Users.findOneBy({ id: userId });
	if (user == null) throw new Error('user not found');

	if (!Users.isLocalUser(user)) return;

	const target = `${config.url}/users/${user.id}/collections/featured`;
	const item = `${config.url}/notes/${noteId}`;
	const content = renderActivity(isAddition ? renderAdd(user, target, item) : renderRemove(user, target, item));

	deliverToFollowers(user, content);
	deliverToRelays(user, content);
}
