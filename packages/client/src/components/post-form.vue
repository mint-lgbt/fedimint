<template>
<div
	v-size="{ max: [310, 500] }" class="gafaadew"
	:class="{ modal, _popup: modal }"
	@dragover.stop="onDragover"
	@drop.stop="onDrop"
>
	<header>
		<button v-if="!fixed" class="cancel _button" @click="cancel"><i class="fas fa-times"></i></button>
		<button v-tooltip="i18n.ts.switchAccount" class="account _button" @click="openAccountMenu">
			<MkAvatar :user="postAccount ?? $i" class="avatar"/>
		</button>
		<div>
			<span class="text-count" :class="{ over: textLength > maxTextLength }">{{ maxTextLength - textLength }}</span>
			<span v-if="localOnly" class="local-only"><i class="fas fa-biohazard"></i></span>
			<button ref="visibilityButton" v-tooltip="i18n.ts.visibility" class="_button visibility" :disabled="channel != null" @click="setVisibility">
				<span v-if="visibility === 'public'"><i class="fas fa-globe"></i></span>
				<span v-else-if="visibility === 'home'"><i class="fas fa-home"></i></span>
				<span v-else-if="visibility === 'followers'"><i class="fas fa-unlock"></i></span>
				<span v-else-if="visibility === 'specified'"><i class="fas fa-envelope"></i></span>
			</button>
			<button v-tooltip="i18n.ts.previewNoteText" class="_button preview" :class="{ active: showPreview }" @click="showPreview = !showPreview"><i class="fas fa-file-code"></i></button>
			<button class="submit _buttonGradate" :disabled="!canPost" data-cy-open-post-form-submit @click="post">{{ submitText }}<i :class="reply ? 'fas fa-reply' : renote ? 'fas fa-quote-right' : 'fas fa-paper-plane'"></i></button>
		</div>
	</header>
	<div class="form" :class="{ fixed }">
		<XNoteSimple v-if="reply" class="preview" :note="reply"/>
		<XNoteSimple v-if="renote" class="preview" :note="renote"/>
		<div v-if="quoteId" class="with-quote"><i class="fas fa-quote-left"></i> {{ i18n.ts.quoteAttached }}<button @click="quoteId = null"><i class="fas fa-times"></i></button></div>
		<div v-if="visibility === 'specified'" class="to-specified">
			<span style="margin-right: 8px;">{{ i18n.ts.recipient }}</span>
			<div class="visibleUsers">
				<span v-for="u in visibleUsers" :key="u.id">
					<MkAcct :user="u"/>
					<button class="_button" @click="removeVisibleUser(u)"><i class="fas fa-times"></i></button>
				</span>
				<button class="_buttonPrimary" @click="addVisibleUser"><i class="fas fa-plus fa-fw"></i></button>
			</div>
		</div>
		<MkInfo v-if="hasNotSpecifiedMentions" warn class="hasNotSpecifiedMentions">{{ i18n.ts.notSpecifiedMentionWarning }} - <button class="_textButton" @click="addMissingMention()">{{ i18n.ts.add }}</button></MkInfo>
		<input v-show="useCw" ref="cwInputEl" v-model="cw" class="cw" :placeholder="i18n.ts.annotation" @keydown="onKeydown">
		<textarea ref="textareaEl" v-model="text" class="text" :class="{ withCw: useCw }" :disabled="posting" :placeholder="placeholder" data-cy-post-form-text @keydown="onKeydown" @paste="onPaste" @compositionupdate="onCompositionUpdate" @compositionend="onCompositionEnd"/>
		<input v-show="withHashtags" ref="hashtagsInputEl" v-model="hashtags" class="hashtags" :placeholder="i18n.ts.hashtags" list="hashtags">
		<XPostFormAttaches class="attaches" :files="files" @updated="updateFiles" @detach="detachFile" @changeSensitive="updateFileSensitive" @changeName="updateFileName"/>
		<XPollEditor v-if="poll" v-model="poll" @destroyed="poll = null"/>
		<XNotePreview v-if="showPreview" class="preview" :text="text"/>
		<footer>
			<button v-tooltip="i18n.ts.attachFile" class="_button" @click="chooseFileFrom"><i class="fas fa-photo-video"></i></button>
			<button v-tooltip="i18n.ts.poll" class="_button" :class="{ active: poll }" @click="togglePoll"><i class="fas fa-poll-h"></i></button>
			<button v-tooltip="i18n.ts.useCw" class="_button" :class="{ active: useCw }" @click="useCw = !useCw"><i class="fas fa-eye-slash"></i></button>
			<button v-tooltip="i18n.ts.mention" class="_button" @click="insertMention"><i class="fas fa-at"></i></button>
			<button v-tooltip="i18n.ts.hashtags" class="_button" :class="{ active: withHashtags }" @click="withHashtags = !withHashtags"><i class="fas fa-hashtag"></i></button>
			<button v-tooltip="i18n.ts.emoji" class="_button" @click="insertEmoji"><i class="fas fa-laugh-squint"></i></button>
			<button v-if="postFormActions.length > 0" v-tooltip="i18n.ts.plugin" class="_button" @click="showActions"><i class="fas fa-plug"></i></button>
		</footer>
		<datalist id="hashtags">
			<option v-for="hashtag in recentHashtags" :key="hashtag" :value="hashtag"/>
		</datalist>
	</div>
</div>
</template>

<script lang="ts" setup>
import { inject, watch, nextTick, onMounted, defineAsyncComponent } from 'vue';
import * as mfm from 'mfm-js';
import * as foundkey from 'foundkey-js';
import insertTextAtCursor from 'insert-text-at-cursor';
import { length } from 'stringz';
import { toASCII } from 'punycode/';
import * as Acct from 'foundkey-js/built/acct';
import { throttle } from 'throttle-debounce';
import XNoteSimple from './note-simple.vue';
import XNotePreview from './note-preview.vue';
import XPostFormAttaches from './post-form-attaches.vue';
import XPollEditor from './poll-editor.vue';
import { host, url } from '@/config';
import { erase, unique } from '@/scripts/array';
import { extractMentions } from '@/scripts/extract-mentions';
import { formatTimeString } from '@/scripts/format-time-string';
import { Autocomplete } from '@/scripts/autocomplete';
import * as os from '@/os';
import { stream } from '@/stream';
import { selectFiles } from '@/scripts/select-file';
import { defaultStore, notePostInterruptors, postFormActions } from '@/store';
import MkInfo from '@/components/ui/info.vue';
import { i18n } from '@/i18n';
import { instance } from '@/instance';
import { $i, getAccounts, openAccountMenu as openAccountMenu_ } from '@/account';
import { uploadFile } from '@/scripts/upload';

const modal = inject('modal');

const props = withDefaults(defineProps<{
	reply?: foundkey.entities.Note;
	renote?: foundkey.entities.Note;
	channel?: any; // TODO
	mention?: foundkey.entities.User;
	specified?: foundkey.entities.User;
	initialText?: string;
	initialVisibility?: foundkey.NoteVisibility;
	initialFiles?: foundkey.entities.DriveFile[];
	initialLocalOnly?: boolean;
	initialVisibleUsers?: foundkey.entities.User[];
	initialNote?: foundkey.entities.Note;
	instant?: boolean;
	fixed?: boolean;
	autofocus?: boolean;
}>(), {
	initialVisibleUsers: () => [],
	autofocus: true,
});

const emit = defineEmits<{
	(ev: 'posted'): void;
	(ev: 'cancel'): void;
	(ev: 'esc'): void;
}>();

const textareaEl = $ref<HTMLTextAreaElement | null>(null);
const cwInputEl = $ref<HTMLInputElement | null>(null);
const hashtagsInputEl = $ref<HTMLInputElement | null>(null);
const visibilityButton = $ref<HTMLElement | null>(null);

let posting: boolean = $ref(false);
let text: string = $ref(props.initialText ?? '');
let files: foundkey.entities.DriveFile[] = $ref(props.initialFiles ?? []);
let poll = $ref<{
	choices: string[];
	multiple: boolean;
	expiresAt: string | null;
	expiredAfter: string | null;
} | null>(null);
let useCw = $ref(false);
let showPreview = $ref(false);
let cw = $ref<string | null>(null);

// these define the "maximum" these parameters can be set to and will be tightened further down
let parentLocalOnly = false;
let parentVisibility = 'public';

let localOnly = $ref<boolean>(props.initialLocalOnly ?? defaultStore.state.defaultNoteLocalOnly);
let visibility = $ref(props.initialVisibility ?? defaultStore.state.defaultNoteVisibility as foundkey.NoteVisibility);
let visibleUsers = $ref([]);
if (props.initialVisibleUsers) {
	props.initialVisibleUsers.forEach(pushVisibleUser);
}
let quoteId = $ref(null);
let hasNotSpecifiedMentions = $ref(false);
let recentHashtags = $ref(JSON.parse(localStorage.getItem('hashtags') || '[]'));
let imeText = $ref('');

const typing = throttle(3000, () => {
	if (props.channel) {
		stream.send('typingOnChannel', { channel: props.channel.id });
	}
});

const draftKey = $computed((): string => {
	let key = props.channel ? `channel:${props.channel.id}` : '';

	if (props.renote) {
		key += `renote:${props.renote.id}`;
	} else if (props.reply) {
		key += `reply:${props.reply.id}`;
	} else {
		key += 'note';
	}

	return key;
});

const placeholder = $computed((): string => {
	if (props.renote) {
		return i18n.ts._postForm.quotePlaceholder;
	} else if (props.reply) {
		return i18n.ts._postForm.replyPlaceholder;
	} else if (props.channel) {
		return i18n.ts._postForm.channelPlaceholder;
	} else {
		const xs = [
			i18n.ts._postForm._placeholders.a,
			i18n.ts._postForm._placeholders.b,
			i18n.ts._postForm._placeholders.c,
			i18n.ts._postForm._placeholders.d,
			i18n.ts._postForm._placeholders.e,
			i18n.ts._postForm._placeholders.f,
		];
		return xs[Math.floor(Math.random() * xs.length)];
	}
});

const submitText = $computed((): string => {
	return props.renote
		? i18n.ts.quote
		: props.reply
			? i18n.ts.reply
			: i18n.ts.note;
});

const textLength = $computed((): number => {
	return length((text + imeText).trim());
});

const maxTextLength = $computed((): number => {
	return instance ? instance.maxNoteTextLength : 1000;
});

const canPost = $computed((): boolean => {
	return !posting &&
		(1 <= textLength || 1 <= files.length || !!poll || !!props.renote || !!quoteId) &&
		(textLength <= maxTextLength) &&
		(!poll || poll.choices.length >= 2);
});

const withHashtags = $computed(defaultStore.makeGetterSetter('postFormWithHashtags'));
const hashtags = $computed(defaultStore.makeGetterSetter('postFormHashtags'));

watch($$(text), () => {
	checkMissingMention();
});

watch($$(visibleUsers), () => {
	checkMissingMention();
}, {
	deep: true,
});

if (props.mention) {
	text = props.mention.host ? `@${props.mention.username}@${toASCII(props.mention.host)}` : `@${props.mention.username}`;
	text += ' ';
}

if (props.reply && (props.reply.user.username !== $i.username || (props.reply.user.host != null && props.reply.user.host !== host))) {
	text = `@${props.reply.user.username}${props.reply.user.host != null ? '@' + toASCII(props.reply.user.host) : ''} `;
}

if (props.reply && props.reply.text != null) {
	const ast = mfm.parse(props.reply.text);
	const otherHost = props.reply.user.host;

	for (const x of extractMentions(ast)) {
		const mention = x.host ?
			`@${x.username}@${toASCII(x.host)}` :
			(otherHost == null || otherHost === host) ?
				`@${x.username}` :
				`@${x.username}@${toASCII(otherHost)}`;

		// 自分は除外
		if ($i.username === x.username && (x.host == null || x.host === host)) continue;

		// 重複は除外
		if (text.includes(`${mention} `)) continue;

		text += `${mention} `;
	}
}

if (props.channel) {
	parentLocalOnly = true; // TODO: remove when channels are federated
}

if (props.reply) {
	parentVisibility = foundkey.minVisibility(props.reply.visibility, parentVisibility);
	if (props.reply.visibility === 'specified') {
		os.api('users/show', {
			userIds: props.reply.visibleUserIds.filter(uid => uid !== $i.id && uid !== props.reply.userId),
		}).then(users => {
			users.forEach(pushVisibleUser);
		});

		if (props.reply.userId !== $i.id) {
			os.api('users/show', { userId: props.reply.userId }).then(user => {
				pushVisibleUser(user);
			});
		}
	}
	parentLocalOnly ||= props.reply.localOnly;
}

if (props.renote) {
	parentVisibility = foundkey.minVisibility(props.renote.visibility, parentVisibility);
	if (props.renote.visibility === 'specified') {
		os.api('users/show', {
			userIds: props.renote.visibleUserIds.filter(uid => uid !== $i.id && uid !== props.renote.userId),
		}).then(users => {
			users.forEach(pushVisibleUser);
		});

		if (props.renote.userId !== $i.id) {
			os.api('users/show', { userId: props.renote.userId }).then(user => {
				pushVisibleUser(user);
			});
		}
	}
	parentLocalOnly ||= props.renote.localOnly;
}

if (props.specified) {
	parentVisibility = 'specified';
	pushVisibleUser(props.specified);
}

// set visibility and local only defaults to minimum of preselected or allowed.
visibility = foundkey.minVisibility(visibility, parentVisibility);
localOnly ||= parentLocalOnly;

// keep cw when reply
if (defaultStore.state.keepCw && props.reply && props.reply.cw) {
	useCw = true;
	cw = props.reply.cw;
}

function watchForDraft() {
	watch($$(text), () => saveDraft());
	watch($$(useCw), () => saveDraft());
	watch($$(cw), () => saveDraft());
	watch($$(poll), () => saveDraft());
	watch($$(files), () => saveDraft(), { deep: true });
	watch($$(visibility), () => saveDraft());
	watch($$(localOnly), () => saveDraft());
}

function checkMissingMention() {
	if (visibility === 'specified') {
		const ast = mfm.parse(text);

		for (const x of extractMentions(ast)) {
			if (!visibleUsers.some(u => (u.username === x.username) && (u.host === x.host))) {
				hasNotSpecifiedMentions = true;
				return;
			}
		}
		hasNotSpecifiedMentions = false;
	}
}

function addMissingMention() {
	const ast = mfm.parse(text);

	for (const x of extractMentions(ast)) {
		if (!visibleUsers.some(u => (u.username === x.username) && (u.host === x.host))) {
			os.api('users/show', { username: x.username, host: x.host }).then(user => {
				visibleUsers.push(user);
			});
		}
	}
}

function togglePoll() {
	if (poll) {
		poll = null;
	} else {
		poll = {
			choices: ['', ''],
			multiple: false,
			expiresAt: null,
			expiredAfter: null,
		};
	}
}

function focus() {
	if (textareaEl) {
		textareaEl.focus();
		textareaEl.setSelectionRange(textareaEl.value.length, textareaEl.value.length);
	}
}

function chooseFileFrom(ev) {
	selectFiles(ev.currentTarget ?? ev.target, i18n.ts.attachFile).then(files_ => {
		for (const file of files_) {
			files.push(file);
		}
	});
}

function detachFile(id) {
	files = files.filter(x => x.id !== id);
}

function updateFiles(_files) {
	files = _files;
}

function updateFileSensitive(file, sensitive) {
	files[files.findIndex(x => x.id === file.id)].isSensitive = sensitive;
}

function updateFileName(file, name) {
	files[files.findIndex(x => x.id === file.id)].name = name;
}

function upload(file: File, name?: string) {
	uploadFile(file, defaultStore.state.uploadFolder, name).then(res => {
		files.push(res);
	});
}

function setVisibility() {
	if (props.channel) {
		// TODO: information dialog
		return;
	}

	os.popup(defineAsyncComponent(() => import('./visibility-picker.vue')), {
		parentVisibility,
		parentLocalOnly,
		currentVisibility: visibility,
		currentLocalOnly: localOnly,
		src: visibilityButton,
	}, {
		changeVisibility: v => {
			visibility = v;
		},
		changeLocalOnly: v => {
			localOnly = v;
		},
	}, 'closed');
}

function pushVisibleUser(user) {
	if (!visibleUsers.some(u => u.username === user.username && u.host === user.host)) {
		visibleUsers.push(user);
	}
}

function addVisibleUser() {
	os.selectUser().then(user => {
		pushVisibleUser(user);
	});
}

function removeVisibleUser(user) {
	visibleUsers = erase(user, visibleUsers);
}

function clear() {
	text = '';
	files = [];
	poll = null;
	quoteId = null;
}

function onKeydown(ev: KeyboardEvent) {
	if ((ev.which === 10 || ev.which === 13) && (ev.ctrlKey || ev.metaKey) && canPost) post();
	if (ev.which === 27) emit('esc');
	typing();
}

function onCompositionUpdate(ev: CompositionEvent) {
	imeText = ev.data;
	typing();
}

function onCompositionEnd() {
	imeText = '';
}

async function onPaste(ev: ClipboardEvent) {
	for (const { item, i } of Array.from(ev.clipboardData.items).map((item, i) => ({ item, i }))) {
		if (item.kind === 'file') {
			const file = item.getAsFile();
			const lio = file.name.lastIndexOf('.');
			const ext = lio >= 0 ? file.name.slice(lio) : '';
			const formatted = `${formatTimeString(new Date(file.lastModified), defaultStore.state.pastedFileName).replace(/{{number}}/g, `${i + 1}`)}${ext}`;
			upload(file, formatted);
		}
	}

	const paste = ev.clipboardData.getData('text');

	if (!props.renote && !quoteId && paste.startsWith(url + '/notes/')) {
		ev.preventDefault();

		os.confirm({
			type: 'info',
			text: i18n.ts.quoteQuestion,
		}).then(({ canceled }) => {
			if (canceled) {
				insertTextAtCursor(textareaEl, paste);
				return;
			}

			quoteId = paste.substr(url.length).match(/^\/notes\/(.+?)\/?$/)[1];
		});
	}
}

function onDragover(ev) {
	if (!ev.dataTransfer.items[0]) return;
	const isFile = ev.dataTransfer.items[0].kind === 'file';
	const isDriveFile = ev.dataTransfer.types[0] === _DATA_TRANSFER_DRIVE_FILE_;
	if (isFile || isDriveFile) {
		ev.preventDefault();
		ev.dataTransfer.dropEffect = ev.dataTransfer.effectAllowed === 'all' ? 'copy' : 'move';
	}
}

function onDrop(ev): void {
	// ファイルだったら
	if (ev.dataTransfer.files.length > 0) {
		ev.preventDefault();
		for (const x of Array.from(ev.dataTransfer.files)) upload(x);
		return;
	}

	//#region ドライブのファイル
	const driveFile = ev.dataTransfer.getData(_DATA_TRANSFER_DRIVE_FILE_);
	if (driveFile != null && driveFile !== '') {
		const file = JSON.parse(driveFile);
		files.push(file);
		ev.preventDefault();
	}
	//#endregion
}

// Save a copy of the initial data to detect whether it has been changed.
// Cloning the data to make sure there are no remaining references.
const initialDraftData = JSON.parse(JSON.stringify({
	text,
	useCw,
	cw,
	visibility,
	localOnly,
	files,
}));

function saveDraft() {
	const draftData = JSON.parse(localStorage.getItem('drafts') || '{}');

	if (
		initialDraftData.text === text
		&& initialDraftData.useCw === useCw
		// don't compare cw for equality if it is disabled, since it won't be sent
		&& (!useCw || initialDraftData.cw === cw)
		&& initialDraftData.visibility === visibility
		&& initialDraftData.localOnly === localOnly
		&& initialDraftData.files.every((file, i) => file.id === files[i].id)
		// initial state is always poll == null
		&& poll == null
	) {
		// This is the same as the initial draft data, no need to save it.
		// If it was saved before, delete it.
		delete draftData[draftKey];
	} else {
		draftData[draftKey] = {
			updatedAt: new Date(),
			data: {
				text,
				useCw,
				cw,
				visibility,
				localOnly,
				files,
				poll,
			},
		};
	}

	localStorage.setItem('drafts', JSON.stringify(draftData));
}

function deleteDraft() {
	const draftData = JSON.parse(localStorage.getItem('drafts') || '{}');

	delete draftData[draftKey];

	localStorage.setItem('drafts', JSON.stringify(draftData));
}

async function post() {
	let postData = {
		text: text === '' ? undefined : text,
		fileIds: files.length > 0 ? files.map(f => f.id) : undefined,
		replyId: props.reply ? props.reply.id : undefined,
		renoteId: props.renote?.id ?? quoteId ?? undefined,
		channelId: props.channel ? props.channel.id : undefined,
		poll,
		cw: useCw ? cw || '' : undefined,
		localOnly,
		visibility,
		visibleUserIds: visibility === 'specified' ? visibleUsers.map(u => u.id) : undefined,
	};

	if (withHashtags && hashtags && hashtags.trim() !== '') {
		const hashtags_ = hashtags.trim().split(' ').map(x => x.startsWith('#') ? x : '#' + x).join(' ');
		postData.text = postData.text ? `${postData.text} ${hashtags_}` : hashtags_;
	}

	// plugin
	if (notePostInterruptors.length > 0) {
		for (const interruptor of notePostInterruptors) {
			postData = await interruptor.handler(JSON.parse(JSON.stringify(postData)));
		}
	}

	let token = undefined;

	if (postAccount) {
		const storedAccounts = await getAccounts();
		token = storedAccounts.find(x => x.id === postAccount.id)?.token;
	}

	posting = true;
	os.api('notes/create', postData, token).then(() => {
		clear();
		nextTick(() => {
			deleteDraft();
			emit('posted');
			if (postData.text && postData.text !== '') {
				const hashtags_ = mfm.parse(postData.text).filter(x => x.type === 'hashtag').map(x => x.props.hashtag);
				const history = JSON.parse(localStorage.getItem('hashtags') || '[]') as string[];
				localStorage.setItem('hashtags', JSON.stringify(unique(hashtags_.concat(history))));
			}
			posting = false;
			postAccount = null;
		});
	}).catch(err => {
		posting = false;
		os.alert({
			type: 'error',
			text: err.message + '\n' + (err as any).id,
		});
	});
}

function cancel() {
	emit('cancel');
}

function insertMention() {
	os.selectUser().then(user => {
		insertTextAtCursor(textareaEl, '@' + Acct.toString(user) + ' ');
	});
}

async function insertEmoji(ev: MouseEvent) {
	os.openEmojiPicker(ev.currentTarget ?? ev.target, {}, textareaEl);
}

function showActions(ev) {
	os.popupMenu(postFormActions.map(action => ({
		text: action.title,
		action: () => {
			action.handler({
				text,
			}, (key, value) => {
				if (key === 'text') { text = value; }
			});
		},
	})), ev.currentTarget ?? ev.target);
}

let postAccount = $ref<foundkey.entities.UserDetailed | null>(null);

function openAccountMenu(ev: MouseEvent) {
	openAccountMenu_({
		withExtraOperation: false,
		includeCurrentAccount: true,
		active: postAccount != null ? postAccount.id : $i.id,
		onChoose: (account) => {
			if (account.id === $i.id) {
				postAccount = null;
			} else {
				postAccount = account;
			}
		},
	}, ev);
}

onMounted(() => {
	if (props.autofocus) {
		focus();

		nextTick(() => {
			focus();
		});
	}

	// TODO: detach when unmount
	new Autocomplete(textareaEl, $$(text));
	new Autocomplete(cwInputEl, $$(cw));
	new Autocomplete(hashtagsInputEl, $$(hashtags));

	nextTick(() => {
		// 書きかけの投稿を復元
		if (!props.instant && !props.mention && !props.specified) {
			const draft = JSON.parse(localStorage.getItem('drafts') || '{}')[draftKey];
			if (draft) {
				text = draft.data.text;
				useCw = draft.data.useCw;
				cw = draft.data.cw;
				visibility = draft.data.visibility;
				localOnly = draft.data.localOnly;
				files = (draft.data.files || []).filter(draftFile => draftFile);
				if (draft.data.poll) {
					poll = draft.data.poll;
				}
			}
		}

		// 削除して編集
		if (props.initialNote) {
			const init = props.initialNote;
			text = init.text ? init.text : '';
			files = init.files;
			cw = init.cw;
			useCw = init.cw != null;
			if (init.poll) {
				poll = {
					choices: init.poll.choices.map(x => x.text),
					multiple: init.poll.multiple,
					expiresAt: init.poll.expiresAt,
					expiredAfter: init.poll.expiredAfter,
				};
			}
			visibility = init.visibility;
			localOnly = init.localOnly;
			quoteId = init.renote ? init.renote.id : null;
		}

		nextTick(() => watchForDraft());
	});
});
</script>

<style lang="scss" scoped>
.gafaadew {
	position: relative;

	&.modal {
		width: 100%;
		max-width: 520px;
	}

	> header {
		z-index: 1000;
		height: 66px;

		> .cancel {
			padding: 0;
			font-size: 20px;
			width: 64px;
			line-height: 66px;
		}

		> .account {
			height: 100%;
			aspect-ratio: 1/1;
			display: inline-flex;
			vertical-align: bottom;

			> .avatar {
				width: 28px;
				height: 28px;
				margin: auto;
			}
		}

		> div {
			position: absolute;
			top: 0;
			right: 0;

			> .text-count {
				opacity: 0.7;
				line-height: 66px;
			}

			> .visibility {
				height: 34px;
				width: 34px;
				margin: 0 0 0 8px;

				& + .localOnly {
					margin-left: 0 !important;
				}
			}
			
			> .local-only {
				margin: 0 0 0 12px;
				opacity: 0.7;
			}

			> .preview {
				display: inline-block;
				padding: 0;
				margin: 0 8px 0 0;
				font-size: 16px;
				width: 34px;
				height: 34px;
				border-radius: 6px;

				&:hover {
					background: var(--X5);
				}

				&.active {
					color: var(--accent);
				}
			}

			> .submit {
				margin: 16px 16px 16px 0;
				padding: 0 12px;
				line-height: 34px;
				font-weight: bold;
				vertical-align: bottom;
				border-radius: 4px;
				font-size: 0.9em;

				&:disabled {
					opacity: 0.7;
				}

				> i {
					margin-left: 6px;
				}
			}
		}
	}

	> .form {
		> .preview {
			padding: 16px;
		}

		> .with-quote {
			margin: 0 0 8px 0;
			color: var(--accent);

			> button {
				padding: 4px 8px;
				color: var(--accentAlpha04);

				&:hover {
					color: var(--accentAlpha06);
				}

				&:active {
					color: var(--accentDarken30);
				}
			}
		}

		> .to-specified {
			padding: 6px 24px;
			margin-bottom: 8px;
			overflow: auto;
			white-space: nowrap;

			> .visibleUsers {
				display: inline;
				top: -1px;
				font-size: 14px;

				> button {
					padding: 4px;
					border-radius: 8px;
				}

				> span {
					margin-right: 14px;
					padding: 8px 0 8px 8px;
					border-radius: 8px;
					background: var(--X4);

					> button {
						padding: 4px 8px;
					}
				}
			}
		}

		> .hasNotSpecifiedMentions {
			margin: 0 20px 16px 20px;
		}

		> .cw,
		> .hashtags,
		> .text {
			display: block;
			box-sizing: border-box;
			padding: 0 24px;
			margin: 0;
			width: 100%;
			font-size: 16px;
			border: none;
			border-radius: 0;
			background: transparent;
			color: var(--fg);
			font-family: inherit;

			&:focus {
				outline: none;
			}

			&:disabled {
				opacity: 0.5;
			}
		}

		> .cw {
			z-index: 1;
			padding-bottom: 8px;
			border-bottom: solid 0.5px var(--divider);
		}

		> .hashtags {
			z-index: 1;
			padding-top: 8px;
			padding-bottom: 8px;
			border-top: solid 0.5px var(--divider);
		}

		> .text {
			max-width: 100%;
			min-width: 100%;
			min-height: 90px;

			&.withCw {
				padding-top: 8px;
			}
		}

		> footer {
			padding: 0 16px 16px 16px;

			> button {
				display: inline-block;
				padding: 0;
				margin: 0;
				font-size: 16px;
				width: 48px;
				height: 48px;
				border-radius: 6px;

				&:hover {
					background: var(--X5);
				}

				&.active {
					color: var(--accent);
				}
			}
		}
	}

	&.max-width_500px {
		> header {
			height: 50px;

			> .cancel {
				width: 50px;
				line-height: 50px;
			}

			> div {
				> .text-count {
					line-height: 50px;
				}

				> .submit {
					margin: 8px;
				}
			}
		}

		> .form {
			> .to-specified {
				padding: 6px 16px;
			}

			> .cw,
			> .hashtags,
			> .text {
				padding: 0 16px;
			}

			> .text {
				min-height: 80px;
			}

			> footer {
				padding: 0 8px 8px 8px;
			}
		}
	}

	&.max-width_310px {
		> .form {
			> footer {
				> button {
					font-size: 14px;
					width: 44px;
				height: 44px;
				}
			}
		}
	}
}
</style>
