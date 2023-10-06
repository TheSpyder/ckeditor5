/**
 * @license Copyright (c) 2003-2023, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module html-embed/htmlembedediting
 */

import { Plugin, type Editor } from 'ckeditor5/src/core';
import type { ButtonView } from 'ckeditor5/src/ui';
import { toWidget } from 'ckeditor5/src/widget';
import { logWarning, createElement } from 'ckeditor5/src/utils';

import type { HtmlEmbedConfig } from './htmlembedconfig';
import HtmlEmbedCommand from './htmlembedcommand';

import '../theme/htmlembed.css';
import { init } from './codemirror';

import type { EditorView } from '@codemirror/view';

/**
 * The HTML embed editing feature.
 */
export default class HtmlEmbedEditing extends Plugin {
	/**
	 * Keeps references to {@link module:ui/button/buttonview~ButtonView edit, save, and cancel} button instances created for
	 * each widget so they can be destroyed if they are no longer in DOM after the editing view was re-rendered.
	 */
	private _widgetButtonViewReferences: Set<ButtonView> = new Set();

	/**
	 * @inheritDoc
	 */
	public static get pluginName() {
		return 'HtmlEmbedEditing' as const;
	}

	/**
	 * @inheritDoc
	 */
	constructor( editor: Editor ) {
		super( editor );

		editor.config.define( 'htmlEmbed', {
			showPreviews: false,
			sanitizeHtml: rawHtml => {
				/**
				 * When using the HTML embed feature with the `htmlEmbed.showPreviews=true` option, it is strongly recommended to
				 * define a sanitize function that will clean up the input HTML in order to avoid XSS vulnerability.
				 *
				 * For a detailed overview, check the {@glink features/html/html-embed HTML embed feature} documentation.
				 *
				 * @error html-embed-provide-sanitize-function
				 */
				logWarning( 'html-embed-provide-sanitize-function' );

				return {
					html: rawHtml,
					hasChanged: false
				};
			}
		} );
	}

	/**
	 * @inheritDoc
	 */
	public init(): void {
		const editor = this.editor;
		const schema = editor.model.schema;

		schema.register( 'rawHtml', {
			inheritAllFrom: '$blockObject',
			allowAttributes: [ 'value' ]
		} );

		editor.commands.add( 'htmlEmbed', new HtmlEmbedCommand( editor ) );

		this._setupConversion();
	}

	/**
	 * Prepares converters for the feature.
	 */
	private _setupConversion() {
		const editor = this.editor;
		const t = editor.t;
		const widgetButtonViewReferences = this._widgetButtonViewReferences;
		// const htmlEmbedConfig: HtmlEmbedConfig = editor.config.get( 'htmlEmbed' )!;

		// Destroy UI buttons created for widgets that have been removed from the view document (e.g. in the previous conversion).
		// This prevents unexpected memory leaks from UI views.
		editor.editing.view.on( 'render', () => {
			for ( const buttonView of widgetButtonViewReferences ) {
				if ( buttonView.element && buttonView.element.isConnected ) {
					return;
				}

				buttonView.destroy();
				widgetButtonViewReferences.delete( buttonView );
			}
		}, { priority: 'lowest' } );

		// Register div.raw-html-embed as a raw content element so all of it's content will be provided
		// as a view element's custom property while data upcasting.
		editor.data.registerRawContentMatcher( {
			name: 'div',
			classes: 'raw-html-embed'
		} );

		editor.conversion.for( 'upcast' ).elementToElement( {
			view: {
				name: 'div',
				classes: 'raw-html-embed'
			},
			model: ( viewElement, { writer } ) => {
				// The div.raw-html-embed is registered as a raw content element,
				// so all it's content is available in a custom property.
				return writer.createElement( 'rawHtml', {
					value: viewElement.getCustomProperty( '$rawContent' )
				} );
			}
		} );

		editor.conversion.for( 'dataDowncast' ).elementToElement( {
			model: 'rawHtml',
			view: ( modelElement, { writer } ) => {
				return writer.createRawElement( 'div', { class: 'raw-html-embed' }, function( domElement ) {
					domElement.innerHTML = modelElement.getAttribute( 'value' ) as string || '';
				} );
			}
		} );

		editor.conversion.for( 'editingDowncast' ).elementToStructure( {
			model: { name: 'rawHtml', attributes: [ 'value' ] },
			view: ( modelElement, { writer } ) => {
				const viewContentWrapper = writer.createRawElement( 'div', {
					attributes: {
						'data-cke-ignore-events': 'true'
					},
					class: 'raw-html-embed__content-wrapper'
				}, function( domElement ) {
					const setRawHtmlValue = ( content: string ) => {
						// This is wrong
						modelElement._setAttribute( 'value', content );

						// TODO: Doing it properly seems to cause the whole widget to re-render, which means typing loses focus
						// editor.model.change( writer => {
						// writer.setAttribute( 'value', content, modelElement );
						// } );
					};
					const getRawHtmlValue = () => modelElement.getAttribute( 'value' ) as string || '';
					renderContent( { domElement, getRawHtmlValue, setRawHtmlValue } );

					// Since there is a `data-cke-ignore-events` attribute set on the wrapper element in the editable mode,
					// the explicit `mousedown` handler on the `capture` phase is needed to move the selection onto the whole
					// HTML embed widget.
					domElement.addEventListener( 'mousedown', () => {
						const model = editor.model;
						const selectedElement = model.document.selection.getSelectedElement();

						// Move the selection onto the whole HTML embed widget if it's currently not selected.
						if ( selectedElement !== modelElement ) {
							model.change( writer => writer.setSelection( modelElement, 'on' ) );
						}
					}, true );
				} );

				writer.setAttribute( 'data-cke-ignore-events', 'true', viewContentWrapper );

				const viewContainer = writer.createContainerElement( 'div', {
					class: 'raw-html-embed',
					'data-html-embed-label': t( 'HTML snippet' ),
					dir: editor.locale.uiLanguageDirection
				}, viewContentWrapper );

				writer.setCustomProperty( 'rawHtml', true, viewContainer );

				return toWidget( viewContainer, writer, {
					label: t( 'HTML snippet' ),
					hasSelectionHandle: true
				} );
			}
		} );

		function renderContent( {
			domElement,
			getRawHtmlValue,
			setRawHtmlValue
		}: {
			domElement: HTMLElement;
			getRawHtmlValue: () => string;
			setRawHtmlValue: ( content: string ) => void;
		} ) {
			// Remove all children;
			domElement.textContent = '';

			const domDocument = domElement.ownerDocument;

			const domTextarea = createElement( domDocument, 'div', {
				// placeholder: props.placeholder,
				class: 'ck ck-reset ck-input ck-input-text raw-html-embed__source'
			} );

			const cmi = init( domTextarea, getRawHtmlValue(), setRawHtmlValue, t( 'Paste raw HTML here...' ) );

			domElement.append( domTextarea );

			return cmi;
		}
	}
}

export interface RawHtmlApi {
	makeEditable(): void;
	save( newValue: string ): void;
	cancel(): void;
}
