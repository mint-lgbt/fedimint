/**
 * Languages Loader
 */

const fs = require('fs');
const yaml = require('js-yaml');

const merge = (...args) => args.reduce((a, c) => ({
	...a,
	...c,
	// this is necessary to merge "sub-objects" correctly instead of overwriting them
	...Object.entries(a)
		.filter(([k]) => c && typeof c[k] === 'object')
		.reduce((a, [k, v]) => (a[k] = merge(v, c[k]), a), {})
}), {});

// For a language to be generated as a locale it has to be listed here.
const languages = [
	'ar-SA',
	'cs-CZ',
	'da-DK',
	'de-DE',
	'en-US',
	'es-ES',
	'fr-FR',
	'id-ID',
	'it-IT',
	'ja-JP',
	'ja-KS',
	'kab-KAB',
	'kn-IN',
	'ko-KR',
	'nl-NL',
	'no-NO',
	'pl-PL',
	'pt-PT',
	'ru-RU',
	'sk-SK',
	'ug-CN',
	'uk-UA',
	'zh-CN',
	'zh-TW',
];

// Load the locales listed above.
const locales = languages.reduce(
	(acc, lang) => {
		acc[lang] = yaml.load(
			fs.readFileSync(`${__dirname}/${lang}.yml`, 'utf-8')
				// Remove backspace characters, which for some reason can get mixed in with the string and break the YAML.
				.replaceAll('\b', '')
		) || {};
		return acc;
	},
	{} // initial accumulator
);

module.exports = Object.entries(locales)
	.reduce((acc, [lang, strings]) => {
			if (k == 'en-US') {
				acc[lang] = strings;
			} else {
				// all other locales fall back to en-US
				acc[lang] = merge(locales['en-US'], strings);
			}
			return acc;
		},
		{} // initial accumulator
	);
