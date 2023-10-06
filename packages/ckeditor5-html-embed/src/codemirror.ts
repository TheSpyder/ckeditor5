/**
 * @license Copyright (c) 2003-2023, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

import { keymap, highlightSpecialChars, drawSelection, highlightActiveLine, dropCursor,
	rectangularSelection, crosshairCursor,
	lineNumbers, highlightActiveLineGutter, EditorView, placeholder } from '@codemirror/view';
import { type Extension, EditorState } from '@codemirror/state';
import { defaultHighlightStyle, syntaxHighlighting, indentOnInput, bracketMatching,
	foldGutter, foldKeymap } from '@codemirror/language';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { lintKeymap } from '@codemirror/lint';
import { html } from '@codemirror/lang-html';

// (The superfluous function calls around the list of extensions work
// around current limitations in tree-shaking software.)

// / This is an extension value that just pulls together a number of
// / extensions that you might want in a basic editor. It is meant as a
// / convenient helper to quickly set up CodeMirror without installing
// / and importing a lot of separate packages.
// /
// / Specifically, it includes...
// /
// /  - [the default command bindings](#commands.defaultKeymap)
// /  - [line numbers](#view.lineNumbers)
// /  - [special character highlighting](#view.highlightSpecialChars)
// /  - [the undo history](#commands.history)
// /  - [a fold gutter](#language.foldGutter)
// /  - [custom selection drawing](#view.drawSelection)
// /  - [drop cursor](#view.dropCursor)
// /  - [multiple selections](#state.EditorState^allowMultipleSelections)
// /  - [reindentation on input](#language.indentOnInput)
// /  - [the default highlight style](#language.defaultHighlightStyle) (as fallback)
// /  - [bracket matching](#language.bracketMatching)
// /  - [bracket closing](#autocomplete.closeBrackets)
// /  - [autocompletion](#autocomplete.autocompletion)
// /  - [rectangular selection](#view.rectangularSelection) and [crosshair cursor](#view.crosshairCursor)
// /  - [active line highlighting](#view.highlightActiveLine)
// /  - [active line gutter highlighting](#view.highlightActiveLineGutter)
// /  - [selection match highlighting](#search.highlightSelectionMatches)
// /  - [search](#search.searchKeymap)
// /  - [linting](#lint.lintKeymap)
// /
// / (You'll probably want to add some language package to your setup
// / too.)
// /
// / This extension does not allow customization. The idea is that,
// / once you decide you want to configure your editor more precisely,
// / you take this package's source (which is just a bunch of imports
// / and an array literal), copy it into your own code, and adjust it
// / as desired.
const basicSetup: Extension = [
	lineNumbers(),
	highlightActiveLineGutter(),
	highlightSpecialChars(),
	history(),
	foldGutter(),
	drawSelection(),
	dropCursor(),
	EditorState.allowMultipleSelections.of( true ),
	indentOnInput(),
	syntaxHighlighting( defaultHighlightStyle, { fallback: true } ),
	bracketMatching(),
	closeBrackets(),
	autocompletion(),
	rectangularSelection(),
	crosshairCursor(),
	highlightActiveLine(),
	highlightSelectionMatches(),
	html(),
	keymap.of( [
		...closeBracketsKeymap,
		...defaultKeymap,
		...searchKeymap,
		...historyKeymap,
		...foldKeymap,
		...completionKeymap,
		...lintKeymap
	] )
];

export const init = (
	parent: HTMLElement,
	doc: string,
	contentUpdate: ( content: string ) => void,
	placeholderString: string
): EditorView =>
	new EditorView( {
		doc,
		extensions: [
			...basicSetup,
			placeholder( placeholderString ),
			EditorView.updateListener.of( update => {
				const content = update.state.doc.toString();
				console.log( 'update received', content );
				contentUpdate( content );
			} )
		],
		parent
	} );
