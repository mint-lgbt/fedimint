import { generateKeyPair } from 'node:crypto';
import { IsNull } from 'typeorm';
import { User } from '@/models/entities/user.js';
import { Users, UsedUsernames } from '@/models/index.js';
import { UserProfile } from '@/models/entities/user-profile.js';
import { genId } from '@/misc/gen-id.js';
import { toPunyNullable } from '@/misc/convert-host.js';
import { hashPassword } from '@/misc/password.js';
import { UserKeypair } from '@/models/entities/user-keypair.js';
import { usersChart } from '@/services/chart/index.js';
import { UsedUsername } from '@/models/entities/used-username.js';
import { db } from '@/db/postgre.js';
import { ApiError } from '@/server/api/error.js';
import generateUserToken from './generate-native-user-token.js';

export async function signup(opts: {
	username: User['username'];
	password?: string | null;
	passwordHash?: UserProfile['password'] | null;
	host?: string | null;
}) {
	const { username, password, passwordHash, host } = opts;
	let hash = passwordHash;

	// Validate username
	if (!Users.validateLocalUsername(username)) {
		throw new ApiError('INVALID_USERNAME');
	}

	if (password != null && passwordHash == null) {
		// Validate password
		if (!Users.validatePassword(password)) {
			throw new ApiError('INVALID_PASSWORD');
		}

		hash = await hashPassword(password);
	}

	// Generate secret
	const secret = generateUserToken();

	// Check username duplication
	if (await Users.findOneBy({ usernameLower: username.toLowerCase(), host: IsNull() })) {
		throw new ApiError('USED_USERNAME');
	}

	// Check deleted username duplication
	if (await UsedUsernames.findOneBy({ username: username.toLowerCase() })) {
		throw new ApiError('USED_USERNAME');
	}

	const keyPair = await new Promise<string[]>((res, rej) =>
		generateKeyPair('rsa', {
			modulusLength: 4096,
			publicKeyEncoding: {
				type: 'spki',
				format: 'pem',
			},
			privateKeyEncoding: {
				type: 'pkcs8',
				format: 'pem',
				cipher: undefined,
				passphrase: undefined,
			},
		} as any, (err, publicKey, privateKey) =>
			err ? rej(err) : res([publicKey, privateKey]),
		));

	let account!: User;

	// Start transaction
	await db.transaction(async transactionalEntityManager => {
		const exist = await transactionalEntityManager.countBy(User, {
			usernameLower: username.toLowerCase(),
			host: IsNull(),
		});

		if (exist) throw new ApiError('USED_USERNAME');

		account = await transactionalEntityManager.save(new User({
			id: genId(),
			createdAt: new Date(),
			username,
			usernameLower: username.toLowerCase(),
			host: toPunyNullable(host),
			token: secret,
			isAdmin: (await Users.countBy({
				host: IsNull(),
			})) === 0,
		}));

		await transactionalEntityManager.save(new UserKeypair({
			publicKey: keyPair[0],
			privateKey: keyPair[1],
			userId: account.id,
		}));

		await transactionalEntityManager.save(new UserProfile({
			userId: account.id,
			autoAcceptFollowed: true,
			password: hash,
		}));

		await transactionalEntityManager.save(new UsedUsername({
			createdAt: new Date(),
			username: username.toLowerCase(),
		}));
	});

	usersChart.update(account, true);

	return { account, secret };
}
