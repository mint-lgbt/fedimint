import { Directive } from 'vue';

export default {
	mounted(src) {
		const getBgColor = (el: HTMLElement) => {
			const style = window.getComputedStyle(el);
			if (style.backgroundColor && !['rgba(0, 0, 0, 0)', 'rgba(0,0,0,0)', 'transparent'].includes(style.backgroundColor)) {
				return style.backgroundColor;
			} else {
				return el.parentElement ? getBgColor(el.parentElement) : 'transparent';
			}
		};
	
		const parentBg = getBgColor(src.parentElement);

		const myBg = window.getComputedStyle(src).backgroundColor;

		if (parentBg === myBg) {
			src.style.borderColor = 'var(--divider)';
		} else {
			src.style.borderColor = myBg;
		}
	},
} as Directive;
