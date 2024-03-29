<template>
<MkStickyContainer>
	<template #header><MkPageHeader v-model:tab="tab" :tabs="headerTabs"/></template>
	<MkSpacer :content-max="500" :margin-min="16" :margin-max="32">
		<FormSuspense :p="init">
			<div v-if="tab === 'overview'" class="_formRoot">
				<div class="_formBlock aeakzknw">
					<MkAvatar class="avatar" :user="user" :show-indicator="true"/>
					<div class="body">
						<span class="name"><MkUserName class="name" :user="user"/></span>
						<span class="sub"><span class="acct _monospace">@{{ acct(user) }}</span></span>
					</div>
				</div>

				<MkInfo v-if="user.username.includes('.')" class="_formBlock">{{ i18n.ts.isSystemAccount }}</MkInfo>

				<div v-if="user.url" class="_formLinksGrid _formBlock">
					<FormLink :to="userPage(user)">Profile</FormLink>
					<FormLink :to="user.url" :external="true">Profile (remote)</FormLink>
				</div>
				<FormLink v-else class="_formBlock" :to="userPage(user)">Profile</FormLink>

				<FormLink v-if="user.host" class="_formBlock" :to="`/instance-info/${user.host}`">{{ i18n.ts.instanceInfo }}</FormLink>

				<div class="_formBlock">
					<MkKeyValue :copy="user.id" oneline style="margin: 1em 0;">
						<template #key>ID</template>
						<template #value><span class="_monospace">{{ user.id }}</span></template>
					</MkKeyValue>
				</div>

				<FormSection v-if="iAmModerator">
					<template #label>Moderation</template>
					<FormSwitch v-if="user.host == null && $i.isAdmin && (moderator || !user.isAdmin)" v-model="moderator" class="_formBlock" @update:modelValue="toggleModerator">{{ i18n.ts.moderator }}</FormSwitch>
					<FormSwitch v-model="silenced" class="_formBlock" @update:modelValue="toggleSilence">{{ i18n.ts.silence }}</FormSwitch>
					<FormSwitch v-model="suspended" class="_formBlock" @update:modelValue="toggleSuspend">{{ i18n.ts.suspend }}</FormSwitch>
					{{ i18n.ts.reflectMayTakeTime }}
					<div class="_formBlock">
						<MkButton v-if="user.host == null" inline style="margin-right: 8px;" @click="resetPassword"><i class="fas fa-key"></i> {{ i18n.ts.resetPassword }}</MkButton>
						<MkButton inline danger @click="deleteAllFiles">{{ i18n.ts.deleteAllFiles }}</MkButton>
						<MkButton v-if="$i.isAdmin" inline danger @click="deleteAccount">{{ i18n.ts.deleteAccount }}</MkButton>
					</div>
				</FormSection>

				<FormSection>
					<template #label>ActivityPub</template>

					<div class="_formBlock">
						<MkKeyValue v-if="user.host" oneline style="margin: 1em 0;">
							<template #key>{{ i18n.ts.instanceInfo }}</template>
							<template #value><MkA :to="`/instance-info/${user.host}`" class="_link">{{ user.host }} <i class="fas fa-angle-right"></i></MkA></template>
						</MkKeyValue>
						<MkKeyValue v-else oneline style="margin: 1em 0;">
							<template #key>{{ i18n.ts.instanceInfo }}</template>
							<template #value>(Local user)</template>
						</MkKeyValue>
						<MkKeyValue oneline style="margin: 1em 0;">
							<template #key>{{ i18n.ts.updatedAt }}</template>
							<template #value><MkTime v-if="user.lastFetchedAt" mode="detail" :time="user.lastFetchedAt"/><span v-else>N/A</span></template>
						</MkKeyValue>
						<MkKeyValue v-if="ap" oneline style="margin: 1em 0;">
							<template #key>Type</template>
							<template #value><span class="_monospace">{{ ap.type }}</span></template>
						</MkKeyValue>
					</div>

					<MkButton v-if="user.host != null" @click="updateRemoteUser"><i class="fas fa-sync"></i> {{ i18n.ts.updateRemoteUser }}</MkButton>
				</FormSection>
			</div>
			<div v-else-if="tab === 'chart'" class="_formRoot">
				<div class="cmhjzshm">
					<div class="selects">
						<MkSelect v-model="chartSrc" style="margin: 0 10px 0 0; flex: 1;">
							<option value="per-user-notes">{{ i18n.ts.notes }}</option>
						</MkSelect>
					</div>
					<div class="charts">
						<div class="label">{{ i18n.t('recentNHours', { n: 90 }) }}</div>
						<MkChart class="chart" :src="chartSrc" span="hour" :limit="90" :args="{ user, withoutAll: true }" :detailed="true"></MkChart>
						<div class="label">{{ i18n.t('recentNDays', { n: 90 }) }}</div>
						<MkChart class="chart" :src="chartSrc" span="day" :limit="90" :args="{ user, withoutAll: true }" :detailed="true"></MkChart>
					</div>
				</div>
			</div>
			<div v-else-if="tab === 'files'" class="_formRoot">
				<MkFileListForAdmin :pagination="filesPagination" view-mode="grid"/>
			</div>
			<div v-else-if="tab === 'ap'" class="_formRoot">
				<MkObjectView v-if="ap" tall :value="user">
				</MkObjectView>
			</div>
			<div v-else-if="tab === 'raw'" class="_formRoot">
				<MkObjectView v-if="info && $i.isAdmin" tall :value="info">
				</MkObjectView>

				<MkObjectView tall :value="user">
				</MkObjectView>
			</div>
		</FormSuspense>
	</MkSpacer>
</MkStickyContainer>
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent, defineComponent, watch } from 'vue';
import * as foundkey from 'foundkey-js';
import MkChart from '@/components/chart.vue';
import MkObjectView from '@/components/object-view.vue';
import FormTextarea from '@/components/form/textarea.vue';
import FormSwitch from '@/components/form/switch.vue';
import FormLink from '@/components/form/link.vue';
import FormSection from '@/components/form/section.vue';
import MkButton from '@/components/ui/button.vue';
import MkKeyValue from '@/components/key-value.vue';
import MkSelect from '@/components/form/select.vue';
import FormSuspense from '@/components/form/suspense.vue';
import MkFileListForAdmin from '@/components/file-list-for-admin.vue';
import * as os from '@/os';
import number from '@/filters/number';
import bytes from '@/filters/bytes';
import { url } from '@/config';
import { userPage, acct } from '@/filters/user';
import { definePageMetadata } from '@/scripts/page-metadata';
import { i18n } from '@/i18n';
import { iAmModerator } from '@/account';

const props = defineProps<{
	userId: string;
}>();

let tab = $ref('overview');
let chartSrc = $ref('per-user-notes');
let user = $ref<null | foundkey.entities.UserDetailed>();
let init = $ref();
let info = $ref();
let ap = $ref(null);
let moderator = $ref(false);
let silenced = $ref(false);
let suspended = $ref(false);
const filesPagination = {
	endpoint: 'admin/drive/files' as const,
	limit: 10,
	params: computed(() => ({
		userId: props.userId,
	})),
};

function createFetcher() {
	if (iAmModerator) {
		return () => Promise.all([os.api('users/show', {
			userId: props.userId,
		}), os.api('admin/show-user', {
			userId: props.userId,
		})]).then(([_user, _info]) => {
			user = _user;
			info = _info;
			moderator = info.isModerator;
			silenced = info.isSilenced;
			suspended = info.isSuspended;
		});
	} else {
		return () => os.api('users/show', {
			userId: props.userId,
		}).then((res) => {
			user = res;
		});
	}
}

function refreshUser() {
	init = createFetcher();
}

async function updateRemoteUser() {
	await os.apiWithDialog('federation/update-remote-user', { userId: user.id });
	refreshUser();
}

async function resetPassword() {
	const { password } = await os.api('admin/reset-password', {
		userId: user.id,
	});

	os.alert({
		type: 'success',
		text: i18n.t('newPasswordIs', { password }),
	});
}

async function toggleSilence(v) {
	const confirm = await os.confirm({
		type: 'warning',
		text: v ? i18n.ts.silenceConfirm : i18n.ts.unsilenceConfirm,
	});
	if (confirm.canceled) {
		silenced = !v;
	} else {
		await os.api(v ? 'admin/silence-user' : 'admin/unsilence-user', { userId: user.id });
		await refreshUser();
	}
}

async function toggleSuspend(v) {
	const confirm = await os.confirm({
		type: 'warning',
		text: v ? i18n.ts.suspendConfirm : i18n.ts.unsuspendConfirm,
	});
	if (confirm.canceled) {
		suspended = !v;
	} else {
		await os.api(v ? 'admin/suspend-user' : 'admin/unsuspend-user', { userId: user.id });
		await refreshUser();
	}
}

async function toggleModerator(v) {
	await os.api(v ? 'admin/moderators/add' : 'admin/moderators/remove', { userId: user.id });
	await refreshUser();
}

async function deleteAllFiles() {
	const confirm = await os.confirm({
		type: 'warning',
		text: i18n.ts.deleteAllFilesConfirm,
	});
	if (confirm.canceled) return;
	const process = async () => {
		await os.api('admin/delete-all-files-of-a-user', { userId: user.id });
		os.success();
	};
	await process().catch(err => {
		os.alert({
			type: 'error',
			text: err.toString(),
		});
	});
	await refreshUser();
}

async function deleteAccount() {
	const confirm = await os.confirm({
		type: 'warning',
		text: i18n.t('deleteAccountConfirm', { handle: acct(user) }),
	});
	if (confirm.canceled) return;

	const typed = await os.inputText({
		text: i18n.t('typeToConfirm', { x: user?.username }),
	});
	if (typed.canceled) return;

	if (typed.result === user?.username) {
		await os.apiWithDialog('admin/accounts/delete', {
			userId: user.id,
		});
	} else {
		os.alert({
			type: 'error',
			text: 'input not match',
		});
	}
}

watch(() => props.userId, () => {
	init = createFetcher();
}, {
	immediate: true,
});

watch(() => user, () => {
	os.api('ap/get', {
		uri: user.uri ?? `${url}/users/${user.id}`,
	}).then(res => {
		ap = res;
	});
});

const headerTabs = $computed(() => [{
	key: 'overview',
	title: i18n.ts.overview,
	icon: 'fas fa-info-circle',
}, {
	key: 'chart',
	title: i18n.ts.charts,
	icon: 'fas fa-chart-simple',
}, iAmModerator ? {
	key: 'files',
	title: i18n.ts.files,
	icon: 'fas fa-cloud',
} : null, {
	key: 'ap',
	title: 'AP',
	icon: 'fas fa-share-alt',
}, {
	key: 'raw',
	title: 'Raw',
	icon: 'fas fa-code',
}].filter(x => x != null));

definePageMetadata(computed(() => ({
	title: user ? acct(user) : i18n.ts.userInfo,
	icon: 'fas fa-info-circle',
})));
</script>

<style lang="scss" scoped>
.aeakzknw {
	display: flex;
	align-items: center;

	> .avatar {
		display: block;
		width: 64px;
		height: 64px;
		margin-right: 16px;
	}

	> .body {
		flex: 1;
		overflow: hidden;

		> .name {
			display: block;
			width: 100%;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		> .sub {
			display: block;
			width: 100%;
			font-size: 85%;
			opacity: 0.7;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
	}
}

.cmhjzshm {
	> .selects {
		display: flex;
		margin: 0 0 16px 0;
	}

	> .charts {
		> .label {
			margin-bottom: 12px;
			font-weight: bold;
		}
	}
}
</style>
