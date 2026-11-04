( function ( blocks, element, components, blockEditor, i18n ) {
    var el = element.createElement;
    var TextControl = components.TextControl;
    var SelectControl = components.SelectControl;
    var useBlockProps = blockEditor.useBlockProps;
    var widgets = ( window.grwiBlock && Array.isArray( grwiBlock.widgets ) ) ? grwiBlock.widgets : [];

    function widgetInList( embedKey ) {
        if ( ! embedKey ) {
            return false;
        }
        return widgets.some( function ( widget ) {
            return widget && widget.embedKey === embedKey;
        } );
    }

    function dropdownOptions( currentKey ) {
        var options = [
            { label: i18n.__( 'Select a widget…', 'gr-widget' ), value: '' },
        ];
        widgets.forEach( function ( widget ) {
            if ( ! widget || ! widget.embedKey ) {
                return;
            }
            var label = widget.label ? String( widget.label ) : widget.embedKey;
            options.push( {
                label: label + ' (' + widget.embedKey + ')',
                value: widget.embedKey,
            } );
        } );
        if ( currentKey && ! widgetInList( currentKey ) ) {
            options.push( {
                label: i18n.__( 'Current key (not in list)', 'gr-widget' ) + ' (' + currentKey + ')',
                value: currentKey,
            } );
        }
        return options;
    }

    blocks.registerBlockType( 'grwi-widget/embed', {
        edit: function ( props ) {
            var blockProps = useBlockProps();
            var embedKey = props.attributes.embedKey || '';
            var children = [];

            if ( widgets.length ) {
                children.push(
                    el( SelectControl, {
                        label: i18n.__( 'Widget', 'gr-widget' ),
                        value: embedKey,
                        options: dropdownOptions( embedKey ),
                        onChange: function ( value ) {
                            props.setAttributes( { embedKey: value } );
                        },
                        help: i18n.__( 'Choose a widget from the GR Widget admin menu, or paste an embed key below.', 'gr-widget' ),
                    } )
                );
            }

            children.push(
                el( TextControl, {
                    label: widgets.length
                        ? i18n.__( 'Embed key (if not in the list)', 'gr-widget' )
                        : i18n.__( 'Embed key', 'gr-widget' ),
                    value: embedKey,
                    onChange: function ( value ) {
                        props.setAttributes( { embedKey: value } );
                    },
                    help: widgets.length
                        ? i18n.__( 'Paste a key that is not in the dropdown. Open GR Widget in the WordPress admin menu to manage widgets.', 'gr-widget' )
                        : i18n.__( 'Paste the embed key from GR Widget in the WordPress admin menu.', 'gr-widget' ),
                } )
            );

            return el( 'div', blockProps, children );
        },
        save: function () {
            return null;
        },
    } );
} )( window.wp.blocks, window.wp.element, window.wp.components, window.wp.blockEditor, window.wp.i18n );
