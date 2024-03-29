import { AccessTokens } from '@/models/index.js';
import { publishUserEvent } from '@/services/stream.js';
import define from '../../define.js';

export const meta = {
	requireCredential: true,

	secure: true,
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		tokenId: { type: 'string', format: 'misskey:id' },
	},
	required: ['tokenId'],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps, user) => {
	const exists = await AccessTokens.countBy({ id: ps.tokenId });

	if (exists) {
		await AccessTokens.delete({
			id: ps.tokenId,
			userId: user.id,
		});

		// Terminate streaming
		publishUserEvent(user.id, 'terminate');
	}
});
