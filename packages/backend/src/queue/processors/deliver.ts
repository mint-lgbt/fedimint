import { URL } from 'node:url';
import Bull from 'bull';
import { request } from '@/remote/activitypub/request.js';
import { registerOrFetchInstanceDoc } from '@/services/register-or-fetch-instance-doc.js';
import Logger from '@/services/logger.js';
import { Instances } from '@/models/index.js';
import { apRequestChart, federationChart, instanceChart } from '@/services/chart/index.js';
import { fetchInstanceMetadata } from '@/services/fetch-instance-metadata.js';
import { toPuny } from '@/misc/convert-host.js';
import { StatusError } from '@/misc/fetch.js';
import { shouldSkipInstance } from '@/misc/skipped-instances.js';
import { DeliverJobData } from '@/queue/types.js';

const logger = new Logger('deliver');

let latest: string | null = null;

export default async (job: Bull.Job<DeliverJobData>) => {
	const { host } = new URL(job.data.to);
	const puny = toPuny(host);

	if (await shouldSkipInstance(puny)) return 'skip';

	try {
		if (latest !== (latest = JSON.stringify(job.data.content, null, 2))) {
			logger.debug(`delivering ${latest}`);
		}

		await request(job.data.user, job.data.to, job.data.content);

		// Update stats
		registerOrFetchInstanceDoc(host).then(i => {
			Instances.update(i.id, {
				latestRequestSentAt: new Date(),
				latestStatus: 200,
				lastCommunicatedAt: new Date(),
				isNotResponding: false,
			});

			fetchInstanceMetadata(i);

			instanceChart.requestSent(i.host, true);
			apRequestChart.deliverSucc();
			federationChart.deliverd(i.host, true);
		});

		return 'Success';
	} catch (res) {
		// Update stats
		registerOrFetchInstanceDoc(host).then(i => {
			Instances.update(i.id, {
				latestRequestSentAt: new Date(),
				latestStatus: res instanceof StatusError ? res.statusCode : null,
				isNotResponding: true,
			});

			instanceChart.requestSent(i.host, false);
			apRequestChart.deliverFail();
			federationChart.deliverd(i.host, false);
		});

		if (res instanceof StatusError) {
			// 4xx
			if (res.isClientError) {
				// A client error means that something is wrong with the request we are making,
				// which means that retrying it makes no sense.
				return `${res.statusCode} ${res.statusMessage}`;
			}

			// 5xx etc.
			throw new Error(`${res.statusCode} ${res.statusMessage}`);
		} else {
			// DNS error, socket error, timeout ...
			throw res;
		}
	}
};
