<template>
<div>
	<MkStickyContainer>
		<template #header><MkPageHeader :actions="headerActions"/></template>
		<MkSpacer :content-max="900">
			<div class="lknzcolw">
				<div class="users">
					<div class="inputs">
						<FormSelect v-model="sort" style="flex: 1;">
							<template #label>{{ i18n.ts.sort }}</template>
							<option value="-createdAt">{{ i18n.ts.registeredDate }} ({{ i18n.ts.ascendingOrder }})</option>
							<option value="+createdAt">{{ i18n.ts.registeredDate }} ({{ i18n.ts.descendingOrder }})</option>
							<option value="-updatedAt">{{ i18n.ts.lastUsed }} ({{ i18n.ts.ascendingOrder }})</option>
							<option value="+updatedAt">{{ i18n.ts.lastUsed }} ({{ i18n.ts.descendingOrder }})</option>
						</FormSelect>
						<FormSelect v-model="state" style="flex: 1;">
							<template #label>{{ i18n.ts.state }}</template>
							<option value="all">{{ i18n.ts.all }}</option>
							<option value="available">{{ i18n.ts.normal }}</option>
							<option value="admin">{{ i18n.ts.administrator }}</option>
							<option value="moderator">{{ i18n.ts.moderator }}</option>
							<option value="silenced">{{ i18n.ts.silence }}</option>
							<option value="suspended">{{ i18n.ts.suspend }}</option>
						</FormSelect>
						<FormSelect v-model="origin" style="flex: 1;">
							<template #label>{{ i18n.ts.instance }}</template>
							<option value="combined">{{ i18n.ts.all }}</option>
							<option value="local">{{ i18n.ts.local }}</option>
							<option value="remote">{{ i18n.ts.remote }}</option>
						</FormSelect>
					</div>
					<div class="inputs">
						<FormInput v-model="searchUsername" style="flex: 1;" type="text" :spellcheck="false" @update:model-value="$refs.users.reload()">
							<template #prefix>@</template>
							<template #label>{{ i18n.ts.username }}</template>
						</FormInput>
						<FormInput v-model="searchHost" style="flex: 1;" type="text" :spellcheck="false" :disabled="pagination.params.origin === 'local'" @update:model-value="$refs.users.reload()">
							<template #prefix>@</template>
							<template #label>{{ i18n.ts.host }}</template>
						</FormInput>
					</div>

					<MkPagination v-slot="{items}" ref="paginationComponent" :pagination="pagination" class="users">
						<MkA v-for="user in items" :key="user.id" v-tooltip.mfm="`Last posted: ${new Date(user.updatedAt).toLocaleString()}`" class="user" :to="`/user-info/${user.id}`">
							<MkUserCardMini :user="user"/>
						</MkA>
					</MkPagination>
				</div>
			</div>
		</MkSpacer>
	</MkStickyContainer>
</div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import FormInput from '@/components/form/input.vue';
import FormSelect from '@/components/form/select.vue';
import MkPagination from '@/components/ui/pagination.vue';
import * as os from '@/os';
import { lookupUser } from '@/scripts/lookup-user';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';
import MkUserCardMini from '@/components/user-card-mini.vue';

let paginationComponent = $ref<InstanceType<typeof MkPagination>>();

let sort = $ref('+createdAt');
let state = $ref('all');
let origin = $ref('local');
let searchUsername = $ref('');
let searchHost = $ref('');
const pagination = {
	endpoint: 'admin/show-users' as const,
	limit: 10,
	params: computed(() => ({
		sort,
		state,
		origin,
		username: searchUsername,
		hostname: searchHost,
	})),
	offsetMode: true,
};

function searchUser(): void {
	os.selectUser().then(user => {
		show(user);
	});
}

async function addUser(): Promise<void> {
	const { canceled: canceled1, result: username } = await os.inputText({
		title: i18n.ts.username,
	});
	if (canceled1) return;

	const { canceled: canceled2, result: password } = await os.inputText({
		title: i18n.ts.password,
		type: 'password',
	});
	if (canceled2) return;

	os.apiWithDialog('admin/accounts/create', {
		username,
		password,
	}).then(() => {
		paginationComponent.reload();
	});
}

function show(user): void {
	os.pageWindow(`/user-info/${user.id}`);
}

const headerActions = $computed(() => [{
	icon: 'fas fa-search',
	text: i18n.ts.search,
	handler: searchUser,
}, {
	asFullButton: true,
	icon: 'fas fa-plus',
	text: i18n.ts.addUser,
	handler: addUser,
}, {
	asFullButton: true,
	icon: 'fas fa-search',
	text: i18n.ts.lookup,
	handler: lookupUser,
}]);

definePageMetadata(computed(() => ({
	title: i18n.ts.users,
	icon: 'fas fa-users',
})));
</script>

<style lang="scss" scoped>
.lknzcolw {
	> .users {

		> .inputs {
			display: flex;
			margin-bottom: 16px;

			> * {
				margin-right: 16px;

				&:last-child {
					margin-right: 0;
				}
			}
		}
	
		> .users {
			margin-top: var(--margin);
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
			grid-gap: 12px;

			> .user:hover {
				text-decoration: none;
			}
		}
	}
}
</style>
