(function (window, $) {
    'use strict';

    var FLOAT_POSITIONS = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];

    var LAYOUT_FEATURE_SLUGS = {
        feed_masonry: 'premium_layout_masonry',
        feed_slider: 'premium_layout_slider',
        feed_classic_carousel: 'premium_layout_classic_carousel',
        feed_classic_masonry: 'premium_layout_classic_masonry',
        sticker_bold: 'premium_layout_bold',
        sticker_ribbon: 'premium_layout_ribbon',
        sticker_pill: 'premium_layout_pill'
    };

    var GROUP_LABELS = {
        theme: 'Theme',
        typography: 'Typography',
        google_logo: 'Google Logo',
        widget: 'Widget',
        header: 'Header',
        navigation: 'Navigation',
        border: 'Widget Border',
        widget_padding: 'Widget Padding',
        spacing: 'Spacing',
        filters: 'Sorting & Filters',
        display: 'Display Options',
        ai: 'AI Review Summary',
        ai_enable: 'AI Review Summary',
        ai_style: 'Summary Style',
        ai_label: 'Summary Label',
        ai_stars: 'Summary Stars',
        ai_content: 'Summary Content',
        ai_panel: 'Review Panel',
        photos: 'Review Photos',
        review_photos: 'Customer-uploaded Review Photos',
        reviewer_avatars: 'Reviewer Profile Photos',
        json_ld: 'Structured Data',
        branding: 'Branding',
        panel_show: 'Review Panel',
        panel_style: 'Panel Style',
        panel_colors: 'Panel Colours',
        panel_content: 'Panel Content',
        rating: 'Rating Label',
        rating_score: 'Rating Score',
        star_rating: 'Rating Stars',
        header_title: 'Widget Title',
        header_stars: 'Rating Stars',
        card_stars: 'Card Stars',
        review_cards: 'Review Cards',
        curation: 'Review Curation',
        limits: 'Display Limit',
        placement: 'Placement',
        display_mode: 'Display Mode',
        float_position: 'Screen Position',
        device_visibility: 'Visibility',
        float_offsets: 'Offset From Edge',
        outer_spacing: 'Outer Spacing',
        widget_width: 'Width',
        review_count: 'Review Count',
        feed_display: 'Review Cards',
        feed_review_button: 'Review Button',
        feed_footer_button: 'Footer Button',
        install_shortcode: 'WordPress Shortcode',
        install_embed: 'HTML Embed',
    };

    var SECTION_ACCORDION_IDS = {
        options: true,
        reviews: true,
        install: true,
        'ai-summary': true,
        customize: true,
        panel: true,
        settings: true,
    };

    function sectionDisplayTitle(section) {
        var id = section && (section.id || section);
        var title = (section && typeof section === 'object') ? String(section.title || '') : '';
        if (String(id || '') === 'panel' && (!title || title === 'Panel')) {
            return 'Review Panel';
        }
        return title || String(id || '');
    }

    // Maps spacing_elements keys → web Customize accordion / nested labels.
    var CUSTOMIZE_SPACING_NEST = {
        logo: { parent: 'google_logo', label: 'Google Logo', nested: false },
        rating_label: { parent: 'rating', label: 'Rating Label', nested: false },
        rating_value: { parent: 'rating_score', label: 'Rating Score', nested: false },
        stars: { parent: 'star_rating', label: 'Star Rating', nested: false },
        review_count: { parent: 'review_count', label: 'Review Count', nested: false },
        verified_badge: { parent: 'review_count', label: 'Verified Badge', nested: true },
        showcase_title: { parent: 'header', label: 'Widget Title', nested: true },
        business_name: { parent: 'header', label: 'Business Name', nested: true },
        header_stars: { parent: 'header', label: 'Rating Stars', nested: true },
        cta: { parent: 'header', label: 'Review Button', nested: true },
        card_stars: { parent: 'review_cards', label: 'Card Stars', nested: true },
        review_card_text: { parent: 'review_cards', label: 'Review Text', nested: true },
        review_card_author: { parent: 'review_cards', label: 'Reviewer Name', nested: true },
        review_card_date: { parent: 'review_cards', label: 'Review Date', nested: true },
        slide_stars: { parent: 'review_cards', label: 'Card Stars', nested: true },
    };

    function escHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function readEditor() {
        var $json = $('#grwi-customize-editor');
        if (!$json.length) {
            return {};
        }
        try {
            return JSON.parse($json.text() || '{}') || {};
        } catch (e) {
            return {};
        }
    }

    function dropLegacyOptionsNav(editor) {
        if (!(window.grwiCustomize || {}).mergedSettingsNav || !editor || typeof editor !== 'object') {
            return editor;
        }
        if (!editor.builder || typeof editor.builder !== 'object') {
            editor.builder = {};
        }
        var sections = Array.isArray(editor.builder.sections) ? editor.builder.sections : [];
        editor.builder.sections = sections.filter(function (section) {
            return !(section && section.id === 'options');
        });
        var placementFieldKeys = {
            widget_display_mode: true,
            widget_float_position: true,
            widget_device_visibility: true,
            widget_float_offsets: true,
            widget_align: true
        };
        var placementGroups = {
            placement: true,
            display_mode: true,
            float_position: true,
            device_visibility: true,
            float_offsets: true
        };
        var fields = Array.isArray(editor.builder.fields) ? editor.builder.fields : [];
        editor.builder.fields = fields.map(function (field) {
            if (!field) {
                return field;
            }
            var copy = field;
            var changed = false;
            if (field.section === 'options') {
                copy = $.extend({}, field);
                copy.section = 'settings';
                changed = true;
            }
            if ((copy.section === 'settings' || field.section === 'options')
                && (placementFieldKeys[copy.key] || placementGroups[copy.group])) {
                if (!changed) {
                    copy = $.extend({}, copy);
                }
                copy.group = 'placement';
                copy.section = 'settings';
            }
            return copy;
        });
        return editor;
    }

    function layoutFullDefaultsForEditor(editor) {
        editor = editor || readEditor();
        var previewMeta = (editor.builder && editor.builder.preview) || {};
        var layout = (editor.builder && editor.builder.layout) || editor.layout || 'badge_card';
        var theme = (editor.config && editor.config.theme) || 'light';
        theme = theme === 'dark' ? 'dark' : 'light';
        var bundle = previewMeta.layout_full_defaults;
        if (!bundle) {
            return {};
        }
        if (bundle.light || bundle.dark) {
            return $.extend({}, bundle[theme] || bundle.light || {});
        }
        var perLayout = bundle[layout];
        if (perLayout && (perLayout.light || perLayout.dark)) {
            return $.extend({}, perLayout[theme] || perLayout.light || {});
        }
        return $.extend({}, perLayout || bundle);
    }

    function colorPickerDefaultsForEditor(editor) {
        editor = editor || readEditor();
        var previewMeta = (editor.builder && editor.builder.preview) || {};
        var theme = (editor.config && editor.config.theme) || 'light';
        theme = theme === 'dark' ? 'dark' : 'light';
        var bundle = previewMeta.color_picker_defaults;
        if (!bundle) {
            return {};
        }
        return $.extend({}, bundle[theme] || bundle.light || {});
    }

    function layoutDefaultColorForField(fieldKey, editor) {
        if (!fieldKey) {
            return '';
        }
        var pickerDefaults = colorPickerDefaultsForEditor(editor);
        if (Object.prototype.hasOwnProperty.call(pickerDefaults, fieldKey)) {
            var pickerValue = pickerDefaults[fieldKey];
            if (pickerValue != null && String(pickerValue).trim() !== '') {
                return String(pickerValue).trim();
            }
        }
        var defaults = layoutFullDefaultsForEditor(editor);
        if (!Object.prototype.hasOwnProperty.call(defaults, fieldKey)) {
            return '';
        }
        var value = defaults[fieldKey];
        if (value == null || String(value).trim() === '') {
            return '';
        }
        return String(value).trim();
    }

    function cssColorToHex(raw) {
        var val = String(raw || '').trim();
        if (!val) {
            return '';
        }
        if (/^#[0-9a-fA-F]{6}$/.test(val)) {
            return val.toLowerCase();
        }
        if (/^#[0-9a-fA-F]{3}$/.test(val)) {
            return ('#' + val.charAt(1) + val.charAt(1) + val.charAt(2) + val.charAt(2) + val.charAt(3) + val.charAt(3)).toLowerCase();
        }
        var rgba = val.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
        if (rgba) {
            var r = Math.max(0, Math.min(255, Math.round(parseFloat(rgba[1]))));
            var g = Math.max(0, Math.min(255, Math.round(parseFloat(rgba[2]))));
            var b = Math.max(0, Math.min(255, Math.round(parseFloat(rgba[3]))));
            return '#' + [r, g, b].map(function (part) {
                return part.toString(16).padStart(2, '0');
            }).join('');
        }
        return '';
    }

    function normalizeHexColor(raw) {
        return cssColorToHex(raw) || '';
    }

    function isMulticolourColorValue(raw) {
        var val = String(raw == null ? '' : raw).trim().toLowerCase();
        return val === '' || val === 'multicolour' || val === 'multicolor';
    }

    function colorFieldEmptyMeansMulticolour(field) {
        return !!(field && field.empty_means_multicolour);
    }

    function typographyRoleFromColorField(fieldKey) {
        var match = String(fieldKey || '').match(/^typo_(.+)_color$/);
        return match ? match[1] : '';
    }

    function typographyColorSemantic(role) {
        if (role === 'rating_label') {
            return 'accent';
        }
        if (role === 'review_count' || role === 'review_date' || role === 'flyout_label') {
            return 'muted';
        }
        if (role === 'link') {
            return 'link';
        }
        if (role === 'button') {
            return 'button';
        }
        return 'fg';
    }

    function typographyThemeSemantics(editor) {
        editor = editor || readEditor();
        var theme = (editor.config && editor.config.theme) || 'light';
        theme = theme === 'dark' ? 'dark' : 'light';
        var primary = String((editor.config && editor.config.primary_color) || '').trim();
        if (!primary) {
            var defaults = layoutFullDefaultsForEditor(editor);
            primary = String(defaults.primary_color || '').trim();
        }
        if (!primary) {
            primary = '#1e3a8a';
        }
        return {
            fg: theme === 'dark' ? '#f8fafc' : '#0f172a',
            muted: theme === 'dark' ? 'rgba(248,250,252,.68)' : '#64748b',
            accent: primary,
            link: '#1a73e8',
            button: '#ffffff',
        };
    }

    function typographyResolvedSwatchColor(fieldKey, editor) {
        var role = typographyRoleFromColorField(fieldKey);
        if (!role) {
            return '';
        }
        var sem = typographyThemeSemantics(editor);
        return sem[typographyColorSemantic(role)] || sem.fg;
    }

    function colorSwatchValueForField(key, storedValue, editor, fieldMeta) {
        var isUnset = storedValue === '' || storedValue == null;
        if (colorFieldEmptyMeansMulticolour(fieldMeta) && (isUnset || isMulticolourColorValue(storedValue))) {
            return 'multicolour';
        }
        if (!isUnset) {
            return normalizeHexColor(storedValue) || '#000000';
        }
        if (typographyRoleFromColorField(key)) {
            var typoSwatch = normalizeHexColor(typographyResolvedSwatchColor(key, editor));
            if (typoSwatch) {
                return typoSwatch;
            }
        }
        if (key === 'header_star_color' || key === 'card_star_color') {
            var starDefault = normalizeHexColor(layoutDefaultColorForField('star_color', editor));
            if (starDefault) {
                return starDefault;
            }
        }
        var defaultColor = normalizeHexColor(layoutDefaultColorForField(key, editor));
        return defaultColor || '#ffffff';
    }

    function colorResetIconSvg() {
        return '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">' +
            '<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h5M16 16v-5h-5M5.5 14.5A6 6 0 1 0 6 6l-1.5 3"/>' +
            '</svg>';
    }

    function syncColorFieldSwatch(key, editor, fieldMeta) {
        if (!key) {
            return;
        }
        var $field = $('[data-grwi-color-field="' + key + '"]');
        if (!$field.length) {
            return;
        }
        var stored = $('[data-config-key="' + key + '"]').val();
        var isUnset = stored === '' || stored == null;
        var swatchValue = colorSwatchValueForField(key, stored, editor, fieldMeta);
        var isMulticolour = swatchValue === 'multicolour';
        $field.toggleClass('is-multicolour', isMulticolour);
        $field.find('.grw-color-input').val(isMulticolour ? '#ffffff' : swatchValue);
        $field.find('.grw-color-hex').val(isUnset || isMulticolour ? '' : String(swatchValue || '').toUpperCase());
        $field.toggleClass('is-unset', !!($field.find('.grw-color-input').data('allowEmpty') && isUnset && !isMulticolour));
    }

    function syncAllColorFieldSwatches(editor) {
        var colorMeta = {};
        (editor.builder && editor.builder.colors || []).forEach(function (field) {
            colorMeta[field.key] = field;
        });
        $('[data-grwi-color-field]').each(function () {
            var key = $(this).data('grwi-color-field');
            syncColorFieldSwatch(key, editor, colorMeta[key] || null);
        });
    }

    function layoutFamilyFromLayout(layout, editor) {
        editor = editor || readEditor();
        var map = (editor.builder && editor.builder.layout_families) || {};
        if (map[layout]) {
            return map[layout];
        }
        layout = String(layout || '');
        if (layout === 'feed_slider' || layout === 'showcase' || layout === 'slider') {
            return 'showcase';
        }
        if (layout.indexOf('badge_') === 0) {
            return 'badge';
        }
        if (layout.indexOf('sticker_') === 0) {
            return 'pill';
        }
        if (layout.indexOf('feed_') === 0) {
            return layout.replace(/^feed_/, '');
        }
        return layout.split('_')[0] || layout;
    }

    function typographyElementVisibleInConfig(role, config, layout, typography, editor, ignoreVisibility) {
        editor = editor || readEditor();
        var roleMeta = null;
        (typography.roles || []).some(function (entry) {
            if (entry.role === role) {
                roleMeta = entry;
                return true;
            }
            return false;
        });
        if (!roleMeta || !roleMeta.layouts || roleMeta.layouts.indexOf(layout) < 0) {
            return false;
        }
        if (ignoreVisibility) {
            return true;
        }
        var element = roleMeta.visibility_element;
        var merged = $.extend({}, layoutFullDefaultsForEditor(editor), config || {});
        var family = layoutFamilyFromLayout(layout, editor);
        if (element === '__flyout__') {
            return true;
        }
        if (element === '__link__') {
            if (!isFeedLayoutKey(layout)) {
                return true;
            }
            var viewAllKey = family + '_show_view_all';
            if (Object.prototype.hasOwnProperty.call(merged, viewAllKey)) {
                return configFlagTruthy(merged, viewAllKey);
            }
            return configFlagTruthy(merged, 'show_view_all');
        }
        if (role === 'button') {
            if (!isFeedLayoutKey(layout)) {
                var writeKey = family + '_show_write_review';
                if (Object.prototype.hasOwnProperty.call(merged, writeKey)) {
                    return configFlagTruthy(merged, writeKey) && configFlagTruthy(merged, 'show_write_review_button');
                }
                return configFlagTruthy(merged, 'show_write_review_button');
            }
            var headerCtaKey = family + '_show_write_review';
            if (Object.prototype.hasOwnProperty.call(merged, headerCtaKey) && configFlagTruthy(merged, headerCtaKey)) {
                return true;
            }
            var footerViewAllKey = family + '_show_view_all';
            if (Object.prototype.hasOwnProperty.call(merged, footerViewAllKey) && configFlagTruthy(merged, footerViewAllKey)) {
                return true;
            }
            return String(merged.feed_review_button_mode || 'show_more') === 'show_more';
        }
        if (!element) {
            return true;
        }
        if (element === 'review_count') {
            return reviewsDisplayReviewCountPreviewVisible(merged, layout);
        }
        var key = family + '_show_' + element;
        if (Object.prototype.hasOwnProperty.call(merged, key)) {
            return configFlagTruthy(merged, key);
        }
        return true;
    }

    function feedHeaderVisibleInConfig(config, layout) {
        if (!isFeedLayoutKey(layout)) {
            return false;
        }
        return configFlagTruthy(config, 'feed_header_show');
    }

    function feedHeaderStarsVisibleInConfig(config, layout) {
        if (!isFeedLayoutKey(layout)) {
            return false;
        }
        var family = layoutFamilyFromLayout(layout, readEditor());
        var starKey = family === 'carousel' ? family + '_show_header_stars' : family + '_show_stars';
        return configFlagTruthy(config, starKey);
    }

    function configFlagTruthy(config, key) {
        if (!config || !Object.prototype.hasOwnProperty.call(config, key)) {
            return true;
        }
        var value = config[key];
        return value !== false && value !== 0 && value !== '0' && value !== '';
    }

    function previewVisibleRule(rule, config, layout, editor) {
        if (!rule) {
            return true;
        }
        editor = editor || readEditor();
        var withoutChrome = (editor.builder && editor.builder.layouts_without_google_logo_chrome) || [];
        if (rule === 'google_logo_background') {
            if (withoutChrome.indexOf(layout) >= 0) {
                return false;
            }
            return configFlagTruthy(config, 'google_logo_show_bg');
        }
        if (rule === 'google_logo_chrome') {
            if (withoutChrome.indexOf(layout) >= 0) {
                return false;
            }
            return configFlagTruthy(config, 'google_logo_show_bg') || configFlagTruthy(config, 'google_logo_show_border');
        }
        if (rule === 'google_logo_border') {
            if (withoutChrome.indexOf(layout) >= 0) {
                return false;
            }
            return configFlagTruthy(config, 'google_logo_show_border');
        }
        if (rule === 'review_count' || rule === 'read_more' || rule === 'view_all' || rule === 'write_review') {
            return reviewsDisplayOptionPreviewVisible(rule, config, layout);
        }
        if (rule === 'feed_header') {
            return isFeedLayoutKey(layout);
        }
        if (rule === 'feed_header_stars') {
            return feedHeaderStarsVisibleInConfig(config, layout);
        }
        return true;
    }

    function reviewsDisplayOptionKeyForElement(element) {
        return {
            review_count: 'show_review_count',
            read_more: 'show_read_more',
            view_all: 'show_view_all',
            write_review: 'show_write_review_button',
        }[element] || '';
    }

    function reviewsDisplayOptionLayouts(optionKey, editor) {
        editor = editor || readEditor();
        var map = (editor.builder && editor.builder.reviews_display_option_layouts) || {};
        return map[optionKey] || [];
    }

    function reviewsDisplayReviewCountPreviewVisible(config, layout) {
        var family = layoutFamilyFromLayout(layout, readEditor());
        var familyKey = family + '_show_review_count';
        if (Object.prototype.hasOwnProperty.call(config, familyKey) && !configFlagTruthy(config, familyKey)) {
            return false;
        }
        if (Object.prototype.hasOwnProperty.call(config, 'show_review_count') && !configFlagTruthy(config, 'show_review_count')) {
            return false;
        }
        if (!isFeedLayoutKey(layout)) {
            return true;
        }
        if (!configFlagTruthy(config, 'feed_header_show_review_count')) {
            return false;
        }
        return true;
    }

    function reviewsDisplayOptionPreviewVisible(element, config, layout) {
        var optionKey = reviewsDisplayOptionKeyForElement(element);
        if (!optionKey) {
            return true;
        }
        var allowedLayouts = reviewsDisplayOptionLayouts(optionKey);
        if (allowedLayouts.length && allowedLayouts.indexOf(layout) < 0) {
            return false;
        }
        if (element === 'review_count') {
            return reviewsDisplayReviewCountPreviewVisible(config, layout);
        }
        if (element === 'read_more') {
            var readMoreKey = layoutFamilyFromLayout(layout, readEditor()) + '_show_read_more';
            if (Object.prototype.hasOwnProperty.call(config, readMoreKey)) {
                return configFlagTruthy(config, readMoreKey);
            }
            return true;
        }
        return false;
    }

    function isFeedLayoutKey(layout) {
        return String(layout || '').indexOf('feed_') === 0;
    }

    function layoutUsesFixedWidth(layout) {
        var key = String(layout || '');
        return key === 'sticker_light' || key === 'sticker_bold';
    }

    function defaultWidgetWidthModeForLayout(layout) {
        if (layoutUsesFixedWidth(layout)) return 'auto';
        return isFeedLayoutKey(layout) ? 'full' : 'auto';
    }

    function normalizeBuilderWidgetWidthMode(value, layout) {
        if (layoutUsesFixedWidth(layout)) return 'auto';
        var v = String(value == null ? '' : value).toLowerCase();
        if (v === 'fit') v = 'auto';
        if (v === 'fixed') return defaultWidgetWidthModeForLayout(layout);
        if (v === 'custom' || v === 'full') return v;
        if (v === 'auto') return isFeedLayoutKey(layout) ? 'full' : 'auto';
        return defaultWidgetWidthModeForLayout(layout);
    }

    function widgetAlignmentShouldShow(layout, config) {
        var mode = normalizeBuilderWidgetWidthMode(config && config.widget_width_mode, layout);
        if (layoutUsesFixedWidth(layout)) return true;
        if (mode === 'full') return false;
        if (isFeedLayoutKey(layout)) return mode === 'custom';
        return true;
    }

    function contentAlignmentShouldShow(layout, config) {
        var mode = normalizeBuilderWidgetWidthMode(config && config.widget_width_mode, layout);
        if (layoutUsesFixedWidth(layout)) return false;
        if (isFeedLayoutKey(layout)) return false;
        var key = String(layout || '');
        if (key.indexOf('badge_') !== 0 && key.indexOf('sticker_') !== 0) return false;
        return mode === 'full' || mode === 'custom';
    }

    function layoutIdAliases(layout) {
        var id = String(layout || '');
        var aliases = [id];
        if (id.indexOf('feed_') === 0) {
            aliases.push(id.slice(5));
        } else if (['list', 'grid', 'masonry', 'carousel', 'slider', 'showcase'].indexOf(id) >= 0) {
            aliases.push('feed_' + id);
        }
        return aliases;
    }

    function fieldLayoutsAllow(field, layout) {
        if (!field || !Array.isArray(field.layouts) || !field.layouts.length) {
            return true;
        }
        var aliases = layoutIdAliases(layout);
        for (var i = 0; i < aliases.length; i++) {
            if (field.layouts.indexOf(aliases[i]) >= 0) {
                return true;
            }
        }
        return false;
    }

    function fieldVisible(field, config, layout) {
        if (field.key === 'widget_align') {
            if (!widgetAlignmentShouldShow(layout, config || {})) {
                return false;
            }
        }
        if (field.key === 'badge_alignment' || field.key === 'pill_alignment') {
            if (!contentAlignmentShouldShow(layout, config || {})) {
                return false;
            }
        }
        // Saved *_card_alignment still applies in preview/embed; hide the control.
        if (/_card_alignment$/.test(String(field.key || ''))) {
            return false;
        }
        if (!fieldLayoutsAllow(field, layout)) {
            return false;
        }
        var editor = readEditor();
        if (field.preview_visible && !previewVisibleRule(field.preview_visible, config, layout, editor)) {
            return false;
        }
        if (field.visibility_element) {
            var elements = String(field.visibility_element).split(',').map(function (part) {
                return part.trim();
            }).filter(Boolean);
            var anyVisible = elements.some(function (element) {
                return styleElementVisibleInConfig(element, config, layout, editor);
            });
            if (!anyVisible) {
                return false;
            }
        }
        if (field.show_unless) {
            var unlessKeys = Object.keys(field.show_unless);
            for (var i = 0; i < unlessKeys.length; i++) {
                var unlessKey = unlessKeys[i];
                var unlessValues = field.show_unless[unlessKey];
                var current = String(config[unlessKey]);
                if (Array.isArray(unlessValues)) {
                    if (unlessValues.indexOf(current) >= 0) {
                        return false;
                    }
                } else if (current === String(unlessValues)) {
                    return false;
                }
            }
        }
        if (!field.show_when) {
            return true;
        }
        var keys = Object.keys(field.show_when);
        var floatingLayouts = (readEditor().builder && readEditor().builder.floating_layouts) || [];
        var layoutSupportsFloating = floatingLayouts.length
            ? floatingLayouts.indexOf(layout) >= 0
            : !isFeedLayoutKey(layout);
        for (var j = 0; j < keys.length; j++) {
            var key = keys[j];
            if (key === 'widget_display_mode' && !layoutSupportsFloating) {
                continue;
            }
            if (String(config[key]) !== String(field.show_when[key])) {
                return false;
            }
        }
        return true;
    }

    function styleElementVisibleInConfig(element, config, layout, editor) {
        editor = editor || readEditor();
        var merged = $.extend({}, layoutFullDefaultsForEditor(editor), config || {});
        var family = layoutFamilyFromLayout(layout, editor);
        if (element === 'google_logo') {
            if (isFeedLayoutKey(layout)) {
                return configFlagTruthy(merged, 'feed_header_show_google_logo');
            }
            return configFlagTruthy(merged, family + '_show_google_logo') && configFlagTruthy(merged, 'google_logo_visible');
        }
        if (element === 'review_count') {
            if (!reviewsDisplayReviewCountPreviewVisible(merged, layout)) {
                return false;
            }
            // Global show_review_count (Customize → Header) must also stay on.
            if (Object.prototype.hasOwnProperty.call(merged, 'show_review_count')
                && !configFlagTruthy(merged, 'show_review_count')) {
                return false;
            }
            return true;
        }
        if (element === 'verified_badge') {
            return configFlagTruthy(merged, 'show_verified_badge_on_review_count')
                && configFlagTruthy(merged, family + '_show_verified_badge');
        }
        if (element === 'write_review') {
            if (isFeedLayoutKey(layout)) {
                return configFlagTruthy(merged, family + '_show_write_review');
            }
            return configFlagTruthy(merged, 'show_write_review_button')
                && configFlagTruthy(merged, family + '_show_write_review');
        }
        if (element === 'stars') {
            if (family === 'carousel') {
                return configFlagTruthy(merged, 'carousel_show_header_stars')
                    || configFlagTruthy(merged, 'carousel_show_slide_stars');
            }
            // Badge/sticker: only {family}_show_stars. Absent _show_card_stars must not
            // default-true via configFlagTruthy (that kept Star rating panels visible).
            if (family === 'badge' || family === 'pill') {
                return configFlagTruthy(merged, family + '_show_stars');
            }
            if (configFlagTruthy(merged, family + '_show_stars')) {
                return true;
            }
            if (Object.prototype.hasOwnProperty.call(merged, family + '_show_card_stars')) {
                return configFlagTruthy(merged, family + '_show_card_stars');
            }
            return false;
        }
        if (element === 'header_stars') {
            return feedHeaderStarsVisibleInConfig(merged, layout);
        }
        if (element === 'card_stars') {
            if (family === 'carousel') {
                return configFlagTruthy(merged, 'carousel_show_slide_stars');
            }
            if (Object.prototype.hasOwnProperty.call(merged, family + '_show_card_stars')) {
                return configFlagTruthy(merged, family + '_show_card_stars');
            }
            return configFlagTruthy(merged, family + '_show_stars');
        }
        if (element === 'author_meta') {
            return configFlagTruthy(merged, family + '_show_author')
                || configFlagTruthy(merged, family + '_show_author_avatar')
                || configFlagTruthy(merged, family + '_show_date')
                || configFlagTruthy(merged, family + '_show_google_posted');
        }
        var key = family + '_show_' + element;
        if (Object.prototype.hasOwnProperty.call(merged, key)) {
            return configFlagTruthy(merged, key);
        }
        return true;
    }

    function isAppearanceUpgradeFeature(feature) {
        return feature === 'advanced_customisation' || feature === 'builder_customize';
    }

    function groupFields(fields, sectionId) {
        var groups = {};
        var groupOrder = [];
        (fields || []).forEach(function (field) {
            if (field.section !== sectionId) {
                return;
            }
            var group = field.group || 'default';
            if (!groups[group]) {
                groups[group] = [];
                groupOrder.push(group);
            }
            groups[group].push(field);
        });
        groups.__order = groupOrder;
        return groups;
    }

    function isCompositeFieldType(type) {
        return type === 'outer_spacing' || type === 'float_offsets' || type === 'device_visibility' || type === 'static_hint';
    }

    function groupCardTitle(groupKey, fields) {
        if (GROUP_LABELS[groupKey]) {
            return GROUP_LABELS[groupKey];
        }
        if (fields.length === 1 && fields[0].label) {
            return fields[0].label;
        }
        return String(groupKey || 'Options').replace(/_/g, ' ').replace(/\b\w/g, function (letter) {
            return letter.toUpperCase();
        });
    }

    function renderCardHeading(label) {
        return '<div class="grw-field grw-field--card-head"><span class="grw-field__label">' + escHtml(label) + '</span></div>';
    }

    var accordionSeq = 0;

    function nextAccordionId(groupKey, title) {
        accordionSeq += 1;
        var slug = String(groupKey || title || 'section')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'section';
        return 'grwi-acc-' + slug + '-' + accordionSeq;
    }

    function optionLabelForValue(options, value) {
        var found = '';
        (options || []).some(function (opt) {
            if (String(opt.value) === String(value)) {
                found = opt.label || String(opt.value);
                return true;
            }
            return false;
        });
        if (found) {
            return found;
        }
        if (value == null || value === '') {
            return '';
        }
        return String(value);
    }

    function accordionValueFromField(field, config) {
        if (!field || !field.key) {
            return null;
        }
        if (field.type !== 'select' && field.type !== 'radio' && field.type !== 'visual') {
            return null;
        }
        if (!field.options || !field.options.length) {
            return null;
        }
        var lookupValue = config ? config[field.key] : undefined;
        if (field.key === 'review_sort') {
            lookupValue = canonicalReviewSortField(lookupValue, config && config.review_order, reviewSortAllowsPhotos(field));
        }
        var label = optionLabelForValue(field.options, lookupValue);
        if (!label) {
            return null;
        }
        return { key: field.key, label: label };
    }

    function accordionPlanPill(planKey) {
        var cfg = window.grwiCustomize || {};
        var i18n = cfg.i18n || {};
        if (planKey === 'business') {
            return i18n.businessPlan || 'BUSINESS PLAN';
        }
        return i18n.sitePlan || 'SITE PLAN';
    }

    function compactPlanBadgeText(planKey) {
        var cfg = window.grwiCustomize || {};
        var i18n = cfg.i18n || {};
        if (planKey === 'agency') {
            return i18n.agencyPlanCompact || 'AGENCY';
        }
        if (planKey === 'business') {
            return i18n.businessPlanCompact || 'BUSINESS';
        }
        return i18n.sitePlanCompact || 'SITE';
    }

    function planPrettyName(planKey) {
        var cfg = window.grwiCustomize || {};
        var i18n = cfg.i18n || {};
        if (planKey === 'agency') {
            return i18n.agencyPlanName || 'Agency';
        }
        if (planKey === 'business') {
            return i18n.businessPlanName || 'Business';
        }
        return i18n.sitePlanName || 'Site';
    }

    function planRequirementLabel(planKey) {
        var cfg = window.grwiCustomize || {};
        var i18n = cfg.i18n || {};
        if (planKey === 'agency') {
            return i18n.requiresAgencyPlan || 'Requires Agency plan';
        }
        if (planKey === 'business') {
            return i18n.requiresBusinessPlan || 'Requires Business plan or above';
        }
        return i18n.requiresSitePlan || 'Requires Site plan or above';
    }

    function premiumPreviewLockLabel(planKey) {
        var cfg = window.grwiCustomize || {};
        var i18n = cfg.i18n || {};
        var tpl = i18n.premiumPreviewLock || 'Preview freely — %s is required to publish';
        return tpl.replace('%s', planPrettyName(planKey));
    }

    function renderPlanBadge(planKey, options) {
        options = options || {};
        var premiumPreview = !!options.premiumPreview;
        var compact = options.compact !== false;
        var text = compact ? compactPlanBadgeText(planKey) : accordionPlanPill(planKey);
        var label = premiumPreview ? premiumPreviewLockLabel(planKey) : planRequirementLabel(planKey);
        var classes = 'grw-collapse__pill grw-plan-badge';
        if (compact) {
            classes += ' grw-plan-badge--compact';
        }
        if (premiumPreview) {
            classes += ' grw-plan-badge--preview';
        }
        if (planKey === 'business') {
            classes += ' grw-plan-badge--business';
        }
        return '<span class="' + classes + '" title="' + escHtml(label) + '" aria-label="' + escHtml(label) + '">' +
            escHtml(text) + '</span>';
    }

    function renderEntitlementLock(options) {
        options = options || {};
        var premiumPreview = !!options.premiumPreview;
        var label = premiumPreview ? premiumPreviewLockLabel(options.plan) : (options.label || planRequirementLabel(options.plan));
        var classes = 'grw-collapse__lock' + (premiumPreview ? ' grw-collapse__lock--preview' : '');
        return '<svg class="' + classes + '" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"' +
            ' title="' + escHtml(label) + '" aria-label="' + escHtml(label) + '">' +
            '<path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ' +
            'd="M16.5 10.5V7.75a4.5 4.5 0 10-9 0V10.5m-.75 0h10.5c.966 0 1.75.784 1.75 1.75v7A1.75 1.75 0 0117.25 21H6.75A1.75 1.75 0 015 19.25v-7c0-.966.784-1.75 1.75-1.75z"/>' +
            '</svg>';
    }

    function accordionLockIconSvg() {
        return renderEntitlementLock({});
    }

    function accordionChromeFromOptions(options, extra) {
        var chrome = {};
        if (options) {
            if (options.locked) {
                chrome.locked = true;
                chrome.plan = options.plan;
                if (options.pill) {
                    chrome.pill = options.pill;
                }
            }
            if (options.premiumPreview) {
                chrome.premiumPreview = true;
                chrome.plan = options.plan || chrome.plan;
            }
            if (options.overflowVisible) {
                chrome.overflowVisible = true;
            }
            if (options.value) {
                chrome.value = options.value;
                if (options.valueKey) {
                    chrome.valueKey = options.valueKey;
                }
            }
        }
        if (extra) {
            Object.keys(extra).forEach(function (key) {
                chrome[key] = extra[key];
            });
        }
        if (chrome.locked && editorIsPreviewFirst()) {
            chrome.premiumPreview = true;
            delete chrome.locked;
        }
        return chrome;
    }

    function renderFeatureGroupHeader(title, options) {
        options = options || {};
        var showLock = !!options.locked || !!options.premiumPreview;
        var html = '<span class="grw-collapse__label">';
        html += '<span class="grw-collapse__title">' + escHtml(title) + '</span>';
        if (showLock) {
            html += options.pill
                ? '<span class="grw-collapse__pill grw-plan-badge grw-plan-badge--compact' +
                    (options.plan === 'business' ? ' grw-plan-badge--business' : '') +
                    (options.plan === 'agency' ? ' grw-plan-badge--agency' : '') + '" title="' +
                    escHtml(options.premiumPreview ? premiumPreviewLockLabel(options.plan) : planRequirementLabel(options.plan)) +
                    '" aria-label="' +
                    escHtml(options.premiumPreview ? premiumPreviewLockLabel(options.plan) : planRequirementLabel(options.plan)) +
                    '">' + escHtml(options.pill) + '</span>'
                : renderPlanBadge(options.plan, { premiumPreview: !!options.premiumPreview });
        }
        html += '</span>';
        html += '<span class="grw-collapse__meta">';
        if (options.value) {
            html += '<span class="grw-collapse__value"' +
                (options.valueKey ? ' data-grwi-accordion-value="' + escHtml(options.valueKey) + '"' : '') +
                '>' + escHtml(options.value) + '</span>';
        }
        if (showLock) {
            html += renderEntitlementLock({
                plan: options.plan,
                premiumPreview: !!options.premiumPreview,
            });
        }
        html += '</span>';
        return html;
    }

    function renderAccordionSummary(title, options) {
        return renderFeatureGroupHeader(title, options);
    }

    var pendingAccordionOpenGroups = null;
    var accordionStateRestoring = false;
    var accordionInteractFromBody = false;
    var suppressSummaryToggleUntil = 0;
    var exclusiveParentDetailsName = '';

    function setExclusiveParentDetailsName(name) {
        exclusiveParentDetailsName = name ? String(name) : '';
    }

    function exclusiveParentNameAttr() {
        if (!exclusiveParentDetailsName) {
            return '';
        }
        return ' name="' + escHtml(exclusiveParentDetailsName) + '"';
    }

    function isExclusiveParentAccordion(details) {
        if (!details || !details.classList) {
            return false;
        }
        if (details.classList.contains('grw-collapse--nested') || details.hasAttribute('data-grwi-nested-accordion')) {
            return false;
        }
        return details.classList.contains('grw-style-accordion') || details.classList.contains('grw-feature-group');
    }

    function exclusiveParentGroup(target) {
        if (!target || !target.closest) {
            return null;
        }
        return target.closest('[data-grwi-exclusive-parents], [data-grwi-style-accordions], [data-grwi-section-accordions], [data-grwi-section-body]');
    }

    function closeSiblingExclusiveParents(target) {
        var group = exclusiveParentGroup(target);
        if (!group) {
            return;
        }
        group.querySelectorAll('details.grw-style-accordion[open], details.grw-feature-group[open]').forEach(function (other) {
            if (other === target) {
                return;
            }
            if (!isExclusiveParentAccordion(other)) {
                return;
            }
            if (target.contains(other) || other.contains(target)) {
                return;
            }
            other.open = false;
        });
    }

    function accordionKeyList(groupKey, title) {
        var keys = [];
        if (groupKey) {
            keys.push(String(groupKey));
        }
        if (title) {
            keys.push(String(title));
            keys.push('nested:' + String(title));
        }
        if (groupKey && title) {
            keys.push('nested:' + String(groupKey) + ':' + String(title));
        }
        return keys;
    }

    function applyPreservedAccordionOpen(attrs, groupKey, title) {
        attrs = String(attrs || '');
        if (!pendingAccordionOpenGroups) {
            return attrs;
        }
        var keys = accordionKeyList(groupKey, title);
        var shouldOpen = keys.some(function (key) {
            return !!pendingAccordionOpenGroups[key];
        });
        attrs = attrs.replace(/\s*\bopen\b/g, '');
        if (shouldOpen) {
            attrs += ' open';
        }
        return attrs;
    }

    function accordionKeyFromDetails(details) {
        if (!details || !details.getAttribute) {
            return '';
        }
        var key = details.getAttribute('data-grwi-accordion-key');
        if (key) {
            return key;
        }
        var wrap = details.closest ? details.closest('[data-grwi-group]') : null;
        var group = wrap ? wrap.getAttribute('data-grwi-group') : '';
        if (group && details.classList && details.classList.contains('grw-style-accordion')) {
            return group;
        }
        var titleEl = details.querySelector
            ? details.querySelector(':scope > .grw-collapse__summary .grw-collapse__title')
            : null;
        var title = titleEl ? String(titleEl.textContent || '').trim() : '';
        if (group && title && details.classList && (
            details.classList.contains('grw-collapse--nested')
            || details.hasAttribute('data-grwi-nested-accordion')
        )) {
            return 'nested:' + group + ':' + title;
        }
        return group || title;
    }

    function captureOpenAccordionGroups(root) {
        if (!root || !root.querySelectorAll) {
            return null;
        }
        var nodes = root.querySelectorAll('details.grw-collapse');
        if (!nodes.length) {
            return null;
        }
        var open = {};
        nodes.forEach(function (details) {
            if (!details.open) {
                return;
            }
            var key = accordionKeyFromDetails(details);
            if (key) {
                open[key] = true;
            }
        });
        return open;
    }

    function restoreOpenAccordionGroups(root, openGroups) {
        if (!root || !root.querySelectorAll || !openGroups) {
            return;
        }
        accordionStateRestoring = true;
        try {
            root.querySelectorAll('details.grw-collapse').forEach(function (details) {
                var key = accordionKeyFromDetails(details);
                if (!key) {
                    return;
                }
                var shouldOpen = !!openGroups[key];
                if (!!details.open !== shouldOpen) {
                    details.open = shouldOpen;
                }
                syncAccordionAria(details);
            });
        } finally {
            accordionStateRestoring = false;
        }
    }

    function isAccordionBodyFieldEvent(event) {
        var node = event && event.target;
        if (!node || !node.closest) {
            return false;
        }
        if (node.closest('summary.grw-collapse__summary')) {
            return false;
        }
        if (!node.closest('.grw-collapse__body')) {
            return false;
        }
        return !!node.closest(
            'input, select, textarea, button, label, option, .grw-segmented, .grw-segmented__option, .grw-switch, .grw-select, .grw-visual-option, .grw-color-field, .grw-outer-spacing, .grw-float-offsets, .grw-device-visibility'
        );
    }

    function preserveAccordionOpenGroups(groups) {
        pendingAccordionOpenGroups = groups && typeof groups === 'object' ? groups : null;
    }

    function scheduleAccordionOpenRestore(root, openGroups) {
        if (!openGroups || typeof window === 'undefined' || typeof window.setTimeout !== 'function') {
            return;
        }
        window.setTimeout(function () {
            restoreOpenAccordionGroups(root, openGroups);
        }, 0);
    }

    function renderFeatureGroup(title, bodyHtml, attrs, groupKey, options) {
        if (!bodyHtml) {
            return '';
        }
        options = options || {};
        attrs = applyPreservedAccordionOpen(attrs, groupKey, title);
        var id = nextAccordionId(groupKey, title);
        var bodyId = id + '-panel';
        var isOpen = /\bopen\b/.test(String(attrs || ''));
        var classes = 'grw-collapse grw-style-accordion grw-feature-group';
        if (options.locked) {
            classes += ' grw-collapse--locked';
        }
        if (options.premiumPreview) {
            classes += ' grw-collapse--premium-preview';
        }
        if (options.overflowVisible) {
            classes += ' grw-feature-group--overflow';
        }
        var html = '<details class="' + classes + '"' +
            (groupKey ? ' data-grwi-accordion-key="' + escHtml(groupKey) + '"' : '') +
            exclusiveParentNameAttr() +
            (attrs || '') + '>' +
            '<summary class="grw-collapse__summary" aria-expanded="' + (isOpen ? 'true' : 'false') +
            '" aria-controls="' + bodyId + '">' +
            renderFeatureGroupHeader(title, options) +
            '</summary>' +
            '<div class="grw-collapse__body" id="' + bodyId + '">' + bodyHtml + '</div></details>';
        if (groupKey) {
            return '<div data-grwi-group="' + escHtml(groupKey) + '">' + html + '</div>';
        }
        return html;
    }

    function renderSectionAccordion(title, bodyHtml, attrs, groupKey, options) {
        return renderFeatureGroup(title, bodyHtml, attrs, groupKey, options);
    }

    function wrapFeatureChildren(html, options) {
        if (!html) {
            return '';
        }
        options = options || {};
        var extra = options.attrs || '';
        if (options.offTooltip) {
            extra += ' title="' + escHtml(options.offTooltip) + '" data-grwi-requires-parent="' + escHtml(options.offTooltip) + '"';
        }
        return '<div class="grw-nested-accordions grw-feature-children" data-grwi-nested-accordions' + extra + '>' + html + '</div>';
    }

    function renderNestedGroups(items, wrapOptions) {
        var html = '';
        (items || []).forEach(function (item) {
            if (!item || !item.html) {
                return;
            }
            html += renderFeatureChildAccordion(
                item.title,
                item.html,
                item.attrs || '',
                item.key,
                item.options || {}
            );
        });
        if (!html) {
            return '';
        }
        if (wrapOptions === false) {
            return html;
        }
        return wrapFeatureChildren(html, wrapOptions || {});
    }

    function fieldsByKeys(fields, keys) {
        var map = {};
        (keys || []).forEach(function (key) {
            map[key] = true;
        });
        return (fields || []).filter(function (field) {
            return field && map[field.key];
        });
    }

    function fieldsExceptKeys(fields, keys) {
        var map = {};
        (keys || []).forEach(function (key) {
            map[key] = true;
        });
        return (fields || []).filter(function (field) {
            return field && !map[field.key];
        });
    }

    function renderFieldsList(fields, config, layout, extraOptions) {
        var html = '';
        extraOptions = extraOptions || {};
        (fields || []).forEach(function (field) {
            if (field && field.type === 'outer_spacing') {
                html += renderOuterSpacingLabeled(field, config, layout, extraOptions);
                return;
            }
            html += renderField(field, config, layout, extraOptions);
        });
        return html;
    }

    function renderFeatureChildAccordion(title, bodyHtml, attrs, groupKey, options) {
        if (!bodyHtml) {
            return '';
        }
        options = options || {};
        var nestedKey = groupKey || ('nested:' + String(title || '').trim());
        attrs = applyPreservedAccordionOpen(attrs, nestedKey, title);
        var id = nextAccordionId(groupKey || 'nested', title);
        var isOpen = /\bopen\b/.test(String(attrs || ''));
        var classes = 'grw-collapse grw-collapse--nested grw-feature-child';
        if (options.locked) {
            classes += ' grw-collapse--locked';
        }
        if (options.premiumPreview) {
            classes += ' grw-collapse--premium-preview';
        }
        return '<details class="' + classes + '" data-grwi-nested-accordion data-grwi-accordion-key="' +
            escHtml(nestedKey) + '"' + (attrs || '') + '>' +
            '<summary class="grw-collapse__summary" aria-expanded="' + (isOpen ? 'true' : 'false') +
            '" aria-controls="' + id + '-panel">' +
            renderFeatureGroupHeader(title, options) +
            '</summary>' +
            '<div class="grw-collapse__body" id="' + id + '-panel">' + bodyHtml + '</div></details>';
    }

    function wrapSectionAccordions(html, sectionId) {
        if (!html || !SECTION_ACCORDION_IDS[sectionId]) {
            return html;
        }
        return '<div class="grw-style-accordions" data-grwi-section-accordions data-grwi-exclusive-parents="' +
            escHtml(sectionId) + '">' + html + '</div>';
    }

    function syncAccordionAria(details) {
        if (!details || !details.querySelector) {
            return;
        }
        var summary = details.querySelector(':scope > .grw-collapse__summary');
        if (summary) {
            summary.setAttribute('aria-expanded', details.open ? 'true' : 'false');
        }
    }

    function fontFamilySummaryLabel(config, typographyFields) {
        if (String((config && config.font_source) || '') === 'inherit') {
            return 'Inherit from site';
        }
        var preset = fieldByKey(typographyFields || [], 'font_family_preset');
        if (preset) {
            return optionLabelForValue(preset.options, config ? config.font_family_preset : undefined) || '';
        }
        return '';
    }

    function displayLimitSummaryLabel(field, config) {
        field = field || {};
        config = config || {};
        var modeKey = field.mode_key || 'max_reviews_mode';
        var mode = String(config[modeKey] != null ? config[modeKey] : '');
        var parsed = parseInt(config[field.key || 'max_reviews'], 10);
        var unlimited = !!field.unlimited;
        var planMax = field.plan_max != null ? parseInt(field.plan_max, 10) : null;
        if (mode !== 'custom' && mode !== 'max') {
            if (!isNaN(parsed) && !unlimited && planMax != null && parsed < planMax) {
                mode = 'custom';
            } else {
                mode = 'max';
            }
        }
        if (mode === 'custom' && !isNaN(parsed) && parsed > 0) {
            return 'Custom · ' + parsed;
        }
        return 'Max';
    }

    function fontFamilySummaryFromBody(body) {
        var sourceRadio = body.querySelector('input[type="radio"][name="grwi-font_source"]:checked');
        var sourceHidden = body.querySelector('[data-config-key="font_source"]');
        var source = sourceRadio ? sourceRadio.value : (sourceHidden ? sourceHidden.value : '');
        if (String(source) === 'inherit') {
            return 'Inherit from site';
        }
        var select = body.querySelector('select[data-config-key="font_family_preset"]');
        if (select && select.selectedOptions && select.selectedOptions[0]) {
            return String(select.selectedOptions[0].textContent || '').trim();
        }
        return '';
    }

    function displayLimitSummaryFromBody(body) {
        var modeRadio = body.querySelector('input[type="radio"][name="grwi-max_reviews_mode"]:checked');
        var modeHidden = body.querySelector('[data-config-key="max_reviews_mode"]');
        var mode = modeRadio ? modeRadio.value : (modeHidden ? modeHidden.value : '');
        if (String(mode) === 'custom') {
            var custom = body.querySelector('[data-grwi-review-limit-custom]');
            var hidden = body.querySelector('[data-config-key="max_reviews"]');
            var n = custom && custom.value !== '' ? custom.value : (hidden ? hidden.value : '');
            var parsed = parseInt(n, 10);
            return !isNaN(parsed) && parsed > 0 ? ('Custom · ' + parsed) : 'Custom';
        }
        return 'Max';
    }

    function labelForAccordionValue(details, key) {
        var body = details && details.querySelector ? details.querySelector(':scope > .grw-collapse__body') : null;
        if (!body) {
            return '';
        }
        if (key === 'font_family_summary') {
            return fontFamilySummaryFromBody(body);
        }
        if (key === 'max_reviews_summary') {
            return displayLimitSummaryFromBody(body);
        }
        var select = body.querySelector('select[data-config-key="' + key + '"]');
        if (select && select.selectedOptions && select.selectedOptions[0]) {
            return String(select.selectedOptions[0].textContent || '').trim();
        }
        var radio = body.querySelector('input[type="radio"][name="grwi-' + key + '"]:checked');
        if (radio) {
            var segmentedText = radio.closest('.grw-segmented__option');
            segmentedText = segmentedText ? segmentedText.querySelector('.grw-segmented__text') : null;
            if (segmentedText) {
                return String(segmentedText.textContent || '').trim();
            }
            var radioLabel = radio.closest('label');
            return radioLabel ? String(radioLabel.textContent || '').trim() : '';
        }
        var visual = body.querySelector('.grw-visual-option.is-selected');
        if (visual) {
            var visualLabel = visual.getAttribute('aria-label')
                || (visual.querySelector('.grw-visual-option__label') && visual.querySelector('.grw-visual-option__label').textContent)
                || '';
            return String(visualLabel).trim();
        }
        return '';
    }

    function syncAccordionValueEl(el) {
        if (!el || !el.getAttribute) {
            return;
        }
        var key = el.getAttribute('data-grwi-accordion-value');
        if (!key) {
            return;
        }
        var details = el.closest('details.grw-collapse');
        if (!details) {
            return;
        }
        var label = labelForAccordionValue(details, key);
        if (label) {
            el.textContent = label;
        }
    }

    function isDisplayLimitSummarySource(node) {
        if (!node || !node.getAttribute) {
            return false;
        }
        if (node.getAttribute('data-grwi-review-limit-custom')) {
            return true;
        }
        var key = node.getAttribute('data-config-key');
        if (key === 'max_reviews' || key === 'max_reviews_mode') {
            return true;
        }
        var name = node.name ? String(node.name) : '';
        return name === 'grwi-max_reviews_mode' || name === 'grwi-max_reviews';
    }

    function syncDisplayLimitSummaries(fromNode) {
        var scope = fromNode && fromNode.closest ? fromNode.closest('details.grw-collapse') : null;
        var root = scope || document;
        root.querySelectorAll('.grw-collapse__value[data-grwi-accordion-value="max_reviews_summary"]').forEach(syncAccordionValueEl);
    }

    function syncAccordionSummaries(scope) {
        var root = scope && scope.querySelectorAll ? scope : document;
        root.querySelectorAll('.grw-collapse__value[data-grwi-accordion-value]').forEach(syncAccordionValueEl);
    }

    function bindAccordionChromeOnce() {
        if (typeof document === 'undefined' || !document.documentElement) {
            return;
        }
        if (document.documentElement.getAttribute('data-grwi-accordion-chrome') === '1') {
            return;
        }
        document.documentElement.setAttribute('data-grwi-accordion-chrome', '1');
        document.addEventListener('pointerdown', function (event) {
            accordionInteractFromBody = isAccordionBodyFieldEvent(event);
        }, true);
        document.addEventListener('keydown', function (event) {
            var key = event && event.key;
            if (key === ' ' || key === 'Enter' || key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown') {
                accordionInteractFromBody = isAccordionBodyFieldEvent(event);
            }
        }, true);
        document.addEventListener('click', function (event) {
            if (isAccordionBodyFieldEvent(event)) {
                accordionInteractFromBody = true;
            }
            if (!suppressSummaryToggleUntil || Date.now() > suppressSummaryToggleUntil) {
                return;
            }
            var summary = event.target && event.target.closest
                ? event.target.closest('summary.grw-collapse__summary')
                : null;
            if (summary) {
                event.preventDefault();
                event.stopPropagation();
            }
        }, true);
        document.addEventListener('toggle', function (event) {
            var target = event.target;
            if (target && target.classList && target.classList.contains('grw-collapse')) {
                syncAccordionAria(target);
            }
            // Named exclusive <details> can close the open panel when a body
            // control (Linked button, number input) is clicked. Undo that.
            if (target && target.classList && target.classList.contains('grw-collapse')
                && !target.open
                && accordionInteractFromBody
                && !accordionStateRestoring) {
                target.open = true;
                return;
            }
            if (!isExclusiveParentAccordion(target) || !target.open) {
                return;
            }
            if (accordionStateRestoring || accordionInteractFromBody) {
                return;
            }
            if (suppressSummaryToggleUntil && Date.now() < suppressSummaryToggleUntil) {
                return;
            }
            closeSiblingExclusiveParents(target);
        }, true);
        document.addEventListener('input', function (event) {
            if (isDisplayLimitSummarySource(event && event.target)) {
                syncDisplayLimitSummaries(event.target);
            }
        }, true);
        document.addEventListener('change', function (event) {
            var node = event.target;
            if (!node) {
                return;
            }
            if (isDisplayLimitSummarySource(node)) {
                syncDisplayLimitSummaries(node);
            }
            var key = node.getAttribute && node.getAttribute('data-config-key');
            if (!key && node.name && String(node.name).indexOf('grwi-') === 0) {
                key = String(node.name).replace(/^grwi-/, '');
            }
            if (!key) {
                return;
            }
            document.querySelectorAll('.grw-collapse__value[data-grwi-accordion-value="' + key + '"]').forEach(syncAccordionValueEl);
            if (key === 'font_source' || key === 'font_family_preset') {
                document.querySelectorAll('.grw-collapse__value[data-grwi-accordion-value="font_family_summary"]').forEach(syncAccordionValueEl);
            }
            if (key === 'max_reviews' || key === 'max_reviews_mode') {
                syncDisplayLimitSummaries(node);
            }
        }, true);
        document.addEventListener('toggle', function (event) {
            var details = event && event.target;
            if (!details || !details.querySelectorAll) {
                return;
            }
            details.querySelectorAll('.grw-collapse__value[data-grwi-accordion-value]').forEach(syncAccordionValueEl);
        }, true);
        document.addEventListener('click', function (event) {
            var opt = event.target && event.target.closest ? event.target.closest('.grw-visual-option') : null;
            if (!opt) {
                return;
            }
            var key = opt.getAttribute('data-visual-key');
            if (!key) {
                return;
            }
            window.setTimeout(function () {
                document.querySelectorAll('.grw-collapse__value[data-grwi-accordion-value="' + key + '"]').forEach(syncAccordionValueEl);
            }, 0);
        }, true);
    }

    function collectExclusiveAccordionGroups(scope) {
        var selector = '[data-grwi-style-accordions], [data-grwi-section-accordions], [data-grwi-exclusive-parents]';
        var groups = [];
        if (scope.matches && scope.matches(selector)) {
            groups.push(scope);
        }
        scope.querySelectorAll(selector).forEach(function (group) {
            groups.push(group);
        });
        return groups;
    }

    function initExclusiveAccordions(root) {
        bindAccordionChromeOnce();
        var scope = root && root.querySelectorAll ? root : (typeof document !== 'undefined' ? document : null);
        if (!scope || !scope.querySelectorAll) {
            return;
        }
        collectExclusiveAccordionGroups(scope).forEach(function (group) {
            if (group.getAttribute('data-grwi-accordion-bound') === '1') {
                return;
            }
            group.setAttribute('data-grwi-accordion-bound', '1');
            group.addEventListener('toggle', function (event) {
                var target = event.target;
                if (!target || target.tagName !== 'DETAILS') {
                    return;
                }
                if (accordionStateRestoring) {
                    return;
                }
                if (accordionInteractFromBody || (suppressSummaryToggleUntil && Date.now() < suppressSummaryToggleUntil)) {
                    return;
                }
                if (!target.open) {
                    return;
                }
                if (!isExclusiveParentAccordion(target)) {
                    return;
                }
                closeSiblingExclusiveParents(target);
            }, true);
        });
        scope.querySelectorAll('[data-grwi-nested-accordions]').forEach(function (group) {
            if (group.getAttribute('data-grwi-nested-accordion-bound') === '1') {
                return;
            }
            group.setAttribute('data-grwi-nested-accordion-bound', '1');
            group.addEventListener('toggle', function (event) {
                var target = event.target;
                if (!target || target.tagName !== 'DETAILS') {
                    return;
                }
                if (accordionStateRestoring || accordionInteractFromBody) {
                    return;
                }
                if (!target.open) {
                    return;
                }
                if (!target.classList.contains('grw-collapse--nested') && !target.hasAttribute('data-grwi-nested-accordion')) {
                    return;
                }
                if (target.closest('[data-grwi-nested-accordions]') !== group) {
                    return;
                }
                group.querySelectorAll('details.grw-collapse--nested[open], details[data-grwi-nested-accordion][open]').forEach(function (other) {
                    if (other !== target && other.closest('[data-grwi-nested-accordions]') === group) {
                        other.open = false;
                    }
                });
            }, true);
        });
    }

    function wrapLabeledInner(label, innerHtml) {
        if (!innerHtml) {
            return '';
        }
        return '<div class="grw-field grw-field--placement-control">' +
            (label ? '<span class="grw-field__label">' + escHtml(label) + '</span>' : '') +
            innerHtml +
            '</div>';
    }

    function renderCompositeInner(field, config) {
        if (field.type === 'outer_spacing') {
            var spacingKey = String((field.sides && field.sides.top) || 'widget_margin_top');
            var compactSpacing = /_margin_/.test(spacingKey);
            return wrapLabeledInner(compactSpacing ? '' : field.label, renderOuterSpacingInner(field, config));
        }
        if (field.type === 'float_offsets') {
            return wrapLabeledInner(field.label || 'Offset from edge', renderFloatOffsetsInner(field, config));
        }
        if (field.type === 'device_visibility') {
            return wrapLabeledInner(field.label || 'Visibility', renderDeviceVisibilityInner(field, config));
        }
        if (field.type === 'static_hint') {
            return renderStaticHintField(field);
        }
        return '';
    }

    function renderFieldsHtml(fields, config, layout, upgradeUrl, renderedUpgradeFeatures, builderUpgrade, options) {
        options = options || {};
        var groupHtml = '';
        (fields || []).forEach(function (field) {
            if (!fieldVisible(field, config, layout)) {
                return;
            }
            if (!options.showLockedControls && field.locked && field.upgrade_feature && !isAppearanceUpgradeFeature(field.upgrade_feature)) {
                if (renderedUpgradeFeatures[field.upgrade_feature]) {
                    return;
                }
                renderedUpgradeFeatures[field.upgrade_feature] = true;
                groupHtml += renderUpgradeCard(
                    (builderUpgrade || {})[field.upgrade_feature],
                    upgradeUrl,
                    field.upgrade_feature
                );
                return;
            }
            if (isCompositeFieldType(field.type)) {
                if (options.compositeAsInner) {
                    groupHtml += renderCompositeInner(field, config);
                    return;
                }
                groupHtml += renderSpecialFieldCard(field, config);
                return;
            }
            groupHtml += renderField(field, config, layout, options.fieldOptions || {});
        });
        return groupHtml;
    }

    function renderSpecialFieldCard(field, config) {
        if (field.type === 'outer_spacing') {
            return renderOuterSpacingCard(field, config);
        }
        if (field.type === 'float_offsets') {
            return renderFloatOffsetsCard(field, config);
        }
        if (field.type === 'device_visibility') {
            return renderDeviceVisibilityCard(field, config);
        }
        if (field.type === 'static_hint') {
            return renderStaticHintField(field);
        }
        return '';
    }

    function typographyDependsOnKey(driverKey, editor) {
        editor = editor || readEditor();
        var map = (editor.builder && editor.builder.typography_role_preview_drivers) || {};
        return Object.keys(map).some(function (role) {
            return (map[role] || []).indexOf(driverKey) >= 0;
        });
    }

    function visibilityElementDriverKeys(element, editor) {
        editor = editor || readEditor();
        var layout = (editor.builder && editor.builder.layout) || editor.layout || 'badge_card';
        var family = layoutFamilyFromLayout(layout, editor);
        var keys = [];
        String(element || '').split(',').map(function (part) {
            return part.trim();
        }).filter(Boolean).forEach(function (el) {
            if (el === 'google_logo') {
                keys.push(family + '_show_google_logo', 'google_logo_visible', 'feed_header_show', 'feed_header_show_google_logo');
                return;
            }
            if (el === 'review_count') {
                keys.push(family + '_show_review_count', 'show_review_count', 'feed_header_show', 'feed_header_show_review_count');
                return;
            }
            if (el === 'verified_badge') {
                keys.push(family + '_show_verified_badge', 'show_verified_badge_on_review_count');
                return;
            }
            if (el === 'stars') {
                keys.push(family + '_show_stars', family + '_show_card_stars', 'carousel_show_header_stars', 'carousel_show_slide_stars');
                return;
            }
            if (el === 'header_stars') {
                keys.push('feed_header_show', family + '_show_stars', 'carousel_show_header_stars');
                return;
            }
            if (el === 'card_stars') {
                keys.push(family + '_show_card_stars', family + '_show_stars', 'carousel_show_slide_stars');
                return;
            }
            if (el === 'author_meta') {
                keys.push(
                    family + '_show_author',
                    family + '_show_author_avatar',
                    family + '_show_date',
                    family + '_show_google_posted'
                );
                return;
            }
            keys.push(family + '_show_' + el, 'feed_header_show');
        });
        return keys;
    }

    function fieldDependsOnVisibilityElement(field, driverKey, editor) {
        if (!field || !field.visibility_element) {
            return false;
        }
        return visibilityElementDriverKeys(field.visibility_element, editor).indexOf(driverKey) >= 0;
    }

    function fieldDependsOnKey(fields, driverKey) {
        var editor = readEditor();
        // Master Show header only toggles the live widget, not Customize UI.
        if (driverKey === 'feed_header_show') {
            return false;
        }
        // Any family/global show_* toggle can hide Style/Customize cards; always
        // treat those as conditional drivers even when no field lists them yet.
        if (/_show_/.test(String(driverKey || ''))
            || driverKey === 'google_logo_visible'
            || driverKey === 'show_review_count'
            || driverKey === 'show_write_review_button'
            || driverKey === 'show_verified_badge_on_review_count') {
            return true;
        }
        if (driverKey === 'widget_width_mode') {
            return true;
        }
        return (fields || []).some(function (field) {
            if (field.show_when && Object.prototype.hasOwnProperty.call(field.show_when, driverKey)) {
                return true;
            }
            if (field.show_unless && Object.prototype.hasOwnProperty.call(field.show_unless, driverKey)) {
                return true;
            }
            if (fieldDependsOnVisibilityElement(field, driverKey, editor)) {
                return true;
            }
            if (field.preview_visible === 'google_logo_background' && driverKey === 'google_logo_show_bg') {
                return true;
            }
            if (field.preview_visible === 'google_logo_chrome' && (driverKey === 'google_logo_show_bg' || driverKey === 'google_logo_show_border')) {
                return true;
            }
            if (field.preview_visible === 'google_logo_border' && driverKey === 'google_logo_show_border') {
                return true;
            }
            if (field.preview_visible === 'review_count' || field.preview_visible === 'read_more' || field.preview_visible === 'view_all' || field.preview_visible === 'write_review') {
                var optionKey = reviewsDisplayOptionKeyForElement(field.preview_visible);
                var drivers = (editor.builder && editor.builder.reviews_display_option_drivers) || {};
                return (drivers[optionKey] || []).indexOf(driverKey) >= 0;
            }
            if (field.preview_visible === 'feed_header' || field.preview_visible === 'feed_header_stars') {
                var colorDrivers = (editor.builder && editor.builder.style_color_preview_drivers) || {};
                return (colorDrivers[field.preview_visible] || []).indexOf(driverKey) >= 0;
            }
            return false;
        }) || typographyDependsOnKey(driverKey);
    }

    function builderConditionalFields(builder) {
        return (builder.fields || []).concat(builder.colors || []);
    }

    function sectionsForConditionalDriver(builder, driverKey) {
        if (driverKey === 'feed_header_show') {
            return [];
        }
        var sections = {};
        var editor = { builder: builder, layout: builder.layout };
        builderConditionalFields(builder).forEach(function (field) {
            if (field.show_when && Object.prototype.hasOwnProperty.call(field.show_when, driverKey)) {
                sections[field.section] = true;
            }
            if (field.show_unless && Object.prototype.hasOwnProperty.call(field.show_unless, driverKey)) {
                sections[field.section] = true;
            }
            if (fieldDependsOnVisibilityElement(field, driverKey, editor)) {
                sections[field.section || 'style'] = true;
            }
            if (field.preview_visible === 'feed_header' || field.preview_visible === 'feed_header_stars') {
                var colorDrivers = builder.style_color_preview_drivers || {};
                if ((colorDrivers[field.preview_visible] || []).indexOf(driverKey) >= 0) {
                    sections[field.section || 'customize'] = true;
                }
            }
        });
        if (typographyDependsOnKey(driverKey)) {
            sections.customize = true;
        }
        // Visibility toggles live on Customize; refresh that panel when show_* keys change.
        if ((/_show_/.test(String(driverKey || '')) && driverKey !== 'feed_header_show') || driverKey === 'google_logo_visible') {
            sections.customize = true;
        }
        return Object.keys(sections);
    }

    var activeEditorRef = null;
    var AI_SUMMARY_RAIL_SVG = 'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z';
    var DEFAULT_AI_SUMMARY_FIELDS = [
        { key: 'ai_summary_enabled', type: 'checkbox', section: 'ai-summary', group: 'ai_enable', label: 'Show AI summary card' },
        { key: 'ai_summary_style', type: 'select', section: 'ai-summary', group: 'ai_style', label: 'Style', options: [
            { value: 'list', label: 'List' },
            { value: 'text', label: 'Text' },
        ] },
        { key: 'ai_summary_typing_animation', type: 'checkbox', section: 'ai-summary', group: 'ai_style', label: 'Text Typing Animation' },
        { key: 'ai_summary_picture_animation', type: 'checkbox', section: 'ai-summary', group: 'ai_style', label: 'AI Picture Animation' },
        { key: 'ai_summary_label', type: 'text', section: 'ai-summary', group: 'ai_label', label: 'Card label', maxlength: 40 },
        { key: 'typo_ai_summary_label_size', type: 'text', section: 'ai-summary', group: 'ai_label', label: 'Label size' },
        { key: 'typo_ai_summary_label_weight', type: 'select', section: 'ai-summary', group: 'ai_label', label: 'Label weight' },
        { key: 'typo_ai_summary_label_color', type: 'color', section: 'ai-summary', group: 'ai_label', label: 'Label colour', allow_empty: true },
        { key: 'ai_summary_star_color', type: 'color', section: 'ai-summary', group: 'ai_stars', label: 'AI summary star colour', allow_empty: true, hint: 'Only affects the AI summary card. Leave blank for the default AI blue gradient.' },
        { key: 'ai_summary_star_size_mode', type: 'visual', section: 'ai-summary', group: 'ai_stars', label: 'Star size', options: [
            { value: 'small', label: 'Small', hint: '12px' },
            { value: 'middle', label: 'Middle', hint: '16px' },
            { value: 'large', label: 'Large', hint: '20px' },
            { value: 'custom', label: 'Custom' },
        ] },
        { key: 'ai_summary_star_size_custom', type: 'number', section: 'ai-summary', group: 'ai_stars', label: 'Custom size (px)', min: 8, max: 48, show_when: { ai_summary_star_size_mode: 'custom' } },
    ];

    function customizeTrialEligibility(editor) {
        var cfg = window.grwiCustomize || {};
        if (editor && Object.prototype.hasOwnProperty.call(editor, 'trial_eligible')) {
            if (editor.trial_eligible === null) {
                return null;
            }
            return !!editor.trial_eligible;
        }
        if (cfg.isLinked === false || cfg.isLinked === 0 || cfg.isLinked === '0') {
            return null;
        }
        if (cfg.trialEligible === '' || typeof cfg.trialEligible === 'undefined' || cfg.trialEligible === null) {
            return null;
        }
        return cfg.trialEligible === true || cfg.trialEligible === 1 || cfg.trialEligible === '1';
    }

    function customizeTrialEligible(editor) {
        return customizeTrialEligibility(editor) === true;
    }

    function trialCopyBag(plan, editor) {
        var cfg = window.grwiCustomize || {};
        var bags = (editor && editor.trial_copy) || cfg.trialCopy || {};
        return bags[plan === 'business' ? 'business' : 'site'] || {};
    }

    function trialSupportingCopy(plan, eligible, i18n, editor) {
        i18n = i18n || {};
        var bag = trialCopyBag(plan, editor);
        if (eligible === null) {
            return bag.unknown_supporting || i18n.trialUnknownSupporting || 'Trial eligibility will be confirmed before payment.';
        }
        if (eligible) {
            return bag.eligible_supporting || i18n.siteLayoutSupporting || i18n.businessTrialSupporting || '';
        }
        if (plan === 'business') {
            return bag.ineligible_supporting || i18n.businessTrialIneligibleSupporting || 'Charged at checkout. Cancel anytime.';
        }
        return bag.ineligible_supporting || i18n.trialIneligibleSupporting || 'Charged at checkout. Cancel anytime.';
    }

    function trialCtaLabel(plan, eligible, i18n, editor) {
        i18n = i18n || {};
        var bag = trialCopyBag(plan, editor);
        if (eligible === null) {
            return bag.unknown_cta || 'Sign in to continue';
        }
        if (eligible) {
            return bag.eligible_cta || i18n.customizeTrialCta || 'Start 7-day free trial';
        }
        return bag.ineligible_cta || (plan === 'business' ? (i18n.aiUpgradeCta || 'Upgrade to Business') : (i18n.customizeUpgradeCta || 'Upgrade to Site'));
    }

    function rewriteCheckoutPlan(url, plan) {
        if (!url) {
            return '';
        }
        try {
            var parsed = new URL(url, window.location.origin);
            parsed.searchParams.set('plan', plan);
            if (!parsed.searchParams.get('cycle')) {
                parsed.searchParams.set('cycle', 'monthly');
            }
            return parsed.toString();
        } catch (err) {
            return String(url).replace(/([?&])plan=[^&]*/i, '$1plan=' + encodeURIComponent(plan));
        }
    }

    function customizeCheckoutUrl(editor, forTrial, plan) {
        var cfg = window.grwiCustomize || {};
        plan = plan === 'business' || plan === 'agency' ? plan : 'site';
        var href = '';
        var catalog = (editor && editor.preview_first_catalog) || (window.grwiCustomize && window.grwiCustomize.previewFirstCatalog) || {};
        if (catalog.checkout_urls && catalog.checkout_urls[plan]) {
            return rewriteCheckoutPlan(catalog.checkout_urls[plan], plan);
        }
        if (plan === 'agency') {
            if (forTrial) {
                href = (editor && editor.agency_trial_url) || cfg.agencyTrialUrl || '';
            } else {
                href = (editor && editor.agency_upgrade_checkout_url) || cfg.agencyUpgradeCheckoutUrl || '';
            }
            if (href) {
                return rewriteCheckoutPlan(href, plan);
            }
        }
        if (plan === 'business') {
            if (forTrial) {
                href = (editor && editor.business_trial_url) || cfg.businessTrialUrl || '';
            } else {
                href = (editor && editor.business_upgrade_checkout_url) || cfg.businessUpgradeCheckoutUrl || '';
            }
            if (href) {
                return rewriteCheckoutPlan(href, plan);
            }
        }
        if (forTrial) {
            href = (editor && editor.trial_url) || cfg.trialUrl || cfg.upgradeUrl || '';
        } else {
            href = (editor && editor.upgrade_checkout_url)
                || cfg.upgradeCheckoutUrl
                || cfg.upgradeUrl
                || cfg.trialUrl
                || '';
        }
        if (plan !== 'site' && href) {
            return rewriteCheckoutPlan(href, plan);
        }
        return href;
    }

    function featurePromptFromEditor(editor, featureKey) {
        var prompts = (editor && editor.feature_prompts) || {};
        var map = {
            filters: 'review_filters',
            review_filters: 'review_filters',
            ai_summary: 'ai_summary',
            builder_customize: 'advanced_customisation',
            advanced_customisation: 'advanced_customisation',
            review_limit: 'review_limit',
            json_ld: 'review_jsonld',
            review_jsonld: 'review_jsonld',
            reviewer_avatars: 'reviewer_profile_photos',
            review_photos: 'uploaded_review_photos',
            remove_branding: 'remove_branding',
            widget_limit: 'widget_limit',
            domain_limit: 'domain_limit',
            layouts: 'premium_layouts',
            premium_layouts: 'premium_layouts'
        };
        return prompts[map[featureKey] || featureKey] || {};
    }

    function upsellCopyForFeature(featureKey, trialEligible, i18n) {
        i18n = i18n || {};
        if (featureKey === 'ai_summary') {
            return {
                plan: 'business',
                pill: i18n.businessPlan || i18n.businessPlanPill || 'BUSINESS PLAN',
                headline: trialEligible
                    ? (i18n.aiTrialHeadline || 'Unlock AI Summary')
                    : (i18n.aiUpgradeHeadline || 'Unlock AI Summary'),
                body: trialEligible
                    ? (i18n.aiTrialBody || 'Try an AI-written review overview on your feed free for 7 days.')
                    : (i18n.aiUpgradeBody || 'Add an AI-written review overview to your feed with Business.'),
                cta: trialEligible
                    ? (i18n.aiTrialCta || 'Start 7-day Business trial')
                    : (i18n.aiUpgradeCta || 'Upgrade to Business'),
                foot: trialEligible
                    ? (i18n.aiTrialFoot || 'Then $14.99/month · Cancel anytime')
                    : (i18n.aiUpgradeFoot || 'From $14.99/month · Cancel anytime'),
            };
        }
        if (featureKey === 'filters') {
            return {
                plan: 'site',
                pill: i18n.sitePlanPill || i18n.sitePlan || 'SITE PLAN',
                headline: trialEligible
                    ? (i18n.filtersTrialHeadline || 'Unlock review filters and sorting with Site')
                    : (i18n.filtersUpgradeHeadline || 'Unlock review filters and sorting with Site'),
                body: trialEligible
                    ? (i18n.filtersTrialBody || 'Choose which reviews appear using star ratings, keywords and reviewer filters, and sort them by newest, rating or a custom order. Site also includes reviewer profile photos, up to 30 reviews and bi-weekly syncing.')
                    : (i18n.filtersUpgradeBody || 'Choose which reviews appear using star ratings, keywords and reviewer filters, and sort them by newest, rating or a custom order. Site also includes reviewer profile photos, up to 30 reviews and bi-weekly syncing.'),
                cta: trialEligible
                    ? (i18n.filtersTrialCta || 'Start 7-day Site trial')
                    : (i18n.filtersUpgradeCta || 'Upgrade to Site'),
                foot: trialEligible
                    ? (i18n.filtersTrialFoot || 'Then $5.99/month · Cancel anytime')
                    : (i18n.filtersUpgradeFoot || 'From $5.99/month · Cancel anytime'),
            };
        }
        if (featureKey === 'review_photos') {
            return {
                plan: 'business',
                pill: i18n.businessPlan || i18n.businessPlanPill || 'BUSINESS PLAN',
                headline: 'Show customer photos with Business',
                body: 'Display photos customers uploaded with their Google reviews. Included with Business and Agency.',
                cta: trialEligible
                    ? (i18n.aiTrialCta || 'Start 7-day Business trial')
                    : (i18n.aiUpgradeCta || 'Upgrade to Business'),
                foot: trialEligible
                    ? (i18n.aiTrialFoot || 'Then $14.99/month · Cancel anytime')
                    : (i18n.aiUpgradeFoot || 'From $14.99/month · Cancel anytime'),
            };
        }
        if (featureKey === 'reviewer_avatars') {
            return {
                plan: 'site',
                pill: i18n.sitePlanPill || i18n.sitePlan || 'SITE PLAN',
                headline: 'Unlock reviewer profile photos with Site',
                body: 'Show each reviewer’s Google profile photo where available. Included with Site, Business and Agency.',
                cta: trialEligible
                    ? (i18n.filtersTrialCta || 'Start 7-day Site trial')
                    : (i18n.filtersUpgradeCta || 'Upgrade to Site'),
                foot: trialEligible
                    ? (i18n.filtersTrialFoot || 'Then $5.99/month · Cancel anytime')
                    : (i18n.filtersUpgradeFoot || 'From $5.99/month · Cancel anytime'),
            };
        }
        if (featureKey === 'json_ld') {
            return {
                plan: 'business',
                pill: i18n.businessPlan || i18n.businessPlanPill || 'BUSINESS PLAN',
                headline: 'Add review structured data with Business',
                body: 'Get Business to unlock structured data and star ratings in search.',
                cta: trialEligible
                    ? (i18n.aiTrialCta || 'Start 7-day Business trial')
                    : (i18n.aiUpgradeCta || 'Upgrade to Business'),
                foot: trialEligible
                    ? (i18n.aiTrialFoot || 'Then $14.99/month · Cancel anytime')
                    : (i18n.aiUpgradeFoot || 'From $14.99/month · Cancel anytime'),
            };
        }
        // builder_customize / advanced_customisation / default Site card
        return {
            plan: 'site',
            pill: i18n.sitePlanPill || i18n.sitePlan || 'SITE PLAN',
            headline: trialEligible
                ? (i18n.customizeTrialHeadline || 'Make every widget match your brand')
                : (i18n.customizeUpgradeHeadline || 'Make every widget match your brand'),
            body: trialEligible
                ? (i18n.customizeTrialBody || 'Try custom colours, typography, spacing, borders, and labels free for 7 days on Site.')
                : (i18n.customizeUpgradeBody || 'Unlock custom colours, typography, spacing, borders, and labels with Site.'),
            cta: trialEligible
                ? (i18n.customizeTrialCta || 'Start 7-day free trial')
                : (i18n.customizeUpgradeCta || 'Upgrade to Site'),
            foot: trialEligible
                ? (i18n.customizeTrialFoot || 'Then $5.99/month · Cancel anytime')
                : (i18n.customizeUpgradeFoot || 'From $5.99/month · Cancel anytime'),
        };
    }

    function renderUpsellCard(editor, featureKey, options) {
        options = options || {};
        var cfg = window.grwiCustomize || {};
        var i18n = cfg.i18n || {};
        var trialEligible = customizeTrialEligibility(editor);
        var copy = upsellCopyForFeature(featureKey || 'builder_customize', trialEligible === true, i18n);
        var prompt = featurePromptFromEditor(editor, featureKey || 'builder_customize');
        if (prompt.title) {
            copy.headline = prompt.title;
        }
        if (prompt.body) {
            copy.body = prompt.body;
        }
        if (prompt.primary_label) {
            copy.cta = prompt.primary_label;
        } else if (trialEligible === null) {
            copy.cta = trialCtaLabel(copy.plan, null, i18n, editor);
            copy.foot = trialSupportingCopy(copy.plan, null, i18n, editor);
        } else if (trialEligible === false) {
            copy.cta = trialCtaLabel(copy.plan, false, i18n, editor);
            copy.foot = trialSupportingCopy(copy.plan, false, i18n, editor);
        }
        if (prompt.supporting) {
            copy.foot = prompt.supporting;
        } else if (trialEligible === null) {
            copy.foot = trialSupportingCopy(copy.plan, null, i18n, editor);
        } else if (trialEligible === false) {
            copy.foot = trialSupportingCopy(copy.plan, false, i18n, editor);
        }
        var href = prompt.checkout_url || customizeCheckoutUrl(editor, trialEligible === true, copy.plan);
        var featureLabel = featureKey === 'ai_summary'
            ? 'AI Summary'
            : (featureKey === 'filters' ? 'review filters and sorting'
                : (featureKey === 'review_photos' ? 'customer review photos'
                    : (featureKey === 'reviewer_avatars' ? 'reviewer profile photos'
                    : (featureKey === 'json_ld' ? 'review structured data' : 'full customisation'))));
        var planName = copy.plan === 'business'
            ? (i18n.businessPlanName || 'Business')
            : (i18n.sitePlanName || 'Site');
        var modalTitle = prompt.title || ('Unlock ' + featureLabel + ' with ' + planName);
        var modalBody = prompt.body || copy.body;
        var modalSupporting = prompt.supporting || trialSupportingCopy(copy.plan, trialEligible, i18n, editor);
        var sparkle = '<svg class="grw-customize-trial-card__sparkle" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
            '<path fill="currentColor" d="M12 2.25c.28 0 .52.18.6.45l1.1 3.7a2.25 2.25 0 0 0 1.52 1.52l3.7 1.1a.63.63 0 0 1 0 1.21l-3.7 1.1a2.25 2.25 0 0 0-1.52 1.52l-1.1 3.7a.63.63 0 0 1-1.21 0l-1.1-3.7a2.25 2.25 0 0 0-1.52-1.52l-3.7-1.1a.63.63 0 0 1 0-1.21l3.7-1.1a2.25 2.25 0 0 0 1.52-1.52l1.1-3.7a.63.63 0 0 1 .61-.45Z"/></svg>';
        var isLinkPrimary = prompt.mode === 'link' || (trialEligible === null && String(copy.cta || '').indexOf('Link') === 0);
        var ctaHtml = isLinkPrimary
            ? '<button type="button" class="grw-customize-trial-card__cta" data-grwi-connect-account>' +
                escHtml(copy.cta) + '</button>'
            : (href
            ? '<button type="button" class="grw-customize-trial-card__cta" data-grwi-trial-cta="1"' +
                ' data-feature="' + escHtml(featureKey || 'builder_customize') + '"' +
                ' data-plan="' + escHtml(copy.plan || 'site') + '"' +
                ' data-trial-eligible="' + (trialEligible === null ? '' : (trialEligible ? '1' : '0')) + '"' +
                ' data-checkout-url="' + escHtml(href) + '"' +
                ' data-feature-label="' + escHtml(featureLabel) + '"' +
                ' data-modal-title="' + escHtml(modalTitle) + '"' +
                ' data-modal-body="' + escHtml(modalBody) + '"' +
                ' data-modal-supporting="' + escHtml(modalSupporting) + '">' +
                escHtml(copy.cta) + '</button>'
            : '<span class="grw-customize-trial-card__cta" aria-disabled="true">' + escHtml(copy.cta) + '</span>');
        var classes = 'grw-customize-trial-card grw-upsell-card';
        if (options.compact) {
            classes += ' grw-customize-trial-card--compact';
        }
        var mediaHtml = '';
        if (featureKey === 'json_ld') {
            mediaHtml = jsonLdExplainerFigureHtml(editor, jsonLdExplainerField(editor), { inCard: true });
        }

        return '<aside class="' + classes + '" data-grwi-upsell-card="' + escHtml(featureKey || 'builder_customize') +
            '" data-trial-eligible="' + (trialEligible === null ? '' : (trialEligible ? '1' : '0')) + '">' +
            '<div class="grw-customize-trial-card__eyebrow">' + sparkle +
            '<span class="grw-customize-trial-card__pill">' + escHtml(copy.pill) + '</span></div>' +
            '<h3 class="grw-customize-trial-card__title">' + escHtml(copy.headline) + '</h3>' +
            mediaHtml +
            '<p class="grw-customize-trial-card__body">' + escHtml(copy.body) + '</p>' +
            ctaHtml +
            (prompt.secondary_label
                ? (prompt.mode === 'link' && prompt.secondary_label.indexOf('Link') === 0
                ? '<button type="button" class="grw-customize-trial-card__cta grw-customize-trial-card__cta--secondary" data-grwi-connect-account>' +
                    escHtml(prompt.secondary_label) + '</button>'
                    : '<button type="button" class="grw-customize-trial-card__cta grw-customize-trial-card__cta--secondary" data-grwi-trial-cta="1"' +
                        ' data-feature="' + escHtml(featureKey || 'builder_customize') + '"' +
                        ' data-plan="' + escHtml(copy.plan || 'site') + '"' +
                        ' data-trial-eligible="' + (trialEligible === null ? '' : (trialEligible ? '1' : '0')) + '"' +
                        ' data-checkout-url="' + escHtml(prompt.secondary_url || prompt.compare_url || href) + '"' +
                        ' data-feature-label="' + escHtml(featureLabel) + '"' +
                        ' data-modal-title="' + escHtml(modalTitle) + '"' +
                        ' data-modal-body="' + escHtml(modalBody) + '"' +
                        ' data-modal-supporting="' + escHtml(modalSupporting) + '">' +
                        escHtml(prompt.secondary_label) + '</button>')
                : '') +
            '<p class="grw-customize-trial-card__foot">' + escHtml(copy.foot) + '</p>' +
            '</aside>';
    }

    function renderUpgradeCard(upgrade, upgradeUrl, featureKey) {
        // Prefer shared upsell chrome; keep a tiny fallback if editor context is missing.
        var editor = activeEditorRef || readEditor();
        var key = featureKey || (upgrade && upgrade.upgrade_feature) || 'builder_customize';
        if (key === 'filters' || key === 'ai_summary' || key === 'builder_customize' || key === 'advanced_customisation'
            || key === 'review_photos' || key === 'json_ld' || key === 'reviewer_avatars') {
            return renderUpsellCard(editor, key === 'advanced_customisation' ? 'builder_customize' : key, {
                compact: key !== 'builder_customize' && key !== 'advanced_customisation',
            });
        }
        if (!upgrade) {
            return renderUpsellCard(editor, key, { compact: true });
        }
        var link = upgradeUrl
            ? '<p class="grw-layout-upgrade__actions"><button type="button" class="button button-primary" data-grwi-trial-cta="1"' +
                ' data-feature="' + escHtml(key) + '" data-plan="site" data-trial-eligible="1"' +
                ' data-checkout-url="' + escHtml(upgradeUrl) + '"' +
                ' data-feature-label="this feature"' +
                ' data-modal-title="Unlock with Site"' +
                ' data-modal-body="' + escHtml(upgrade.message || 'Site includes 31 layouts, up to 30 reviews, reviewer photos, filters, bi-weekly syncing and full design control.') + '"' +
                ' data-modal-supporting="' + escHtml(trialSupportingCopy('site', customizeTrialEligibility(editor), (window.grwiCustomize && grwiCustomize.i18n) || {}, editor)) + '">' +
                'Start 7-day free trial</button></p>'
            : '';
        return '<div class="grw-layout-upgrade grw-layout-upgrade--compact">' +
            '<h3 class="grw-layout-upgrade__title">' + escHtml(upgrade.title || 'Start 7-day free trial') + '</h3>' +
            '<p class="grw-layout-upgrade__lede">' + escHtml(upgrade.message || '') + '</p>' + link + '</div>';
    }

    function renderCustomizeTrialCard(editor) {
        return renderUpsellCard(editor, 'builder_customize');
    }

    function parseWidthCustomParts(raw) {
        var value = String(raw || '').trim();
        var match = value.match(/^(\d+(?:\.\d+)?)(px|%)$/i);
        if (match) {
            return { number: match[1], unit: match[2].toLowerCase() };
        }
        if (/^\d+$/.test(value)) {
            return { number: value, unit: 'px' };
        }
        return { number: '320', unit: 'px' };
    }

    function composeWidthCustomValue(number, unit) {
        unit = unit === '%' ? '%' : 'px';
        var num = parseFloat(number);
        if (!isFinite(num) || num <= 0) num = 320;
        if (unit === '%') {
            num = Math.min(100, num);
            return String(num) + '%';
        }
        num = Math.max(1, Math.min(2000, Math.round(num)));
        return num + 'px';
    }

    function renderWidthCustomField(field, value, options) {
        var parts = parseWidthCustomParts(value);
        var html = '<div class="grw-width-custom" data-grwi-width-custom="' + escHtml(field.key) + '">';
        html += '<input type="number" class="grw-input grw-width-custom__number" min="1" max="2000" step="1" value="' +
            escHtml(parts.number) + '" aria-label="' + escHtml(field.label || 'Custom width') + '"' +
            (field.locked && !fieldIsPremiumPreview(field) ? ' disabled' : '') + ' />';
        html += '<div class="grw-width-custom__units" role="radiogroup" aria-label="Custom width unit">';
        ['px', '%'].forEach(function (unit) {
            html += '<button type="button" class="grw-width-custom__unit' + (parts.unit === unit ? ' is-selected' : '') +
                '" data-grwi-width-unit="' + escHtml(unit) + '"' + (field.locked && !fieldIsPremiumPreview(field) ? ' disabled' : '') + '>' +
                escHtml(unit) + '</button>';
        });
        html += '</div>';
        html += '<input type="hidden"' + (options.inputAttrs || '') + ' value="' + escHtml(composeWidthCustomValue(parts.number, parts.unit)) + '" />';
        html += '</div>';
        return html;
    }

    function renderStaticHintField(field) {
        var html = '<p class="grw-field__hint grw-field__hint--static">' + escHtml(field.label || '') + '</p>';
        if (field.persist_value != null && field.key) {
            html += '<input type="hidden" data-config-key="' + escHtml(field.key) + '" value="' + escHtml(String(field.persist_value)) + '" />';
        }
        if (field.manage_in_web_dashboard) {
            var cfg = window.grwiCustomize || {};
            var href = (readEditor() && readEditor().widget_web_edit_url) || cfg.dashboardUrl || cfg.upgradeUrl || '';
            if (href) {
                html += '<p class="grw-field__hint"><a class="grw-style-customize-hint__link" href="' + escHtml(href) + '" target="_blank" rel="noopener noreferrer">Manage in web dashboard</a></p>';
            } else {
                html += '<p class="grw-field__hint">Manage in web dashboard</p>';
            }
        }
        if (field.open_section) {
            html += '<p class="grw-field__hint"><button type="button" class="grw-style-customize-hint__link" data-grwi-open-section="' +
                escHtml(field.open_section) + '">' + escHtml(field.open_section_label || 'Open tab') + '</button></p>';
        }
        return html;
    }

    function disableLockedExploreControls($root) {
        if (editorIsPreviewFirst()) {
            return;
        }
        if (!$root || !$root.length) {
            return;
        }
        $root.find('input, textarea, select, button').each(function () {
            if ($(this).closest('summary').length) {
                return;
            }
            if ($(this).closest('.grw-customize-trial-card, .grw-upsell-card, .grw-layout-upgrade').length) {
                return;
            }
            if ($(this).closest('.grw-switch--premium-preview, .grw-segmented--premium-preview, .grw-select--premium-preview, .grw-typography-row--premium-preview').length) {
                return;
            }
            this.disabled = true;
            this.setAttribute('aria-disabled', 'true');
            var $selectWrap = $(this).closest('.grw-select');
            if ($selectWrap.length) {
                $selectWrap.addClass('grw-select--disabled');
            }
        });
    }

    function lockedFieldAttrs(field) {
        if (!field || !field.locked || fieldIsPremiumPreview(field)) {
            return '';
        }
        var extra = ' disabled aria-disabled="true" data-grwi-locked-field="1"';
        if (field.upgrade_feature) {
            extra += ' data-grwi-locked-switch="' + escHtml(field.upgrade_feature) + '"';
        }
        return extra;
    }

    function marginDirIconSvg(side) {
        if (side === 'top') {
            return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 12.5V4M5.25 6.75 8 4l2.75 2.75"/></svg>';
        }
        if (side === 'right') {
            return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8h8.5M9.25 5.25 12 8l-2.75 2.75"/></svg>';
        }
        if (side === 'bottom') {
            return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3.5v8.5M5.25 9.25 8 12l2.75-2.75"/></svg>';
        }
        return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.5 8H4M6.75 5.25 4 8l2.75 2.75"/></svg>';
    }

    function marginSideLabel(side) {
        if (side === 'top') return 'Top';
        if (side === 'right') return 'Right';
        if (side === 'bottom') return 'Bottom';
        if (side === 'center') return 'Horizontal';
        return 'Left';
    }

    function spacingAriaLabel(field, side) {
        var base = String((field && field.aria_base) || (field && field.label) || '').trim();
        var sideKey = String(side || '').toLowerCase();
        if (base) {
            return base + ' ' + sideKey;
        }
        return marginSideLabel(side);
    }

    function floatOffsetAxesForPosition(position) {
        position = String(position || 'bottom-left').toLowerCase();
        var primary = position.indexOf('top') === 0 ? 'top' : 'bottom';
        var secondary = 'center';
        if (position.indexOf('left') >= 0) secondary = 'left';
        else if (position.indexOf('right') >= 0) secondary = 'right';
        return { primary: primary, secondary: secondary };
    }

    function floatOffsetDirIcon(side) {
        if (side === 'center') {
            return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8h2M10.5 8h2M6.75 5.25 8 4l1.25 1.25M6.75 10.75 8 12l1.25-1.25"/></svg>';
        }
        return marginDirIconSvg(side);
    }

    function floatPositionLabel(anchor) {
        var labels = {
            'top-left': 'Top left',
            'top-center': 'Top center',
            'top-right': 'Top right',
            'bottom-left': 'Bottom left',
            'bottom-center': 'Bottom center',
            'bottom-right': 'Bottom right',
        };
        return labels[String(anchor || '').toLowerCase()] || anchor;
    }

    function widgetAlignLabel(align) {
        var labels = {
            left: 'Left',
            center: 'Centre',
            right: 'Right',
        };
        return labels[String(align || 'left').toLowerCase()] || align;
    }

    function widgetAlignIconSvg(align) {
        align = String(align || 'left').toLowerCase();
        if (align === 'center') {
            return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M4 4.5h8M3 8h10M5 11.5h6"/></svg>';
        }
        if (align === 'right') {
            return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M5 4.5h8M3 8h10M7 11.5h6"/></svg>';
        }
        return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M3 4.5h8M3 8h10M3 11.5h6"/></svg>';
    }

    function floatPositionIconSvg(anchor) {
        anchor = String(anchor || 'bottom-left').toLowerCase();
        if (anchor === 'top-left') {
            return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12V8h4M4 12l4.5-4.5"/></svg>';
        }
        if (anchor === 'top-center') {
            return marginDirIconSvg('top');
        }
        if (anchor === 'top-right') {
            return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 12V8H8M12 12 7.5 7.5"/></svg>';
        }
        if (anchor === 'bottom-left') {
            return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4v4h4M4 4l4.5 4.5"/></svg>';
        }
        if (anchor === 'bottom-center') {
            return marginDirIconSvg('bottom');
        }
        return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v4H8M12 4 7.5 8.5"/></svg>';
    }

    function dropShadowIconSvg() {
        return '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<rect x="4" y="4" width="12" height="12" rx="2.5"/>' +
            '<path d="M7 17.5c1.2-1.4 2.6-2.1 4.5-2.1s3.3.7 4.5 2.1" opacity="0.75"/>' +
            '</svg>';
    }

    var SEGMENTED_VISUAL_KEYS = {
        widget_display_mode: true,
        widget_width_mode: true,
        widget_align: true,
        google_logo_style: true,
        header_star_size_mode: true,
        card_star_size_mode: true,
        star_size_mode: true,
        ai_summary_star_size_mode: true,
    };

    var SEGMENTED_SELECT_KEYS = {
        font_source: true,
        ai_summary_style: true,
        ai_summary_star_size_mode: true,
        review_count_format: true,
        rating_display_mode: true,
    };

    function visualFieldUsesIconOnly(key) {
        return key === 'badge_logo_position' || key === 'badge_logo_align';
    }

    function fieldUsesSegmentedControl(field) {
        if (!field || !Array.isArray(field.options) || field.options.length < 2 || field.options.length > 4) {
            return false;
        }
        var key = String(field.key || '');
        if (field.type === 'radio') {
            return !/_review_image_filter$/.test(key);
        }
        if (field.type === 'visual') {
            return !!SEGMENTED_VISUAL_KEYS[key] || /_card_alignment$/.test(key);
        }
        if (field.type === 'select') {
            return !!SEGMENTED_SELECT_KEYS[key];
        }
        return false;
    }

    function editorIsPreviewFirst() {
        var editor = activeEditorRef || readEditor();
        if (!editor) {
            return false;
        }
        return !!(editor.premium_preview || editor.premiumPreview || editor.preview_first || editor.previewFirst || editor.view_as_plan || editor.viewAsPlan);
    }

    function fieldIsPremiumPreview(field) {
        if (!field) {
            return false;
        }
        if (field.premium_preview || field.premiumPreview) {
            return true;
        }
        if (!editorIsPreviewFirst()) {
            return false;
        }
        return !!(field.locked || field.upgrade_feature || field.min_plan || field.minPlan);
    }

    function segmentedSunIconSvg() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"/>' +
            '</svg>';
    }

    function segmentedMoonIconSvg() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"/>' +
            '</svg>';
    }

    function segmentedOptionIconHtml(key, opt) {
        var value = String((opt && opt.value) || '').toLowerCase();
        if (opt && opt.icon) {
            return '<span class="grw-segmented__icon" aria-hidden="true">' + opt.icon + '</span>';
        }
        if (key === 'theme' || key === 'flyout_theme') {
            if (value === 'light') {
                return '<span class="grw-segmented__icon" aria-hidden="true">' + segmentedSunIconSvg() + '</span>';
            }
            if (value === 'dark') {
                return '<span class="grw-segmented__icon" aria-hidden="true">' + segmentedMoonIconSvg() + '</span>';
            }
        }
        if (key === 'widget_align' || /_card_alignment$/.test(key)) {
            return '<span class="grw-segmented__icon" aria-hidden="true">' + widgetAlignIconSvg(opt && opt.value) + '</span>';
        }
        return '';
    }

    function renderSegmentedControl(key, groupLabel, options, selectedValue, controlOptions) {
        controlOptions = controlOptions || {};
        options = options || [];
        var cols = parseInt(controlOptions.columns, 10);
        if (isNaN(cols) || cols < 1) {
            cols = options.length || 2;
        }
        if (cols < 2) {
            cols = 2;
        }
        if (cols > 4) {
            cols = 4;
        }
        var premiumPreview = !!controlOptions.premiumPreview;
        var disabled = (!!controlOptions.disabled || !!controlOptions.locked) && !premiumPreview;
        var fieldId = controlOptions.id || ('grwi-field-' + String(key).replace(/[^a-z0-9_-]/gi, '-'));
        var omitLabel = !!controlOptions.omitLabel;
        var radioDisabledAttrs = disabled ? ' disabled aria-disabled="true"' : '';
        var classes = 'grw-segmented grw-segmented--cols-' + cols;
        if (disabled) {
            classes += ' grw-segmented--disabled';
        }
        if (premiumPreview) {
            classes += ' grw-segmented--premium-preview';
        }
        var html = '<div class="grw-segmented-field">';
        if (premiumPreview) {
            html += '<div class="grw-segmented-lock" title="' + escHtml(premiumPreviewLockLabel(controlOptions.minPlan)) + '">' +
                renderPlanBadge(controlOptions.minPlan === 'business' ? 'business' : (controlOptions.minPlan === 'agency' ? 'agency' : 'site'), { premiumPreview: true }) +
                renderEntitlementLock({ premiumPreview: true, plan: controlOptions.minPlan }) +
                '</div>';
        }
        html += '<fieldset class="' + classes + '" data-grwi-segmented="' + escHtml(key) + '"' +
            (disabled ? ' disabled' : '') + '>';
        html += '<legend class="grw-segmented__legend' + (omitLabel ? '' : ' grw-segmented__legend--visible') + '">' +
            escHtml(groupLabel || key) + '</legend>';
        html += '<div class="grw-segmented__track" style="--grw-segmented-cols: ' + cols + '">';
        options.forEach(function (opt) {
            var optValue = opt.value;
            var optId = fieldId + '-' + String(optValue).replace(/[^a-z0-9_-]/gi, '-');
            var selected = String(selectedValue) === String(optValue);
            var optLabel = opt.label || String(optValue);
            var iconHtml = typeof controlOptions.iconForOption === 'function'
                ? controlOptions.iconForOption(opt)
                : segmentedOptionIconHtml(key, opt);
            html += '<label class="grw-segmented__option' + (selected ? ' is-selected' : '') + '">' +
                '<input type="radio" class="grw-segmented__input" id="' + escHtml(optId) +
                '" name="grwi-' + escHtml(key) + '" value="' + escHtml(optValue) + '"' +
                (selected ? ' checked' : '') +
                radioDisabledAttrs +
                ' />' +
                '<span class="grw-segmented__face">' +
                iconHtml +
                '<span class="grw-segmented__text">' + escHtml(optLabel) + '</span>' +
                '</span></label>';
        });
        html += '</div></fieldset>';
        html += '<input type="hidden"' + (controlOptions.hiddenAttrs || '') + ' value="' + escHtml(selectedValue == null ? '' : selectedValue) + '" />';
        html += '</div>';
        return html;
    }

    function renderSegmentedControlForField(field, value, renderOptions) {
        renderOptions = renderOptions || {};
        var key = field.key;
        var id = field.id || ('grwi-field-' + key.replace(/[^a-z0-9_-]/gi, '-'));
        var premiumPreview = fieldIsPremiumPreview(field);
        var hiddenAttrs = ' data-config-key="' + escHtml(key) + '" id="' + escHtml(id) + '"';
        if (field.locked && !premiumPreview) {
            hiddenAttrs += lockedFieldAttrs(field);
        }
        var minPlan = field.min_plan || field.minPlan || field.plan || '';
        if (!minPlan && field.upgrade_feature) {
            minPlan = (field.upgrade_feature === 'review_photos' || field.upgrade_feature === 'json_ld' || field.upgrade_feature === 'ai_summary')
                ? 'business'
                : 'site';
        }
        return renderSegmentedControl(key, field.label || key, field.options || [], value, {
            id: id,
            omitLabel: !!renderOptions.omitLabel,
            locked: !!field.locked,
            disabled: !!field.locked,
            premiumPreview: premiumPreview,
            minPlan: minPlan,
            upgradeFeature: field.upgrade_feature,
            hiddenAttrs: hiddenAttrs,
            columns: field.options ? field.options.length : 2,
        });
    }

    function selectChevronSvg() {
        return '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true">' +
            '<path d="M5.25 7.75 10 12.5l4.75-4.75" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>' +
            '</svg>';
    }

    function renderSelectControlHtml(key, options, selectedValue, controlOptions) {
        controlOptions = controlOptions || {};
        options = options || [];
        var premiumPreview = !!controlOptions.premiumPreview;
        var disabled = (!!controlOptions.disabled || !!controlOptions.locked) && !premiumPreview;
        var fieldId = controlOptions.id || ('grwi-field-' + String(key).replace(/[^a-z0-9_-]/gi, '-'));
        var nativeClass = 'grw-select__native' + (controlOptions.nativeClass ? (' ' + controlOptions.nativeClass) : '');
        var extraAttrs = controlOptions.attrs || '';
        var describedBy = controlOptions.describedBy || '';
        var html = '<div class="grw-select__control">';
        html += '<select class="' + nativeClass + '"' + extraAttrs;
        if (describedBy) {
            html += ' aria-describedby="' + escHtml(describedBy) + '"';
        }
        if (disabled && extraAttrs.indexOf('disabled') < 0) {
            html += ' disabled aria-disabled="true"';
        }
        html += '>';
        if (controlOptions.includeEmpty) {
            var emptySelected = selectedValue == null || selectedValue === '' ? ' selected' : '';
            html += '<option value=""' + emptySelected + '>' + escHtml(controlOptions.emptyLabel || 'Auto') + '</option>';
        }
        options.forEach(function (opt) {
            var selected = String(selectedValue) === String(opt.value) ? ' selected' : '';
            html += '<option value="' + escHtml(opt.value) + '"' + selected + '>' + escHtml(opt.label) + '</option>';
        });
        html += '</select>';
        html += '<span class="grw-select__chevron" aria-hidden="true">' + selectChevronSvg() + '</span>';
        html += '</div>';
        return html;
    }

    function renderSelectField(key, label, options, selectedValue, controlOptions) {
        controlOptions = controlOptions || {};
        var premiumPreview = !!controlOptions.premiumPreview;
        var disabled = (!!controlOptions.disabled || !!controlOptions.locked) && !premiumPreview;
        var omitLabel = !!controlOptions.omitLabel;
        var fieldId = controlOptions.id || ('grwi-field-' + String(key).replace(/[^a-z0-9_-]/gi, '-'));
        var classes = 'grw-select';
        if (controlOptions.compact) {
            classes += ' grw-select--compact';
        }
        if (disabled) {
            classes += ' grw-select--disabled';
        }
        if (premiumPreview) {
            classes += ' grw-select--premium-preview';
        }
        var html = '<div class="' + classes + '" data-grwi-select="' + escHtml(key) + '">';
        if (!omitLabel && label) {
            html += '<label class="grw-select__label" for="' + escHtml(fieldId) + '">' + escHtml(label) + '</label>';
        }
        html += renderSelectControlHtml(key, options, selectedValue, {
            id: fieldId,
            attrs: controlOptions.attrs || '',
            disabled: disabled,
            locked: !!controlOptions.locked,
            premiumPreview: premiumPreview,
            describedBy: controlOptions.describedBy || '',
            includeEmpty: !!controlOptions.includeEmpty,
            emptyLabel: controlOptions.emptyLabel,
            nativeClass: controlOptions.nativeClass || '',
        });
        html += '</div>';
        return html;
    }

    function renderSelectFieldForField(field, value, renderOptions) {
        renderOptions = renderOptions || {};
        var key = field.key;
        var id = field.id || ('grwi-field-' + key.replace(/[^a-z0-9_-]/gi, '-'));
        var premiumPreview = fieldIsPremiumPreview(field);
        var attrs = ' data-config-key="' + escHtml(key) + '" id="' + escHtml(id) + '"';
        if (field.locked && !premiumPreview) {
            attrs += lockedFieldAttrs(field);
        }
        return renderSelectField(key, field.label || key, field.options || [], value, {
            id: id,
            omitLabel: !!renderOptions.omitLabel,
            locked: !!field.locked,
            disabled: !!field.locked,
            premiumPreview: premiumPreview,
            attrs: attrs,
        });
    }

    function switchMinPlan(field) {
        var minPlan = (field && (field.min_plan || field.minPlan || field.plan)) || '';
        if (!minPlan && field && field.upgrade_feature) {
            minPlan = (field.upgrade_feature === 'review_photos' || field.upgrade_feature === 'json_ld' || field.upgrade_feature === 'ai_summary')
                ? 'business'
                : 'site';
        }
        return minPlan;
    }

    function renderSwitchField(key, label, checked, controlOptions) {
        controlOptions = controlOptions || {};
        var premiumPreview = !!controlOptions.premiumPreview;
        var planLocked = (!!controlOptions.locked || !!controlOptions.disabled) && !premiumPreview;
        var fieldId = controlOptions.id || ('grwi-field-' + String(key).replace(/[^a-z0-9_-]/gi, '-'));
        var description = controlOptions.description || '';
        var descId = description ? (fieldId + '-desc') : '';
        var tooltip = controlOptions.tooltip || '';
        var upgradeFeature = controlOptions.upgradeFeature || '';
        var syncKeys = Array.isArray(controlOptions.syncKeys) ? controlOptions.syncKeys : [];
        var config = controlOptions.config || {};

        var classes = 'grw-switch';
        if (planLocked) {
            classes += ' grw-switch--locked grw-switch--disabled';
        }
        if (premiumPreview) {
            classes += ' grw-switch--premium-preview';
        }

        var inputAttrs = ' type="checkbox" class="grw-switch__input" role="switch"' +
            ' id="' + escHtml(fieldId) + '"' +
            ' aria-checked="' + (checked ? 'true' : 'false') + '"' +
            (controlOptions.inputAttrs || '');
        if (checked) {
            inputAttrs += ' checked';
        }
        if (planLocked) {
            inputAttrs += lockedFieldAttrs({
                locked: true,
                upgrade_feature: upgradeFeature,
            });
        }
        if (descId) {
            inputAttrs += ' aria-describedby="' + escHtml(descId) + '"';
        }
        if (syncKeys.length) {
            inputAttrs += ' data-grwi-sync-keys="' + escHtml(JSON.stringify(syncKeys)) + '"';
        }

        var labelAttrs = ' class="' + classes + '" for="' + escHtml(fieldId) + '"';
        if (planLocked && upgradeFeature) {
            labelAttrs += ' data-grwi-locked-switch="' + escHtml(upgradeFeature) + '"';
        }
        if (tooltip) {
            labelAttrs += ' title="' + escHtml(tooltip) + '"';
        }

        var html = '<div class="grw-field grw-field--switch" data-grwi-field="' + escHtml(key) + '">';
        html += '<label' + labelAttrs + '>';
        html += '<span class="grw-switch__copy">';
        html += '<span class="grw-switch__label">' + escHtml(label || key) + '</span>';
        if (description) {
            html += '<span class="grw-switch__desc" id="' + escHtml(descId) + '">' + escHtml(description) + '</span>';
        }
        html += '</span>';
        html += '<input' + inputAttrs + ' />';
        html += '<span class="grw-switch__track" aria-hidden="true"><span class="grw-switch__knob"></span></span>';
        html += '</label>';
        syncKeys.forEach(function (syncKey) {
            html += '<input type="hidden" data-config-key="' + escHtml(syncKey) +
                '" data-grwi-sync-target="1" value="' + (configFlagTruthy(config, syncKey) ? '1' : '0') + '" />';
        });
        if (controlOptions.dependentsHtml) {
            html += '<div class="grw-switch__dependents">' + controlOptions.dependentsHtml + '</div>';
        }
        html += '</div>';
        return html;
    }

    function renderSwitchFieldForField(field, config, layout, options) {
        options = options || {};
        var key = field.key;
        var value = config[key];
        var id = field.id || ('grwi-field-' + key.replace(/[^a-z0-9_-]/gi, '-'));
        var checked = Object.prototype.hasOwnProperty.call(options, 'checked')
            ? !!options.checked
            : (value === true || value === 1 || value === '1');
        if (key === 'widget_shadow_enabled' && (value === undefined || value === null || value === '')) {
            checked = true;
        }
        if (key === 'enable_json_ld' && (value === undefined || value === null || value === '')
            && !Object.prototype.hasOwnProperty.call(options, 'checked')) {
            var catalogSource = (window.grwiCustomize && window.grwiCustomize.previewFirstCatalog)
                || (typeof editor !== 'undefined' && editor && editor.preview_first_catalog)
                || {};
            var draftDefaults = catalogSource.new_draft_feature_defaults || {};
            checked = !!draftDefaults.enable_json_ld;
        }
        if ((key === 'show_review_photos' || /_show_review_photos$/.test(key))
            && (value === undefined || value === null || value === '')
            && !Object.prototype.hasOwnProperty.call(options, 'checked')) {
            var photoCatalog = (window.grwiCustomize && window.grwiCustomize.previewFirstCatalog)
                || (typeof editor !== 'undefined' && editor && editor.preview_first_catalog)
                || {};
            var photoDefaults = photoCatalog.new_draft_feature_defaults || {};
            if (Object.prototype.hasOwnProperty.call(photoDefaults, key)) {
                checked = !!photoDefaults[key];
            }
        }
        if (key === 'hide_branding' && (value === undefined || value === null || value === '')
            && !Object.prototype.hasOwnProperty.call(options, 'checked')) {
            checked = true;
        }
        var premiumPreview = fieldIsPremiumPreview(field);
        if (field.locked && !premiumPreview && !Object.prototype.hasOwnProperty.call(options, 'checked')) {
            checked = false;
        }
        return renderSwitchField(key, field.label || key, checked, {
            id: id,
            description: (field.hint && !options.omitHint) ? field.hint : '',
            locked: !!field.locked,
            disabled: !!field.locked,
            premiumPreview: premiumPreview,
            minPlan: switchMinPlan(field),
            upgradeFeature: field.upgrade_feature || '',
            tooltip: field.tooltip || options.tooltip || '',
            syncKeys: Array.isArray(field.sync_keys) ? field.sync_keys : [],
            config: config,
            inputAttrs: ' data-config-key="' + escHtml(key) + '"',
            dependentsHtml: options.dependentsHtml || '',
        });
    }

    function visualOptionUsesPictogram(preview) {
        preview = String(preview || '');
        return preview.indexOf('logo-') === 0 ||
            preview === 'google-icon' ||
            preview === 'google-full';
    }

    function visualOptionPreviewHtml(key, opt) {
        var preview = opt.preview || '';
        if (visualOptionUsesPictogram(preview)) {
            return '<span class="grw-visual-option__pictogram grw-visual-option__pictogram--' + escHtml(preview) + '" aria-hidden="true"></span>';
        }
        if (key === 'widget_align') {
            return '<span class="grw-visual-option__icon" aria-hidden="true">' + widgetAlignIconSvg(opt.value) + '</span>';
        }
        if (key === 'badge_logo_align') {
            return '<span class="grw-visual-option__icon" aria-hidden="true">' + widgetAlignIconSvg(opt.value) + '</span>';
        }
        return '';
    }

    function syncFloatOffsetAxisIcons(position) {
        var axes = floatOffsetAxesForPosition(position || 'bottom-left');
        var sides = [axes.primary, axes.secondary];
        var $card = $('.grw-card--float-offsets');
        if (!$card.length) {
            return;
        }
        $card.find('.grw-float-offsets__axis').each(function (index) {
            var side = sides[index] || 'bottom';
            var label = marginSideLabel(side);
            $(this).find('.grw-float-offsets__dir').attr('title', label).html(floatOffsetDirIcon(side));
            $(this).find('.grw-float-offsets__input').attr('aria-label', label + ' offset');
        });
    }

    function parseVisibilityValue(config, key, fallback) {
        if (!Object.prototype.hasOwnProperty.call(config, key)) {
            return fallback;
        }
        var raw = config[key];
        if (raw === true || raw === 1 || raw === '1') return true;
        if (raw === false || raw === 0 || raw === '0') return false;
        return fallback;
    }

    function parseMarginValue(config, key, fallback) {
        var raw = config[key];
        var num = parseInt(raw, 10);
        return isNaN(num) ? (fallback || 0) : num;
    }

    function renderOuterSpacingInner(field, config) {
        var sides = field.sides || {
            top: 'widget_margin_top',
            right: 'widget_margin_right',
            bottom: 'widget_margin_bottom',
            left: 'widget_margin_left',
        };
        var min = field.min != null ? field.min : 0;
        var max = field.max != null ? field.max : 200;
        var linkId = field.link_id || 'grwi-widget-margin-link';
        var sidePrefix = field.side_id_prefix || 'grwi-widget-margin';
        var values = {
            top: parseMarginValue(config, sides.top, 0),
            right: parseMarginValue(config, sides.right, 0),
            bottom: parseMarginValue(config, sides.bottom, 0),
            left: parseMarginValue(config, sides.left, 0),
        };
        var linked = values.top === values.right && values.right === values.bottom && values.bottom === values.left;
        var sampleKey = String(sides.top || '');
        var compact = /_margin_/.test(sampleKey);
        var heading = field.label || (compact ? 'Margin' : 'Spacing');
        var html = '';
        if (field.hint) {
            html += '<p class="grw-field__hint grw-field__hint--card">' + escHtml(field.hint) + '</p>';
        }
        var lockedAttrs = lockedFieldAttrs(field);
        html += '<div class="grw-outer-spacing' + (compact ? ' grw-outer-spacing--compact' : '') + '" role="group" aria-labelledby="' + escHtml(linkId) + '-label">';
        if (compact) {
            html += '<div class="grw-outer-spacing__head">' +
                '<div class="grw-outer-spacing__head-copy">' +
                '<span class="grw-outer-spacing__title" id="' + escHtml(linkId) + '-label">' + escHtml(heading) + '</span>' +
                '<span class="grw-outer-spacing__unit">px</span>' +
                '</div>';
        } else {
            html += '<span class="screen-reader-text" id="' + escHtml(linkId) + '-label">' + escHtml(heading) + '</span>';
        }
        html += '<button type="button" class="grw-outer-spacing__link" id="' + escHtml(linkId) + '" aria-pressed="' + (linked ? 'true' : 'false') + '" ' +
            'aria-label="' + escHtml(linked ? 'Unlink sides — edit each side separately' : 'Link all sides — use one value for all') + '" ' +
            'title="' + escHtml(linked ? 'Unlink sides' : 'Link all sides') + '"' +
            lockedAttrs + '>' +
            '<svg class="grw-outer-spacing__link-icon grw-outer-spacing__link-icon--linked" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">' +
            '<path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"/>' +
            '</svg>' +
            '<svg class="grw-outer-spacing__link-icon grw-outer-spacing__link-icon--unlinked" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">' +
            '<path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244M4.5 4.5l15 15"/>' +
            '</svg>' +
            '<span class="grw-outer-spacing__link-text" aria-hidden="true"></span>' +
            '</button>';
        if (compact) {
            html += '</div>';
        }
        html += '<div class="grw-outer-spacing__sides">';
        ['top', 'right', 'bottom', 'left'].forEach(function (side) {
            var configKey = sides[side];
            var inputId = sidePrefix + '-' + side;
            html += '<div class="grw-outer-spacing__side">';
            if (compact) {
                html += '<label class="grw-outer-spacing__side-label" for="' + escHtml(inputId) + '">' + escHtml(marginSideLabel(side)) + '</label>';
            } else {
                html += '<span class="grw-outer-spacing__dir" title="' + escHtml(marginSideLabel(side)) + '" aria-hidden="true">' +
                    marginDirIconSvg(side) +
                    '</span>';
            }
            html += '<input type="number" class="grw-input grw-outer-spacing__input" id="' + escHtml(inputId) + '" ' +
                'data-config-key="' + escHtml(configKey) + '" value="' + escHtml(values[side]) + '" ' +
                'min="' + escHtml(min) + '" max="' + escHtml(max) + '" step="1" inputmode="numeric" ' +
                'aria-label="' + escHtml(spacingAriaLabel(field, side)) + '"' + lockedAttrs + ' />' +
                '</div>';
        });
        html += '</div></div>';
        return html;
    }

    function renderOuterSpacingCard(field, config) {
        var sampleKey = String((field.sides && field.sides.top) || 'widget_margin_top');
        if (/_margin_/.test(sampleKey)) {
            return '<div class="grw-field grw-field--outer-spacing" data-grwi-group="' + escHtml(field.group || 'outer_spacing') + '">' +
                renderOuterSpacingInner(field, config) +
                '</div>';
        }
        return '<div class="grw-card grw-card--outer-spacing" data-grwi-group="' + escHtml(field.group || 'outer_spacing') + '">' +
            '<div class="grw-card__body">' +
            renderOuterSpacingInner(field, config) +
            '</div></div>';
    }

    function floatOffsetAxisLabel(axis) {
        return axis;
    }

    function renderFloatOffsetsInner(field, config) {
        var position = config.widget_float_position || 'bottom-left';
        var axes = floatOffsetAxesForPosition(position);
        var axisOrder = [
            { axis: axes.primary, configKey: 'widget_float_offset_y' },
            { axis: axes.secondary, configKey: 'widget_float_offset_x' },
        ];
        var min = field.min != null ? field.min : 0;
        var max = field.max != null ? field.max : 200;
        var fallback = field.default != null ? field.default : 20;
        var html = '';
        if (field.hint) {
            html += '<p class="grw-field__hint grw-field__hint--card">' + escHtml(field.hint) + '</p>';
        }
        html += '<div class="grw-float-offsets" role="group" aria-labelledby="grwi-float-offsets-label">' +
            '<span class="screen-reader-text" id="grwi-float-offsets-label">' + escHtml(field.label || 'Offset from edge') + '</span>' +
            '<div class="grw-float-offsets__axes">';
        axisOrder.forEach(function (entry, index) {
            var side = entry.axis;
            var configKey = entry.configKey;
            var inputId = 'grwi-float-offset-' + index;
            var label = marginSideLabel(side);
            html += '<div class="grw-float-offsets__axis">' +
                '<span class="grw-float-offsets__dir" title="' + escHtml(label) + '" aria-hidden="true">' +
                floatOffsetDirIcon(side) +
                '</span>' +
                '<input type="number" class="grw-input grw-float-offsets__input" id="' + escHtml(inputId) + '" ' +
                'data-config-key="' + escHtml(configKey) + '" value="' + escHtml(parseMarginValue(config, configKey, fallback)) + '" ' +
                'min="' + escHtml(min) + '" max="' + escHtml(max) + '" step="1" inputmode="numeric" ' +
                'aria-label="' + escHtml(label) + ' offset" />' +
                '</div>';
        });
        html += '</div></div>';
        return html;
    }

    function renderFloatOffsetsCard(field, config) {
        return '<div class="grw-card grw-card--float-offsets" data-grwi-group="' + escHtml(field.group || 'float_offsets') + '">' +
            '<div class="grw-card__body">' +
            renderCardHeading(field.label || 'Offset from edge') +
            renderFloatOffsetsInner(field, config) +
            '</div></div>';
    }

    function deviceVisibilityIconSvg(device) {
        if (device === 'mobile') {
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">' +
                '<rect x="7.5" y="2.75" width="9" height="18.5" rx="2.25" stroke-linecap="round" stroke-linejoin="round"/>' +
                '<path stroke-linecap="round" d="M11.25 18.75h1.5"/>' +
                '</svg>';
        }
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">' +
            '<rect x="3" y="4.5" width="18" height="11.5" rx="1.75" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<path stroke-linecap="round" stroke-linejoin="round" d="M8 19.5h8M12 16v3.5"/>' +
            '</svg>';
    }

    function renderDeviceVisibilityInner(field, config) {
        var keys = field.keys || {
            desktop: 'widget_visible_desktop',
            mobile: 'widget_visible_mobile',
        };
        var visibleDesktop = parseVisibilityValue(config, keys.desktop, true);
        var visibleMobile = parseVisibilityValue(config, keys.mobile, true);
        if (!Object.prototype.hasOwnProperty.call(config, keys.mobile) && Object.prototype.hasOwnProperty.call(config, 'widget_float_hide_mobile')) {
            visibleMobile = !parseVisibilityValue(config, 'widget_float_hide_mobile', false);
        }
        var html = '';
        if (field.hint) {
            html += '<p class="grw-field__hint grw-field__hint--card">' + escHtml(field.hint) + '</p>';
        }
        html += '<div class="grw-device-visibility" role="group" aria-labelledby="grwi-device-visibility-label">' +
            '<span class="screen-reader-text" id="grwi-device-visibility-label">' + escHtml(field.label || 'Visibility') + '</span>' +
            '<button type="button" class="grw-device-visibility__btn' + (visibleDesktop ? ' is-active' : '') + '" data-visibility-key="' + escHtml(keys.desktop) + '" aria-pressed="' + (visibleDesktop ? 'true' : 'false') + '" title="Desktop — ' + (visibleDesktop ? 'visible' : 'hidden') + '">' +
            '<span class="grw-device-visibility__icon">' + deviceVisibilityIconSvg('desktop') + '</span>' +
            '<span class="grw-device-visibility__label">Desktop</span></button>' +
            '<button type="button" class="grw-device-visibility__btn' + (visibleMobile ? ' is-active' : '') + '" data-visibility-key="' + escHtml(keys.mobile) + '" aria-pressed="' + (visibleMobile ? 'true' : 'false') + '" title="Mobile — ' + (visibleMobile ? 'visible' : 'hidden') + '">' +
            '<span class="grw-device-visibility__icon">' + deviceVisibilityIconSvg('mobile') + '</span>' +
            '<span class="grw-device-visibility__label">Mobile</span></button>' +
            '<input type="hidden" data-config-key="' + escHtml(keys.desktop) + '" value="' + (visibleDesktop ? '1' : '0') + '" />' +
            '<input type="hidden" data-config-key="' + escHtml(keys.mobile) + '" value="' + (visibleMobile ? '1' : '0') + '" />' +
            '</div>';
        return html;
    }

    function renderDeviceVisibilityCard(field, config) {
        return '<div class="grw-card grw-card--device-visibility" data-grwi-group="' + escHtml(field.group || 'device_visibility') + '">' +
            '<div class="grw-card__body">' +
            renderCardHeading(field.label || 'Visibility') +
            renderDeviceVisibilityInner(field, config) +
            '</div></div>';
    }

    function renderReviewLimitControl(field, value, options) {
        options = options || {};
        var key = field.key || 'max_reviews';
        var id = field.id || ('grwi-field-' + key.replace(/[^a-z0-9_-]/gi, '-'));
        var unlimited = !!field.unlimited;
        var planMax = field.plan_max != null ? parseInt(field.plan_max, 10) : null;
        var previewMax = field.preview_max != null ? parseInt(field.preview_max, 10) : null;
        var customMax = unlimited ? null : ((previewMax && !isNaN(previewMax)) ? previewMax : planMax);
        var planLocked = !!field.locked && !fieldIsPremiumPreview(field);
        var min = field.min != null ? parseInt(field.min, 10) : 1;
        if (isNaN(min) || min < 1) {
            min = 1;
        }
        var parsed = parseInt(value, 10);
        var current = isNaN(parsed) ? (unlimited ? min : (planMax || min)) : parsed;
        if (current < min) {
            current = min;
        }
        if (!unlimited && customMax != null && current > customMax) {
            current = customMax;
        }
        var overLimit = !unlimited && planMax != null && parsed > planMax && !(previewMax && parsed <= previewMax);
        if (overLimit) {
            current = parsed;
        }
        var html = '';
        if (overLimit) {
            html += '<p class="grw-field__warn">The saved display limit (' + escHtml(parsed) +
                ') is above the reviews available to this widget' +
                (planMax != null ? ' (' + escHtml(planMax) + ')' : '') +
                '. Choose a number up to your plan limit.</p>';
        }
        var modeKey = field.mode_key || 'max_reviews_mode';
        var editorConfig = (options && options.config) || ((readEditor() || {}).config) || {};
        var savedMode = String(editorConfig[modeKey] != null ? editorConfig[modeKey] : '');
        var mode;
        if (savedMode === 'custom' || savedMode === 'max') {
            mode = savedMode;
        } else if (!overLimit && (unlimited || (planMax != null && current >= planMax))) {
            mode = 'max';
        } else {
            mode = 'custom';
        }
        if (overLimit) {
            mode = 'custom';
        }
        var customVal = mode === 'custom' ? current : Math.max(min, (planMax != null && planMax > min ? planMax - 1 : min));
        if (isNaN(customVal) || customVal < min) {
            customVal = min;
        }
        html += '<div class="grw-review-limit" data-grwi-review-limit="' + escHtml(key) + '" data-grwi-review-limit-plan-max="' +
            (unlimited ? '' : escHtml(planMax || '')) + '" data-grwi-review-limit-preview-max="' +
            (unlimited || customMax == null ? '' : escHtml(customMax)) + '" data-grwi-review-limit-unlimited="' + (unlimited ? '1' : '0') + '">';
        html += renderSegmentedControl(modeKey, 'Display limit', [
            { value: 'max', label: 'Max' },
            { value: 'custom', label: 'Custom' },
        ], mode, {
            id: id + '-mode',
            omitLabel: true,
            locked: planLocked,
            disabled: planLocked,
            premiumPreview: fieldIsPremiumPreview(field),
            hiddenAttrs: ' data-config-key="' + escHtml(modeKey) + '" data-grwi-review-limit-mode-value="' +
                escHtml(key) + '"',
        });
        html += '<div class="grw-review-limit-custom"' + (mode === 'custom' ? '' : ' hidden') + '>';
        html += '<label class="grw-field__label" for="' + escHtml(id) + '-custom">Reviews to display</label>';
        html += '<input type="number" class="grw-input" data-grwi-review-limit-custom="' + escHtml(key) + '" id="' +
            escHtml(id) + '-custom" min="' + escHtml(min) + '"' +
            (unlimited || customMax == null ? '' : ' max="' + escHtml(customMax) + '"') +
            ' value="' + escHtml(customVal) + '" step="1" inputmode="numeric"' +
            (planLocked ? ' disabled aria-disabled="true"' : '') + ' />';
        html += '</div>';
        html += '<input type="hidden" data-config-key="' + escHtml(key) + '" id="' + escHtml(id) + '" value="' +
            escHtml(mode === 'max' && planMax != null ? planMax : current) + '"' + lockedFieldAttrs(field) + ' />';
        html += '</div>';
        return html;
    }

    function canonicalReviewSortField(value, order, allowPhotos) {
        var v = String(value || '').toLowerCase();
        if (v === 'newest' || v === 'oldest') return 'date';
        if (v === 'highest_rated' || v === 'highest' || v === 'lowest_rated' || v === 'lowest') return 'rating';
        if (v === 'photos_first' || v === 'photos_last' || v === 'photos') return allowPhotos === false ? 'date' : 'photos';
        if (v === 'date' || v === 'rating' || v === 'photos' || v === 'manual') {
            if (v === 'photos' && allowPhotos === false) return 'date';
            return v;
        }
        if (Array.isArray(order) && order.length) return 'manual';
        return 'date';
    }

    function canonicalReviewSortDir(field, sort, dir) {
        var v = String(dir || '').toLowerCase();
        var legacy = String(sort || '').toLowerCase();
        if (legacy === 'newest' || legacy === 'oldest') v = legacy;
        if (legacy === 'highest_rated' || legacy === 'highest') v = 'highest';
        if (legacy === 'lowest_rated' || legacy === 'lowest') v = 'lowest';
        if (legacy === 'photos_first' || legacy === 'photos_last') v = legacy;
        var defaults = { date: 'newest', rating: 'highest', photos: 'photos_first' };
        if (field === 'date' && (v === 'newest' || v === 'oldest')) return v;
        if (field === 'rating' && (v === 'highest' || v === 'lowest')) return v;
        if (field === 'photos' && (v === 'photos_first' || v === 'photos_last')) return v;
        return defaults[field] || 'newest';
    }

    function reviewSortAllowsPhotos(field) {
        var options = field && field.options ? field.options : [];
        return options.some(function (opt) { return String(opt.value) === 'photos'; });
    }

    function renderField(field, config, layout, options) {
        options = options || {};
        if (!fieldVisible(field, config, layout)) {
            return '';
        }

        if (isCompositeFieldType(field.type)) {
            return '';
        }

        if (field.type === 'checkbox') {
            return renderSwitchFieldForField(field, config, layout, options);
        }

        var key = field.key;
        var value = config[key];
        if (key === 'widget_width_mode') {
            value = normalizeBuilderWidgetWidthMode(value, layout);
            if (layoutUsesFixedWidth(layout)) {
                return '<div class="grw-field" data-grwi-field="' + escHtml(key) + '">' +
                    renderStaticHintField({
                        key: key,
                        label: 'Fixed width',
                        persist_value: 'auto'
                    }) +
                    '</div>';
            }
            if (isFeedLayoutKey(layout)) {
                field = $.extend({}, field, {
                    options: (field.options || []).filter(function (opt) {
                        return String(opt.value) !== 'auto';
                    })
                });
            }
        }
        if (key === 'review_sort') {
            value = canonicalReviewSortField(config.review_sort, config.review_order, reviewSortAllowsPhotos(field));
        }
        if (key === 'review_sort_dir') {
            var sortField = canonicalReviewSortField(config.review_sort, config.review_order, !!(field.options_by_sort && field.options_by_sort.photos));
            var bySort = field.options_by_sort || {};
            if (bySort[sortField]) {
                field = Object.assign({}, field, { options: bySort[sortField] });
            }
            value = canonicalReviewSortDir(sortField, config.review_sort, config.review_sort_dir);
        }
        var id = field.id || ('grwi-field-' + key.replace(/[^a-z0-9_-]/gi, '-'));
        var attrs = ' data-config-key="' + escHtml(key) + '" id="' + escHtml(id) + '"' + lockedFieldAttrs(field);
        var html = '<div class="grw-field" data-grwi-field="' + escHtml(key) + '">';

        if (!options.omitLabel && !fieldUsesSegmentedControl(field) && field.type !== 'select' && field.type !== 'review_limit') {
            html += '<label class="grw-field__label" for="' + escHtml(id) + '">' + escHtml(field.label || key) + '</label>';
        }
        if (options.srLabel) {
            html += '<label class="screen-reader-text" for="' + escHtml(id) + '">' + escHtml(options.srLabel) + '</label>';
        }

        if (field.type === 'select') {
            if (fieldUsesSegmentedControl(field)) {
                html += renderSegmentedControlForField(field, value, options);
            } else {
                html += renderSelectFieldForField(field, value, options);
            }
        } else if (field.type === 'radio') {
            if (fieldUsesSegmentedControl(field)) {
                html += renderSegmentedControlForField(field, value, options);
            } else {
            html += '<div class="grw-segment" role="group">';
            (field.options || []).forEach(function (opt) {
                var selected = String(value) === String(opt.value);
                html += '<label><input type="radio" name="grwi-' + escHtml(key) + '" value="' + escHtml(opt.value) + '"' +
                        (selected ? ' checked' : '') +
                        (field.locked && !fieldIsPremiumPreview(field) ? ' disabled aria-disabled="true"' : '') +
                        '> ' + escHtml(opt.label) + '</label>';
            });
            html += '<input type="hidden"' + attrs + ' value="' + escHtml(value || '') + '" />';
            html += '</div>';
            }
        } else if (field.type === 'range') {
            var min = field.min != null ? field.min : 0;
            var max = field.max != null ? field.max : 100;
            var num = parseInt(value, 10);
            if (isNaN(num)) {
                num = min;
            }
            num = Math.max(min, Math.min(max, num));
            html += '<input type="range" class="grw-range"' + attrs + ' min="' + escHtml(min) + '" max="' + escHtml(max) + '" value="' + escHtml(num) + '" />' +
                '<output class="grw-range-value" for="' + escHtml(id) + '">' + escHtml(num) + 'px</output>';
        } else if (field.type === 'number') {
            html += '<input type="number" class="grw-input"' + attrs + ' value="' + escHtml(value == null ? '' : value) + '"' +
                (field.min != null ? ' min="' + escHtml(field.min) + '"' : '') +
                (field.max != null ? ' max="' + escHtml(field.max) + '"' : '') + ' />';
        } else if (field.type === 'review_limit') {
            html += renderReviewLimitControl(field, value, $.extend({}, options, { config: config }));
        } else if (field.type === 'review_limit_mode') {
            return '';
        } else if (field.type === 'color') {
            // Native <input type="color"> cannot hold an empty value — real browsers
            // silently coerce "" to #000000, which breaks "allow empty" (inherit/theme
            // default) fields. So the swatch is a plain visual control (no
            // data-config-key) and the real, possibly-empty string value lives in a
            // paired hidden input that collectConfigFromForm() actually reads.
            var editor = readEditor();
            var isUnset = value === '' || value == null;
            var allowEmpty = !!field.allow_empty;
            var colorVal = colorSwatchValueForField(key, value, editor, field);
            var isMulticolour = colorVal === 'multicolour';
            html += '<span class="grw-color-field' + (allowEmpty && isUnset && !isMulticolour ? ' is-unset' : '') + (isMulticolour ? ' is-multicolour' : '') + '" data-grwi-color-field="' + escHtml(key) + '">';
            if (allowEmpty) {
                html += '<button type="button" class="grw-btn-icon grw-color-reset" data-reset-key="' + escHtml(key) + '" aria-label="Reset to default" title="Reset to default">' +
                    colorResetIconSvg() + '</button>';
            }
            html += '<input type="text" class="grw-color-hex" value="' + escHtml(isUnset || isMulticolour ? '' : String(value).toUpperCase()) + '"' +
                ' maxlength="9" spellcheck="false" aria-label="' + escHtml((field.label || key) + ' hex colour') + '" placeholder="#RRGGBB" />';
            html += '<input type="color" class="grw-color-input" id="' + escHtml(id) + '" value="' + escHtml(isMulticolour ? '#ffffff' : colorVal) + '"' +
                (allowEmpty ? ' data-allow-empty="1"' : '') +
                (field.empty_means_multicolour ? ' data-empty-means-multicolour="1"' : '') + ' />';
            html += '<input type="hidden" data-config-key="' + escHtml(key) + '" value="' + escHtml(isUnset ? '' : String(value)) + '" />' +
                '</span>';
        } else if (field.type === 'textarea') {
            var textareaClass = 'grw-input grw-textarea' + (options.textareaClass ? (' ' + options.textareaClass) : '');
            var rows = options.rows != null ? options.rows : 6;
            html += '<textarea class="' + textareaClass + '"' + attrs + ' rows="' + escHtml(rows) + '"';
            if (options.placeholder || field.placeholder) {
                html += ' placeholder="' + escHtml(options.placeholder || field.placeholder) + '"';
            }
            if (options.ariaLabel || field.aria_label) {
                html += ' aria-label="' + escHtml(options.ariaLabel || field.aria_label) + '"';
            }
            html += '>' + escHtml(value || '') + '</textarea>';
        } else if (field.type === 'width_custom') {
            html += renderWidthCustomField(field, value, { inputAttrs: attrs });
        } else if (field.type === 'visual' && fieldUsesSegmentedControl(field)) {
            html += renderSegmentedControlForField(field, value, options);
        } else if (field.type === 'visual') {
            var iconOnly = visualFieldUsesIconOnly(key);
            var gridClass = iconOnly ? ' grw-visual-options--icon-only' : '';
            if (iconOnly && key === 'badge_logo_position') {
                gridClass += ' grw-visual-options--grid-2';
            }
            if (iconOnly && key === 'badge_logo_align') {
                gridClass += ' grw-visual-options--grid-3';
            }
            html += '<div class="grw-visual-options' + gridClass + '"' +
                (iconOnly ? ' role="radiogroup" aria-label="' + escHtml(field.label || key) + '"' : '') + '>';
            (field.options || []).forEach(function (opt) {
                var selected = String(value) === String(opt.value);
                var optionLabel = iconOnly ? (opt.label || opt.value) : (opt.label || opt.value);
                var previewHtml = iconOnly ? visualOptionPreviewHtml(key, opt) : '';
                var lockedBtn = field.locked && !fieldIsPremiumPreview(field) ? ' disabled aria-disabled="true"' : '';
                if (iconOnly) {
                    html += '<button type="button" class="grw-visual-option' + (selected ? ' is-selected' : '') + '" data-visual-key="' + escHtml(key) + '" data-visual-value="' + escHtml(opt.value) + '" aria-label="' + escHtml(optionLabel) + '" title="' + escHtml(optionLabel) + '"' + lockedBtn + '>' +
                        previewHtml +
                        '</button>';
                } else {
                    html += '<button type="button" class="grw-visual-option' + (selected ? ' is-selected' : '') + '" data-visual-key="' + escHtml(key) + '" data-visual-value="' + escHtml(opt.value) + '"' + lockedBtn + '>' +
                        '<span class="grw-visual-option__label">' + escHtml(opt.label) + '</span>' +
                        (opt.hint ? '<span class="grw-visual-option__hint">' + escHtml(opt.hint) + '</span>' : '') +
                        '</button>';
                }
            });
            html += '<input type="hidden"' + attrs + ' value="' + escHtml(value || '') + '" />';
            html += '</div>';
        } else if (field.type === 'float_position') {
            html += '<div class="grw-float-grid" role="radiogroup" aria-label="' + escHtml(field.label || 'Screen position') + '">';
            FLOAT_POSITIONS.forEach(function (anchor) {
                var selected = String(value || 'bottom-left') === anchor;
                var label = floatPositionLabel(anchor);
                html += '<button type="button" class="grw-float-chip' + (selected ? ' is-selected' : '') + '" data-float-key="' + escHtml(key) + '" data-float-value="' + escHtml(anchor) + '" aria-label="' + escHtml(label) + '" title="' + escHtml(label) + '"' +
                    (field.locked && !fieldIsPremiumPreview(field) ? ' disabled aria-disabled="true"' : '') + '>' +
                    '<span class="grw-float-chip__icon" aria-hidden="true">' + floatPositionIconSvg(anchor) + '</span>' +
                    '</button>';
            });
            html += '<input type="hidden"' + attrs + ' value="' + escHtml(value || 'bottom-left') + '" />';
            html += '</div>';
        } else {
            html += '<input type="text" class="grw-input"' + attrs + ' value="' + escHtml(value || '') + '"' +
                (field.maxlength != null ? ' maxlength="' + escHtml(field.maxlength) + '"' : '') +
                (field.placeholder ? ' placeholder="' + escHtml(field.placeholder) + '"' : '') + ' />';
        }

        if (field.hint && !options.omitHint) {
            html += '<p class="grw-field__hint">' + escHtml(field.hint) + '</p>';
        }
        html += '</div>';
        return html;
    }

    function renderColorsInner(colors, config, layout) {
        var groups = (readEditor().builder && readEditor().builder.color_groups) || [
            { id: 'header_colours', title: 'Header' },
            { id: 'widget_colours', title: 'Widget' },
            { id: 'review_card_colours', title: 'Review cards' },
        ];
        var html = '';
        groups.forEach(function (group) {
            var groupHtml = '';
            (colors || []).forEach(function (colorField) {
                if ((colorField.color_group || 'widget_colours') !== group.id) {
                    return;
                }
                if (colorField.layouts && colorField.layouts.indexOf(layout) < 0) {
                    return;
                }
                var colorMeta = {
                    key: colorField.key,
                    type: colorField.type || 'color',
                    label: colorField.label,
                    allow_empty: colorField.allow_empty,
                    empty_means_multicolour: colorField.empty_means_multicolour,
                    theme_aware: colorField.theme_aware,
                    options: colorField.options,
                    preview_visible: colorField.preview_visible,
                    visibility_element: colorField.visibility_element,
                    layouts: colorField.layouts,
                    section: 'style',
                };
                if (!fieldVisible(colorMeta, config, layout)) {
                    return;
                }
                groupHtml += renderField(colorMeta, config, layout);
            });
            if (!groupHtml) {
                return;
            }
            if (group.title) {
                html += '<div class="grw-colour-section" data-grwi-colour-section="' + escHtml(group.id) + '">';
                html += '<p class="grw-colour-section__title">' + escHtml(group.title) + '</p>';
                html += '<div class="grw-color-grid">' + groupHtml + '</div></div>';
            } else {
                html += '<div class="grw-color-grid" data-grwi-colour-section="' + escHtml(group.id) + '">' + groupHtml + '</div>';
            }
        });
        return html;
    }

    function renderColors(colors, config, layout) {
        var inner = renderColorsInner(colors, config, layout);
        if (!inner) {
            return '';
        }
        return '<div class="grw-card" data-grwi-group="colours"><div class="grw-card__body">' + renderCardHeading('Colours') + inner + '</div></div>';
    }

    function renderTypographyRolesInner(typography, config, layout) {
        var editor = readEditor();
        var html = '';
        (typography.roles || []).forEach(function (role) {
            if (role.role === 'button' || role.role === 'link') {
                return;
            }
            if (role.layouts && role.layouts.length && role.layouts.indexOf(layout) < 0) {
                return;
            }
            if (!typographyElementVisibleInConfig(role.role, config, layout, typography, editor)) {
                return;
            }
            html += renderTypographyRoleRow(role, typography, config, editor);
        });
        return html;
    }

    function renderTypography(typography, config, layout) {
        var rolesHtml = renderTypographyRolesInner(typography, config, layout);
        if (!rolesHtml) {
            return '';
        }
        return '<div class="grw-card" data-grwi-group="typography_roles"><div class="grw-card__body">' + renderCardHeading('Typography') + rolesHtml + '</div></div>';
    }

    function renderTypographyRoleRow(roleMeta, typography, config, editor, options) {
        options = options || {};
        var sizeKey = roleMeta.size_key;
        var colorKey = roleMeta.color_key;
        var weightKey = roleMeta.weight_key;
        var sizeId = 'grwi-field-' + sizeKey.replace(/[^a-z0-9_-]/gi, '-');
        var colorId = 'grwi-field-' + colorKey.replace(/[^a-z0-9_-]/gi, '-');
        var weightId = 'grwi-field-' + weightKey.replace(/[^a-z0-9_-]/gi, '-');
        var sizeVal = config[sizeKey];
        var colorVal = config[colorKey];
        var weightVal = config[weightKey];
        var isUnset = colorVal === '' || colorVal == null;
        var colorSwatch = colorSwatchValueForField(colorKey, colorVal, editor, { allow_empty: true });
        var isMulticolour = colorSwatch === 'multicolour';
        var locked = !!roleMeta.locked;
        var premiumPreview = fieldIsPremiumPreview(roleMeta);
        var rowClass = 'grw-typography-row';
        if (premiumPreview) {
            rowClass += ' grw-typography-row--premium-preview';
        }
        var lockedAttrs = (locked && !premiumPreview)
            ? lockedFieldAttrs({ locked: true, upgrade_feature: roleMeta.upgrade_feature || '' })
            : '';
        var inner = '<div class="' + rowClass + '" data-grwi-typo-role="' + escHtml(roleMeta.role) + '">';

        inner += '<div class="grw-typography-row__row grw-typography-row__row--controls">';
        inner += '<div class="grw-typography-row__cell grw-typography-row__cell--size">';
        inner += '<span class="grw-typography-row__label" id="' + escHtml(sizeId) + '-label">Size</span>';
        inner += '<input type="text" class="grw-input grw-typography-row__size" data-config-key="' + escHtml(sizeKey) + '" id="' + escHtml(sizeId) + '" value="' + escHtml(sizeVal == null ? '' : sizeVal) + '" placeholder="auto" aria-labelledby="' + escHtml(sizeId) + '-label"' + lockedAttrs + ' />';
        inner += '</div>';

        inner += '<div class="grw-typography-row__cell grw-typography-row__cell--weight">';
        inner += '<label class="grw-typography-row__label" id="' + escHtml(weightId) + '-label" for="' + escHtml(weightId) + '">Weight</label>';
        inner += renderSelectField(weightKey, 'Weight', typography.weight_options || [], weightVal, {
            id: weightId,
            omitLabel: true,
            compact: true,
            locked: locked,
            disabled: locked,
            premiumPreview: premiumPreview,
            attrs: ' data-config-key="' + escHtml(weightKey) + '" id="' + escHtml(weightId) + '" aria-labelledby="' + escHtml(weightId) + '-label"' + lockedAttrs,
            includeEmpty: true,
            emptyLabel: 'Auto',
            nativeClass: 'grw-typography-row__weight',
        });
        inner += '</div>';

        inner += '<button type="button" class="grw-btn-icon grw-typography-row__reset" data-grwi-typo-reset' +
            ' data-size-key="' + escHtml(sizeKey) + '"' +
            ' data-color-key="' + escHtml(colorKey) + '"' +
            ' data-weight-key="' + escHtml(weightKey) + '"' +
            (locked && !premiumPreview ? ' disabled aria-disabled="true"' : '') +
            ' aria-label="Reset to default" title="Reset to default">';
        inner += colorResetIconSvg() + '</button>';
        inner += '</div>';

        inner += '<div class="grw-typography-row__row grw-typography-row__row--colour">';
        inner += '<div class="grw-typography-row__cell grw-typography-row__cell--color">';
        inner += '<span class="grw-typography-row__label" id="' + escHtml(colorId) + '-label">Colour</span>';
        inner += '<span class="grw-color-field' + (isUnset && !isMulticolour ? ' is-unset' : '') + (isMulticolour ? ' is-multicolour' : '') + '" data-grwi-color-field="' + escHtml(colorKey) + '">';
        inner += '<input type="text" class="grw-color-hex" value="' + escHtml(isUnset || isMulticolour ? '' : String(colorVal).toUpperCase()) + '"' +
            ' maxlength="9" spellcheck="false" aria-label="Hex colour" placeholder="#RRGGBB"' + lockedAttrs + ' />';
        inner += '<input type="color" class="grw-color-input" id="' + escHtml(colorId) + '" value="' + escHtml(isMulticolour ? '#ffffff' : colorSwatch) + '" data-allow-empty="1" aria-labelledby="' + escHtml(colorId) + '-label"' + lockedAttrs + ' />';
        inner += '<input type="hidden" data-config-key="' + escHtml(colorKey) + '" value="' + escHtml(isUnset ? '' : String(colorVal)) + '"' + lockedAttrs + ' />';
        inner += '</span></div>';
        inner += '</div>';

        inner += '</div>';
        if (options.bare) {
            return inner;
        }
        var roleAccId = nextAccordionId('typo-' + roleMeta.role, roleMeta.label);
        var roleKey = 'nested:' + roleMeta.label;
        var nestedAttrs = applyPreservedAccordionOpen('', 'typo-' + roleMeta.role, roleMeta.label);
        var roleOpen = /\bopen\b/.test(nestedAttrs);
        return '<details class="grw-collapse grw-collapse--nested" data-grwi-accordion-key="' + escHtml(roleKey) + '"' + nestedAttrs + '>' +
            '<summary class="grw-collapse__summary" aria-expanded="' + (roleOpen ? 'true' : 'false') + '" aria-controls="' + roleAccId + '-panel">' +
            renderAccordionSummary(roleMeta.label) +
            '</summary>' +
            '<div class="grw-collapse__body" id="' + roleAccId + '-panel">' + inner + '</div></details>';
    }

    function resetTypographyRoleFields(sizeKey, colorKey, weightKey, editor) {
        editor = editor || readEditor();
        var $size = $('[data-config-key="' + sizeKey + '"]').filter('input[type="text"],input:not([type])').first();
        if ($size.length) {
            $size.val('');
        }
        $('[data-config-key="' + colorKey + '"]').val('');
        syncColorFieldSwatch(colorKey, editor, { allow_empty: true });
        var $weight = $('[data-config-key="' + weightKey + '"]');
        if ($weight.length) {
            $weight.val('');
        }
    }

    function renderNestedAccordion(title, bodyHtml, attrs, groupKey, options) {
        return renderFeatureChildAccordion(title, bodyHtml, attrs, groupKey, options);
    }

    function visibilityToggleChecked(toggle, config) {
        var keys = [toggle.key].concat(toggle.sync_keys || []);
        return keys.every(function (key) {
            return configFlagTruthy(config, key);
        });
    }

    function renderVisibilityToggles(toggles, config, layout) {
        var html = '';
        (toggles || []).forEach(function (toggle) {
            if (toggle.layouts && toggle.layouts.indexOf(layout) < 0) {
                return;
            }
            html += renderField({
                key: toggle.key,
                type: 'checkbox',
                label: toggle.label,
                hint: toggle.hint,
                section: 'customize',
                sync_keys: toggle.sync_keys,
            }, config, layout, toggle.sync_keys && toggle.sync_keys.length ? {
                checked: visibilityToggleChecked(toggle, config),
            } : {});
        });
        return html ? '<div class="grw-toggle-list">' + html + '</div>' : '';
    }

    function spacingSideIdPrefix(elementKey) {
        var map = {
            logo: 'grwi-google-logo-padding',
            stars: 'grwi-rating-stars-margin',
            header_stars: 'grwi-rating-stars-margin',
            rating_label: 'grwi-rating-label-margin',
            rating_value: 'grwi-rating-score-margin',
            review_count: 'grwi-review-count-margin',
            showcase_title: 'grwi-widget-title-margin',
            business_name: 'grwi-business-name-margin',
            cta: 'grwi-review-button-margin',
            card_stars: 'grwi-card-stars-margin',
            slide_stars: 'grwi-card-stars-margin',
            review_card_text: 'grwi-review-text-margin',
            review_card_author: 'grwi-reviewer-name-margin',
            review_card_date: 'grwi-review-date-margin',
            verified_badge: 'grwi-verified-badge-margin',
        };
        if (map[elementKey]) {
            return map[elementKey];
        }
        return 'grwi-' + String(elementKey || 'spacing').replace(/_/g, '-') + '-margin';
    }

    function renderElementMarginGrid(element, config, layout, options) {
        if (!element || !element.keys) {
            return '';
        }
        if (element.layouts && element.layouts.indexOf(layout) < 0) {
            return '';
        }
        options = options || {};
        var prefix = element.side_id_prefix || spacingSideIdPrefix(element.element);
        var field = {
            label: element.label || 'Spacing',
            sides: element.keys,
            min: 0,
            max: 200,
            link_id: prefix + '-link',
            side_id_prefix: prefix,
            locked: !!element.locked,
        };
        var inner = renderOuterSpacingInner(field, config);
        if (options.omitLabel || /_margin_/.test(String((element.keys && element.keys.top) || ''))) {
            return '<div class="grw-field grw-field--outer-spacing" data-grwi-spacing="' + escHtml(element.element || '') + '">' +
                inner +
                '</div>';
        }
        return '<div class="grw-field grw-field--outer-spacing" data-grwi-spacing="' + escHtml(element.element || '') + '">' +
            '<span class="grw-field__label">' + escHtml(field.label) + '</span>' +
            inner +
                '</div>';
    }

    function spacingElementsByParent(spacingElements, layout) {
        var byParent = {};
        (spacingElements || []).forEach(function (element) {
            if (element.layouts && element.layouts.indexOf(layout) < 0) {
                return;
            }
            var nest = CUSTOMIZE_SPACING_NEST[element.element];
            if (!nest) {
                return;
            }
            if (!byParent[nest.parent]) {
                byParent[nest.parent] = {};
            }
            var label = nest.label;
            if (!byParent[nest.parent][label]) {
                byParent[nest.parent][label] = { nested: nest.nested, elements: [] };
            }
            byParent[nest.parent][label].elements.push(element);
        });
        return byParent;
    }

    function renderSpacingGroupBodies(parentKey, spacingByParent, config, layout) {
        var groups = spacingByParent[parentKey] || {};
        var nestedHtml = '';
        var inlineHtml = '';
        Object.keys(groups).forEach(function (label) {
            var entry = groups[label];
            var body = '';
            entry.elements.forEach(function (element) {
                body += renderElementMarginGrid(element, config, layout, { omitLabel: !!entry.nested });
            });
            if (!body) {
                return;
            }
            if (entry.nested) {
                nestedHtml += renderNestedAccordion(label, body);
            } else {
                inlineHtml += body;
            }
        });
        return { nestedHtml: nestedHtml, inlineHtml: inlineHtml };
    }

    function customizeLockedChrome(customizeLocked) {
        if (!customizeLocked) {
            return {};
        }
        if (fieldIsPremiumPreview({ locked: true, upgrade_feature: 'advanced_customisation' })) {
            return { premiumPreview: true, plan: 'site' };
        }
        return { locked: true, plan: 'site' };
    }

    function layoutHasCarouselNav(layout, builder) {
        var layouts = (builder && builder.style_panel_layouts && builder.style_panel_layouts.carousel_nav) || ['feed_carousel', 'feed_slider'];
        return layouts.indexOf(layout) >= 0;
    }

    function fieldByKey(fields, key) {
        var found = null;
        (fields || []).some(function (field) {
            if (field.key === key) {
                found = field;
                return true;
            }
            return false;
        });
        return found;
    }

    function renderOuterSpacingLabeled(field, config, layout, options) {
        options = options || {};
        if (!field || !fieldVisible(field, config, layout)) {
            return '';
        }
        var inner = renderOuterSpacingInner(field, config);
        if (options.omitLabel) {
            return '<div class="grw-field grw-field--outer-spacing" data-grwi-field="' + escHtml(field.key) + '">' +
                inner +
                '</div>';
        }
        return '<div class="grw-field grw-field--outer-spacing" data-grwi-field="' + escHtml(field.key) + '">' +
            '<span class="grw-field__label">' + escHtml(field.label || '') + '</span>' +
            inner +
            '</div>';
    }

    function renderColorFieldsForCustomizeGroup(colors, groupId, config, layout) {
        var html = '';
        (colors || []).forEach(function (colorField) {
            if ((colorField.customize_group || '') !== groupId) {
                return;
            }
            if (colorField.layouts && colorField.layouts.indexOf(layout) < 0) {
                return;
            }
            var colorMeta = {
                key: colorField.key,
                type: colorField.type || 'color',
                label: colorField.label,
                allow_empty: colorField.allow_empty,
                empty_means_multicolour: colorField.empty_means_multicolour,
                theme_aware: colorField.theme_aware,
                options: colorField.options,
                preview_visible: colorField.preview_visible,
                visibility_element: colorField.visibility_element,
                layouts: colorField.layouts,
                show_when: colorField.show_when,
                show_unless: colorField.show_unless,
                section: 'customize',
            };
            html += renderField(colorMeta, config, layout);
        });
        return html;
    }

    function renderSingleColorField(colors, key, config, layout) {
        var match = null;
        (colors || []).some(function (colorField) {
            if (colorField.key === key) {
                match = colorField;
                return true;
            }
            return false;
        });
        if (!match) {
            return '';
        }
        return renderColorFieldsForCustomizeGroup([match], match.customize_group || 'google_logo', config, layout);
    }

    function renderTypographyRoleBare(typography, roleName, config, layout, options) {
        options = options || {};
        var editor = readEditor();
        var role = null;
        (typography.roles || []).some(function (entry) {
            if (entry.role === roleName) {
                role = entry;
                return true;
            }
            return false;
        });
        if (!role) {
            return '';
        }
        if (role.layouts && role.layouts.length && role.layouts.indexOf(layout) < 0) {
            return '';
        }
        if (!typographyElementVisibleInConfig(role.role, config, layout, typography, editor, options.ignoreVisibility !== false)) {
            return '';
        }
        return renderTypographyRoleRow(role, typography, config, editor, { bare: true });
    }

    function takeSpacingLabel(spacingByParent, parent, label) {
        if (!spacingByParent[parent] || !spacingByParent[parent][label]) {
            return null;
        }
        var entry = spacingByParent[parent][label];
        delete spacingByParent[parent][label];
        return entry;
    }

    function renderSpacingEntry(entry, config, layout) {
        if (!entry || !entry.elements) {
            return '';
        }
        var html = '';
        entry.elements.forEach(function (element) {
            html += renderElementMarginGrid(element, config, layout, { omitLabel: true });
        });
        return html;
    }

    function renderGoogleLogoKey(logoFields, colors, config, layout, key) {
        if (key === 'google_logo_color' || key === 'google_logo_bg_color' || key === 'google_logo_border_color') {
            return renderSingleColorField(colors, key, config, layout);
        }
        var field = fieldByKey(logoFields, key);
        return field ? renderField(field, config, layout) : '';
    }

    function renderGoogleLogoKeys(logoFields, colors, config, layout, keys) {
        var html = '';
        (keys || []).forEach(function (key) {
            html += renderGoogleLogoKey(logoFields, colors, config, layout, key);
        });
        return html;
    }

    function renderGoogleLogoControls(groups, colors, config, layout, includeVisibleToggle, spacingHtml) {
        var logoFields = groups.google_logo || [];
        var typeHtml = renderGoogleLogoKeys(logoFields, colors, config, layout, ['google_logo_style', 'badge_logo_position']);
        var colourHtml = renderGoogleLogoKeys(logoFields, colors, config, layout, ['google_logo_color']);
        var sizeHtml = renderGoogleLogoKeys(logoFields, colors, config, layout, ['google_logo_size', 'google_logo_bg_padding']) +
            (spacingHtml || '');
        var chromeHtml = renderGoogleLogoKeys(logoFields, colors, config, layout, [
            'google_logo_show_bg',
            'google_logo_bg_color',
            'google_logo_bg_radius',
            'google_logo_show_border',
            'google_logo_border_color',
            'google_logo_border_width',
        ]);
        var used = {
            google_logo_visible: true,
            google_logo_style: true,
            badge_logo_position: true,
            google_logo_color: true,
            google_logo_size: true,
            google_logo_bg_padding: true,
            google_logo_show_bg: true,
            google_logo_bg_color: true,
            google_logo_bg_radius: true,
            google_logo_show_border: true,
            google_logo_border_color: true,
            google_logo_border_width: true,
        };
        var leftoverHtml = '';
        logoFields.forEach(function (field) {
            if (!field || used[field.key] || (!includeVisibleToggle && field.key === 'google_logo_visible')) {
                return;
            }
            leftoverHtml += renderField(field, config, layout);
        });
        if (leftoverHtml) {
            typeHtml += leftoverHtml;
        }
        if (!includeVisibleToggle) {
            return typeHtml + colourHtml + sizeHtml + chromeHtml;
        }
        var parent = renderGoogleLogoKey(logoFields, colors, config, layout, 'google_logo_visible');
        parent += renderNestedGroups([
            { title: 'Type', html: typeHtml, key: 'google_logo_type' },
            { title: 'Colours', html: colourHtml, key: 'google_logo_colours' },
            { title: 'Size & Spacing', html: sizeHtml, key: 'google_logo_size_spacing' },
            { title: 'Background & Border', html: chromeHtml, key: 'google_logo_chrome' },
        ]);
        return parent;
    }

    function renderShowHeaderCard(visibility, config, layout) {
        if (!visibility || !visibility.feed_header_master) {
            return '';
        }
        return '<div data-grwi-feed-show-header>' +
            renderField({
                key: visibility.feed_header_master,
                type: 'checkbox',
                label: 'Show header',
                section: 'customize',
            }, config, layout) +
            '</div>';
    }

    function renderTextTypoSpacingGroups(prefix, textHtml, typoHtml, spacingHtml, extraItems) {
        var items = [
            { title: 'Text', html: textHtml, key: prefix + '_text' },
            { title: 'Typography', html: typoHtml, key: prefix + '_typography' },
            { title: 'Spacing', html: spacingHtml, key: prefix + '_spacing' },
        ].concat(extraItems || []);
        return renderNestedGroups(items);
    }

    function renderWidgetCustomizeBody(groups, colors, config, layout) {
        var widgetFields = groups.widget || [];
        var used = {};
        var bgHtml = renderColorFieldsForCustomizeGroup(colors, 'widget', config, layout);
        var paddingField = fieldByKey(widgetFields, 'widget_inner_padding');
        if (paddingField) {
            bgHtml += renderOuterSpacingLabeled(paddingField, config, layout);
            used.widget_inner_padding = true;
        }
        var borderHtml = renderFieldsList(fieldsByKeys(widgetFields, [
            'widget_border_style',
            'widget_border_color',
            'widget_border_radius',
            'widget_border_width',
        ]), config, layout);
        used.widget_border_style = true;
        used.widget_border_color = true;
        used.widget_border_radius = true;
        used.widget_border_width = true;
        var shadowHtml = renderFieldsList(fieldsByKeys(widgetFields, ['widget_shadow_enabled']), config, layout);
        used.widget_shadow_enabled = true;
        var leftover = fieldsExceptKeys(widgetFields, Object.keys(used));
        if (leftover.length) {
            bgHtml += renderFieldsList(leftover, config, layout);
        }
        return renderNestedGroups([
            { title: 'Background', html: bgHtml, key: 'widget_background' },
            { title: 'Border', html: borderHtml, key: 'widget_border' },
            { title: 'Shadow', html: shadowHtml, key: 'widget_shadow' },
        ]);
    }

    function renderCustomizeSection(editor) {
        var builder = editor.builder || {};
        var config = editor.config || {};
        var layout = builder.layout || editor.layout || 'badge_card';
        var upgradeUrl = editor.upgrade_url || '';
        var canCustomize = !!editor.can_use_builder_customize;
        var section = (builder.sections || []).find(function (s) { return s.id === 'customize'; }) || {};
        var customizeLocked = !canCustomize || !!section.locked;
        var lockedChrome = customizeLockedChrome(customizeLocked);
        var visibility = builder.visibility || {};
        var isFeed = !!visibility.is_feed || isFeedLayoutKey(layout);
        var groups = groupFields(builder.fields || [], 'customize');
        var renderedUpgradeFeatures = {};
        var spacingByParent = spacingElementsByParent(builder.spacing_elements || [], layout);
        var colors = builder.colors || [];
        var typography = builder.typography || {};
        var accordionHtml = '';
        var upgrade = builder.upgrade || {};

        accordionHtml += renderSectionAccordion('Widget', renderWidgetCustomizeBody(groups, colors, config, layout), '', 'widget', lockedChrome);

        if (isFeed) {
            var headerBody = renderShowHeaderCard(visibility, config, layout);
            var headerContainerHtml = renderColorFieldsForCustomizeGroup(colors, 'header', config, layout);
                (groups.header || []).forEach(function (field) {
                    if (field.type === 'outer_spacing') {
                    headerContainerHtml += renderOuterSpacingLabeled(field, config, layout, { omitLabel: true });
                        return;
                    }
                headerContainerHtml += renderField(field, config, layout);
            });
            var headerChildren = '';
            headerChildren += renderNestedAccordion('Header Container', headerContainerHtml, '', 'header_container');
            headerChildren += renderNestedAccordion(
                'Show / Hide',
                '<p class="grw-field__hint grw-collapse__lead">Choose which header elements appear, then customise each one below.</p>' +
                    renderVisibilityToggles(visibility.feed_header_elements, config, layout),
                '',
                'header_show_hide'
            );

            var logoHtml = renderGoogleLogoControls(
                groups,
                colors,
                config,
                layout,
                false,
                renderSpacingEntry(takeSpacingLabel(spacingByParent, 'google_logo', 'Google Logo'), config, layout) +
                    renderSpacingEntry(takeSpacingLabel(spacingByParent, 'header', 'Google Logo'), config, layout)
            );
            headerChildren += renderNestedAccordion('Google Logo', logoHtml, '', 'header_google_logo');

                var businessHtml = renderTypographyRoleBare(typography, 'business_name', config, layout);
            businessHtml += renderSpacingEntry(takeSpacingLabel(spacingByParent, 'header', 'Business Name'), config, layout);
            headerChildren += renderNestedAccordion('Business Name', businessHtml, '', 'header_business_name');

                var titleHtml = renderFieldsHtml(groups.header_title || [], config, layout, upgradeUrl, renderedUpgradeFeatures, upgrade);
                titleHtml += renderTypographyRoleBare(typography, 'showcase_title', config, layout);
            titleHtml += renderSpacingEntry(takeSpacingLabel(spacingByParent, 'header', 'Widget Title'), config, layout);
            headerChildren += renderNestedAccordion('Widget Title', titleHtml, '', 'header_widget_title');

                var ratingLabelHtml = renderFieldsHtml(groups.rating || [], config, layout, upgradeUrl, renderedUpgradeFeatures, upgrade);
                ratingLabelHtml += renderTypographyRoleBare(typography, 'rating_label', config, layout);
            ratingLabelHtml += renderSpacingEntry(takeSpacingLabel(spacingByParent, 'header', 'Rating Label'), config, layout);
            ratingLabelHtml += renderSpacingEntry(takeSpacingLabel(spacingByParent, 'rating', 'Rating Label'), config, layout);
            headerChildren += renderNestedAccordion('Rating Label', ratingLabelHtml, '', 'header_rating_label');

                var ratingScoreHtml = renderTypographyRoleBare(typography, 'rating_value', config, layout);
            ratingScoreHtml += renderSpacingEntry(takeSpacingLabel(spacingByParent, 'rating_score', 'Rating Score'), config, layout);
            headerChildren += renderNestedAccordion('Rating Score', ratingScoreHtml, '', 'header_rating_score');

                var headerStarsHtml = renderSingleColorField(colors, 'header_star_color', config, layout);
                headerStarsHtml += renderFieldsHtml(groups.header_stars || [], config, layout, upgradeUrl, renderedUpgradeFeatures, upgrade);
            headerStarsHtml += renderSpacingEntry(takeSpacingLabel(spacingByParent, 'header', 'Rating Stars'), config, layout);
            headerStarsHtml += renderSpacingEntry(takeSpacingLabel(spacingByParent, 'star_rating', 'Star Rating'), config, layout);
            headerChildren += renderNestedAccordion('Rating Stars', headerStarsHtml, '', 'header_rating_stars');

                var reviewCountHtml = renderFieldsHtml(groups.review_count || [], config, layout, upgradeUrl, renderedUpgradeFeatures, upgrade);
                reviewCountHtml += renderTypographyRoleBare(typography, 'review_count', config, layout);
                reviewCountHtml += renderSingleColorField(colors, 'verified_badge_color', config, layout);
            reviewCountHtml += renderSpacingEntry(takeSpacingLabel(spacingByParent, 'header', 'Review Count'), config, layout);
            reviewCountHtml += renderSpacingEntry(takeSpacingLabel(spacingByParent, 'review_count', 'Review Count'), config, layout);
            headerChildren += renderNestedAccordion('Review Count', reviewCountHtml, '', 'header_review_count');

                var reviewBtnHtml = renderFieldsHtml(
                    groups.feed_review_button || [],
                    config,
                    layout,
                    upgradeUrl,
                    renderedUpgradeFeatures,
                    upgrade
                );
                reviewBtnHtml += renderSpacingEntry(takeSpacingLabel(spacingByParent, 'header', 'Review Button'), config, layout);
            headerChildren += renderNestedAccordion('Review Button', reviewBtnHtml, '', 'header_review_button');

                var leftoverHeader = renderSpacingGroupBodies('header', spacingByParent, config, layout);
            headerChildren += leftoverHeader.nestedHtml;
            headerBody += wrapFeatureChildren(headerChildren, {
                offTooltip: 'Turn on Show header to customise these options.',
            });
            headerBody += leftoverHeader.inlineHtml;
            accordionHtml += renderSectionAccordion('Header', headerBody, '', 'customize_header', lockedChrome);

            var cardLayoutHtml = renderSingleColorField(colors, 'feed_card_bg_color', config, layout);
            (groups.review_cards || []).forEach(function (field) {
                if (field.type === 'outer_spacing') {
                    cardLayoutHtml += renderOuterSpacingLabeled(field, config, layout, { omitLabel: true });
                    return;
                }
                cardLayoutHtml += renderField(field, config, layout);
            });
            var columnFields = fieldsByKeys(groups.feed_display || [], ['feed_columns', 'feed_rows']);
            cardLayoutHtml += renderFieldsHtml(columnFields, config, layout, upgradeUrl, renderedUpgradeFeatures, upgrade);
            var loadMoreFields = fieldsExceptKeys(groups.feed_display || [], ['feed_columns', 'feed_rows']).filter(function (field) {
                // Grid/masonry visible count is rows × columns — do not show "Reviews shown initially".
                if (field && field.key === 'feed_initial_review_count') {
                    var id = String(layout || '');
                    if (id === 'feed_grid' || id === 'grid' || id === 'feed_masonry' || id === 'masonry') {
                        return false;
                    }
                }
                return true;
            });
            var cardChildren = '';
            cardChildren += renderNestedAccordion('Card Layout', cardLayoutHtml, '', 'card_layout');
            cardChildren += renderNestedAccordion(
                'Show / Hide Elements',
                renderVisibilityToggles(visibility.feed_card_elements, config, layout),
                '',
                'card_show_hide'
            );

            var cardStarsHtml = renderSingleColorField(colors, 'card_star_color', config, layout);
            cardStarsHtml += renderFieldsHtml(groups.card_stars || [], config, layout, upgradeUrl, renderedUpgradeFeatures, upgrade);
            cardStarsHtml += renderSpacingEntry(takeSpacingLabel(spacingByParent, 'review_cards', 'Card Stars'), config, layout);
            cardChildren += renderNestedAccordion('Card Stars', cardStarsHtml, '', 'card_stars');

            var reviewTextHtml = renderTypographyRoleBare(typography, 'review_text', config, layout);
            reviewTextHtml += renderSpacingEntry(takeSpacingLabel(spacingByParent, 'review_cards', 'Review Text'), config, layout);
            cardChildren += renderNestedAccordion('Review Text', reviewTextHtml, '', 'card_review_text');

            var reviewerHtml = renderTypographyRoleBare(typography, 'review_author', config, layout);
            reviewerHtml += renderSpacingEntry(takeSpacingLabel(spacingByParent, 'review_cards', 'Reviewer Name'), config, layout);
            cardChildren += renderNestedAccordion('Reviewer Name', reviewerHtml, '', 'card_reviewer_name');

            var reviewDateHtml = renderTypographyRoleBare(typography, 'review_date', config, layout);
            reviewDateHtml += renderSpacingEntry(takeSpacingLabel(spacingByParent, 'review_cards', 'Review Date'), config, layout);
            cardChildren += renderNestedAccordion('Review Date', reviewDateHtml, '', 'card_review_date');

            var leftoverCards = renderSpacingGroupBodies('review_cards', spacingByParent, config, layout);
            cardChildren += leftoverCards.nestedHtml;
            var cardsBody = leftoverCards.inlineHtml + wrapFeatureChildren(cardChildren);
            accordionHtml += renderSectionAccordion('Review Cards', cardsBody, '', 'feed_display', lockedChrome);

            if (layoutHasCarouselNav(layout, builder)) {
                var navHtml = renderColorFieldsForCustomizeGroup(colors, 'navigation', config, layout);
                navHtml += renderFieldsHtml(groups.navigation || [], config, layout, upgradeUrl, renderedUpgradeFeatures, upgrade);
                accordionHtml += renderSectionAccordion('Navigation', renderNestedGroups([{ title: 'Navigation Style', html: navHtml, key: 'nav_style' }]), '', 'navigation', lockedChrome);
            }

            var footerFields = groups.feed_footer_button || [];
            var footerShow = footerFields.filter(function (field) {
                return /_show_view_all$/.test(String(field.key || ''));
            });
            var footerBehaviour = footerFields.filter(function (field) {
                return field.key === 'feed_review_button_mode' || field.key === 'feed_footer_button_fixed_hint';
            }).concat(loadMoreFields || []);
            var footerAppearance = footerFields.filter(function (field) {
                return field.key === 'feed_footer_button_bg_color' || field.key === 'feed_footer_button_border_color';
            });
            var footerTypo = footerFields.filter(function (field) {
                return String(field.key || '').indexOf('typo_link_') === 0;
            });
            var footerUsed = {};
            footerShow.concat(footerBehaviour, footerAppearance, footerTypo).forEach(function (field) {
                if (field && field.key) {
                    footerUsed[field.key] = true;
                }
            });
            var footerLeftover = fieldsExceptKeys(footerFields, Object.keys(footerUsed));
            var footerBody = renderFieldsHtml(footerShow, config, layout, upgradeUrl, renderedUpgradeFeatures, upgrade);
            var footerChildren = '';
            footerChildren += renderNestedAccordion(
                'Button Behaviour',
                renderFieldsHtml(footerBehaviour, config, layout, upgradeUrl, renderedUpgradeFeatures, upgrade),
                '',
                'footer_behaviour'
            );
            footerChildren += renderNestedAccordion(
                'Button Appearance',
                renderFieldsHtml(footerAppearance, config, layout, upgradeUrl, renderedUpgradeFeatures, upgrade),
                '',
                'footer_appearance'
            );
            footerChildren += renderNestedAccordion(
                'Button Typography & Spacing',
                renderFieldsHtml(footerTypo.concat(footerLeftover), config, layout, upgradeUrl, renderedUpgradeFeatures, upgrade),
                '',
                'footer_typography'
            );
            footerBody += wrapFeatureChildren(footerChildren, {
                offTooltip: 'Turn on Show footer button to customise these options.',
            });
            accordionHtml += renderSectionAccordion('Footer Button', footerBody, '', 'feed_footer_button', lockedChrome);
        } else {
            var showHideBody = renderVisibilityToggles(visibility.toggles, config, layout);
            accordionHtml += renderSectionAccordion('Show / Hide', showHideBody, '', 'customize_visibility', lockedChrome);

            var logoSpacing = renderSpacingEntry(takeSpacingLabel(spacingByParent, 'google_logo', 'Google Logo'), config, layout);
            var leftoverLogo = renderSpacingGroupBodies('google_logo', spacingByParent, config, layout);
            logoSpacing += leftoverLogo.inlineHtml;
            var logoBody = renderGoogleLogoControls(groups, colors, config, layout, true, logoSpacing);
            logoBody += leftoverLogo.nestedHtml;
            accordionHtml += renderSectionAccordion('Google Logo', logoBody, '', 'google_logo', lockedChrome);

            var ratingText = renderFieldsHtml(groups.rating || [], config, layout, upgradeUrl, renderedUpgradeFeatures, upgrade);
            var ratingTypo = renderTypographyRoleBare(typography, 'rating_label', config, layout);
            var ratingSpacing = renderSpacingEntry(takeSpacingLabel(spacingByParent, 'rating', 'Rating Label'), config, layout);
            var leftoverRating = renderSpacingGroupBodies('rating', spacingByParent, config, layout);
            ratingSpacing += leftoverRating.inlineHtml;
            accordionHtml += renderSectionAccordion(
                'Rating Label',
                leftoverRating.nestedHtml + renderTextTypoSpacingGroups('rating_label', ratingText, ratingTypo, ratingSpacing),
                '',
                'rating',
                lockedChrome
            );

            var scoreTypo = renderTypographyRoleBare(typography, 'rating_value', config, layout);
            var scoreSpacing = renderSpacingEntry(takeSpacingLabel(spacingByParent, 'rating_score', 'Rating Score'), config, layout);
            var leftoverScore = renderSpacingGroupBodies('rating_score', spacingByParent, config, layout);
            scoreSpacing += leftoverScore.inlineHtml;
            accordionHtml += renderSectionAccordion(
                'Rating Score',
                leftoverScore.nestedHtml + renderNestedGroups([
                    { title: 'Typography', html: scoreTypo, key: 'rating_score_typography' },
                    { title: 'Spacing', html: scoreSpacing, key: 'rating_score_spacing' },
                ]),
                '',
                'rating_score',
                lockedChrome
            );

            var starsAppearance = renderSingleColorField(colors, 'star_color', config, layout);
            starsAppearance += renderFieldsHtml(groups.star_rating || [], config, layout, upgradeUrl, renderedUpgradeFeatures, upgrade);
            var starsSpacing = renderSpacingEntry(takeSpacingLabel(spacingByParent, 'star_rating', 'Star Rating'), config, layout);
            var leftoverStars = renderSpacingGroupBodies('star_rating', spacingByParent, config, layout);
            starsSpacing += leftoverStars.inlineHtml;
            accordionHtml += renderSectionAccordion(
                'Star Rating',
                leftoverStars.nestedHtml + renderNestedGroups([
                    { title: 'Appearance', html: starsAppearance, key: 'star_appearance' },
                    { title: 'Spacing', html: starsSpacing, key: 'star_spacing' },
                ]),
                '',
                'star_rating',
                lockedChrome
            );

            var countText = renderFieldsHtml(groups.review_count || [], config, layout, upgradeUrl, renderedUpgradeFeatures, upgrade);
            var countTypo = renderTypographyRoleBare(typography, 'review_count', config, layout);
            var countSpacing = renderSpacingEntry(takeSpacingLabel(spacingByParent, 'review_count', 'Review Count'), config, layout);
            var verifiedHtml = renderSingleColorField(colors, 'verified_badge_color', config, layout);
            verifiedHtml += renderSpacingEntry(takeSpacingLabel(spacingByParent, 'review_count', 'Verified Badge'), config, layout);
            var leftoverCount = renderSpacingGroupBodies('review_count', spacingByParent, config, layout);
            verifiedHtml += leftoverCount.inlineHtml;
            accordionHtml += renderSectionAccordion(
                'Review Count',
                renderTextTypoSpacingGroups('review_count', countText, countTypo, countSpacing, [
                    { title: 'Verified Badge', html: verifiedHtml, key: 'verified_badge' },
                ]),
                '',
                'review_count',
                lockedChrome
            );
        }

        var html = '<div class="grw-style-accordions" data-grwi-section-accordions data-grwi-exclusive-parents="customize">' +
            accordionHtml +
            '</div>';
        if (customizeLocked && !editorIsPreviewFirst()) {
            html = '<div class="grw-customize-panel grw-customize-panel--locked" data-grwi-customize-locked="1" aria-disabled="true">' +
                html +
                '</div>' +
                renderCustomizeTrialCard(editor);
        }
        return html;
    }

    function renderElementOrder(elementOrder, config, options) {
        options = options || {};
        if (!elementOrder || !elementOrder.type || !elementOrder.elements) {
            return '';
        }
        var order = config[elementOrder.key];
        if (!Array.isArray(order)) {
            order = elementOrder.elements.slice();
        }
        var body = '<ul class="grw-order-list">';
        order.forEach(function (item, index) {
            var label = (elementOrder.labels && elementOrder.labels[item] && elementOrder.labels[item].label) || item;
            body += '<li class="grw-order-item" draggable="true" data-order-index="' + index + '" data-order-value="' + escHtml(item) + '">' +
                '<span class="grw-order-item__handle" aria-hidden="true">⋮⋮</span>' +
                '<span class="grw-order-item__label">' + escHtml(label) + '</span></li>';
        });
        body += '</ul><input type="hidden" data-config-key="' + escHtml(elementOrder.key) + '" value="' + escHtml(JSON.stringify(order)) + '" />';
        if (options.asInner) {
            return '<div class="grw-field grw-field--placement-control" data-grwi-element-order="' + escHtml(elementOrder.key) + '">' +
                '<span class="grw-field__label">Element Order</span>' + body + '</div>';
        }
        if (options.asAccordion) {
            return '<div data-grwi-element-order="' + escHtml(elementOrder.key) + '">' +
                renderSectionAccordion('Element Order', body) +
                '</div>';
        }
        return '<div class="grw-card" data-grwi-element-order="' + escHtml(elementOrder.key) + '"><div class="grw-card__body">' +
            renderCardHeading('Element Order') + body + '</div></div>';
    }

    function renderPositionFields(positionFields, config, layout, options) {
        options = options || {};
        var html = '';
        (positionFields || []).forEach(function (field) {
            if (field.layouts && field.layouts.indexOf(layout) < 0) {
                return;
            }
            var body = renderField({ key: field.key, type: 'visual', label: field.label, options: field.options, section: 'settings' }, config, layout, { omitLabel: true });
            if (options.asInner) {
                html += '<div class="grw-field grw-field--placement-control" data-grwi-field="' + escHtml(field.key) + '">' +
                    '<span class="grw-field__label">' + escHtml(field.label) + '</span>' + body + '</div>';
                return;
            }
            if (options.asAccordion) {
                var positionValue = accordionValueFromField({
                    key: field.key,
                    type: 'visual',
                    options: field.options,
                }, config);
                html += renderSectionAccordion(field.label, body, '', '', accordionChromeFromOptions(options, positionValue ? {
                    value: positionValue.label,
                    valueKey: positionValue.key,
                } : {}));
                return;
            }
            html += '<div class="grw-card" data-grwi-group="position"><div class="grw-card__body">' + renderCardHeading(field.label) +
                body +
                '</div></div>';
        });
        return html;
    }

    function renderReviewSyncStatus(editor) {
        var sync = editor.review_sync || {};
        var prompt = (editor.review_limit_prompt) || (sync.review_limit_prompt) || {};
        var hasPrompt = !!(prompt.title || prompt.body);
        if (!sync.show_upgrade || !hasPrompt) {
            return '';
        }
        var eligible = customizeTrialEligibility(editor);
        var plan = String(prompt.plan || 'site');
        var upgradeUrl = customizeCheckoutUrl(editor, eligible === true, plan)
            || sync.upgrade_url
            || editor.upgrade_checkout_url
            || editor.upgrade_url
            || '';
            var cfg = window.grwiCustomize || {};
            var i18n = cfg.i18n || {};
        var title = prompt.title || '';
            var body = prompt.body || '';
        var html = '<div class="grw-reviews-limit-card">';
        html += '<p class="grw-reviews-limit-card__title">' + escHtml(title) + '</p>';
        if (prompt.body_html) {
            // Lines must only contain server-built, escaped content: never business names or review text.
            html += '<p class="grw-reviews-limit-card__body">' + prompt.body_html + '</p>';
        } else if (body) {
            html += '<p class="grw-reviews-limit-card__body">' + escHtml(body) + '</p>';
        }
        if (prompt.primary_label || upgradeUrl) {
            var cta = prompt.primary_label || trialCtaLabel('site', eligible, i18n, editor);
            var supporting = prompt.supporting || trialSupportingCopy('site', eligible, i18n, editor);
            var href = prompt.checkout_url || upgradeUrl;
            var isLinkCta = prompt.mode === 'link';
            html += '<div class="grw-reviews-limit-card__actions">';
            if (isLinkCta) {
                html += '<button type="button" class="button button-primary" data-grwi-connect-account>' +
                    escHtml(cta) + '</button>';
            } else {
                html += '<button type="button" class="button button-primary" data-grwi-trial-cta="1"' +
                    ' data-feature="review_limit" data-plan="' + escHtml(plan) + '"' +
                    ' data-trial-eligible="' + (eligible === null ? '' : (eligible ? '1' : '0')) + '"' +
                    ' data-checkout-url="' + escHtml(href) + '"' +
                    ' data-feature-label="more reviews"' +
                    ' data-modal-title="' + escHtml(title) + '"' +
                    ' data-modal-body="' + escHtml(body) + '"' +
                    ' data-modal-supporting="' + escHtml(supporting) + '">' +
                    escHtml(cta) + '</button>';
            }
            var secondaryLabel = prompt.secondary_label || '';
            var secondaryUrl = prompt.secondary_url || prompt.compare_url || '';
            var stacked = !!prompt.body_html;
            if (!stacked && secondaryLabel && (secondaryUrl || href)) {
                    html += '<button type="button" class="button" data-grwi-trial-cta="1"' +
                        ' data-feature="review_limit" data-plan="' + escHtml(plan) + '"' +
                        ' data-trial-eligible="' + (eligible === null ? '' : (eligible ? '1' : '0')) + '"' +
                    ' data-checkout-url="' + escHtml(secondaryUrl || href) + '"' +
                        ' data-feature-label="Site benefits"' +
                        ' data-modal-title="' + escHtml(title) + '"' +
                        ' data-modal-body="' + escHtml(body) + '"' +
                        ' data-modal-supporting="' + escHtml(supporting) + '">' +
                        escHtml(secondaryLabel) + '</button>';
            }
            html += '</div>';
            if (stacked && supporting) {
                html += '<p class="grw-reviews-limit-card__supporting">' + escHtml(supporting) + '</p>';
            }
            if (stacked && secondaryLabel && secondaryUrl) {
                html += '<p class="grw-reviews-limit-card__compare"><a class="grw-reviews-limit-card__compare-link" href="' +
                    escHtml(secondaryUrl) + '" target="_blank" rel="noopener noreferrer">' +
                    escHtml(secondaryLabel) + '</a></p>';
            }
        }
        html += '</div>';
        return html;
    }

    function renderReviewCurator(editor, options) {
        options = options || {};
        var reviews = editor.cached_reviews || [];
        var curation = editor.review_curation || { review_order: [], hidden_review_ids: [] };
        var body = renderReviewSyncStatus(editor);
        if (!reviews.length) {
            body += '<div class="grw-callout grw-callout--info"><p>Sync reviews from Google to curate which reviews appear in this widget.</p></div>';
        } else {
            body += '<p class="grw-field__hint">Toggle reviews on or off. Drag to reorder when sort is set to manual.</p>';
            body += '<ul class="grw-review-list" id="grwi-review-list">';
            reviews.forEach(function (review) {
                var id = review.id || '';
                var hidden = (curation.hidden_review_ids || []).indexOf(id) >= 0;
                body += '<li class="grw-review-item" data-review-id="' + escHtml(id) + '" draggable="true">' +
                    '<label class="grw-checkbox-row"><input type="checkbox" class="grw-checkbox grw-review-item__toggle"' + (hidden ? '' : ' checked') + ' /> ' +
                    escHtml(review.author_name || 'Reviewer') + ' — ' + escHtml(review.rating || '') + '★</label></li>';
            });
            body += '</ul>';
            body += '<input type="hidden" data-config-key="review_order" value="' + escHtml(JSON.stringify(curation.review_order || [])) + '" />';
            body += '<input type="hidden" data-config-key="hidden_review_ids" value="' + escHtml(JSON.stringify(curation.hidden_review_ids || [])) + '" />';
        }
        if (options.asAccordion) {
            return '<div id="grwi-reviews-curator" data-grwi-group="review_curation">' +
                renderSectionAccordion('Review Curation', body) +
                '</div>';
        }
        return '<div class="grw-card" id="grwi-reviews-curator" data-grwi-group="review_curation"><div class="grw-card__body">' +
            renderCardHeading('Review Curation') + body + '</div></div>';
    }

    function withAppendedBody(bodyHtml, options) {
        var html = String(bodyHtml || '');
        if (options && options.bodyPrepend) {
            html = String(options.bodyPrepend) + html;
        }
        if (options && options.bodyAppend) {
            html += options.bodyAppend;
        }
        return html;
    }

    function resolvePluginAsset(path) {
        path = String(path || '');
        if (!path) {
            return '';
        }
        if (/^https?:\/\//i.test(path) || path.indexOf('//') === 0) {
            return path;
        }
        var cfg = window.grwiCustomize || {};
        var base = String(cfg.pluginUrl || '').replace(/\/?$/, '/');
        var url = base + path.replace(/^\//, '');
        var ver = String(cfg.pluginAssetVersion || cfg.pluginVersion || '');
        if (ver && url.indexOf('?') === -1) {
            url += '?v=' + encodeURIComponent(ver);
        }
        return url;
    }

    function jsonLdExplainerField(editor) {
        var fields = ((editor && editor.builder) || {}).fields || [];
        var i;
        for (i = 0; i < fields.length; i += 1) {
            if (fields[i] && fields[i].key === 'enable_json_ld') {
                return fields[i];
            }
        }
        return null;
    }

    function jsonLdExplainerFigureHtml(editor, field, options) {
        options = options || {};
        field = field || jsonLdExplainerField(editor);
        var prompt = featurePromptFromEditor(editor, 'json_ld');
        var src = '';
        if (field && field.explainer_image) {
            src = resolvePluginAsset(field.explainer_image);
        }
        if (!src && prompt && prompt.image) {
            src = prompt.image;
        }
        if (!src) {
            src = resolvePluginAsset('assets/google-search-stars-rich-result.svg');
        }
        var alt = (field && field.explainer_image_alt)
            || (prompt && prompt.image_alt)
            || 'Google search result showing a business listing with gold review stars under the title';
        var cls = 'grw-json-ld-explainer' + (options.inCard ? ' grw-json-ld-explainer--card' : '');
        return '<figure class="' + cls + '">' +
            '<img src="' + escHtml(src) + '" alt="' + escHtml(alt) + '" width="960" height="540" loading="lazy" decoding="async">' +
            '</figure>';
    }

    function renderGroupCard(groupKey, fields, config, layout, upgradeUrl, renderedUpgradeFeatures, builderUpgrade, options) {
        options = options || {};
        var asAccordion = !!options.asAccordion;
        var visibleFields = (fields || []).filter(function (field) {
            return fieldVisible(field, config, layout);
        });
        if (!visibleFields.length) {
            return '';
        }

        if (visibleFields.length === 1 && isCompositeFieldType(visibleFields[0].type)) {
            if (asAccordion && visibleFields[0].type === 'outer_spacing') {
                return renderSectionAccordion(
                    options.title || groupCardTitle(groupKey, visibleFields),
                    withAppendedBody(renderOuterSpacingInner(visibleFields[0], config), options),
                    '',
                    groupKey,
                    accordionChromeFromOptions(options)
                );
            }
            if (asAccordion && visibleFields[0].type === 'float_offsets') {
                return renderSectionAccordion(
                    options.title || groupCardTitle(groupKey, visibleFields),
                    withAppendedBody(renderFloatOffsetsInner(visibleFields[0], config), options),
                    '',
                    groupKey,
                    accordionChromeFromOptions(options)
                );
            }
            if (asAccordion && visibleFields[0].type === 'device_visibility') {
                return renderSectionAccordion(
                    options.title || groupCardTitle(groupKey, visibleFields),
                    withAppendedBody(renderDeviceVisibilityInner(visibleFields[0], config), options),
                    '',
                    groupKey,
                    accordionChromeFromOptions(options)
                );
            }
            if (asAccordion) {
                return renderSectionAccordion(
                    options.title || groupCardTitle(groupKey, visibleFields),
                    withAppendedBody(renderSpecialFieldCard(visibleFields[0], config), options),
                    '',
                    groupKey,
                    accordionChromeFromOptions(options)
                );
            }
            return renderSpecialFieldCard(visibleFields[0], config);
        }

        var groupHtml = '';
        visibleFields.forEach(function (field) {
            if (!options.showLockedControls && field.locked && field.upgrade_feature && !isAppearanceUpgradeFeature(field.upgrade_feature)) {
                if (renderedUpgradeFeatures[field.upgrade_feature]) {
                    return;
                }
                renderedUpgradeFeatures[field.upgrade_feature] = true;
                groupHtml += renderUpgradeCard(
                    (builderUpgrade || {})[field.upgrade_feature],
                    upgradeUrl,
                    field.upgrade_feature
                );
                return;
            }
            if (isCompositeFieldType(field.type)) {
                if (asAccordion && field.type === 'outer_spacing') {
                    groupHtml += renderOuterSpacingInner(field, config);
                    return;
                }
                groupHtml += renderSpecialFieldCard(field, config);
                return;
            }
            groupHtml += renderField(field, config, layout);
        });

        if (!groupHtml) {
            return '';
        }

        if (visibleFields.length === 1 && !isCompositeFieldType(visibleFields[0].type)) {
            var singleField = visibleFields[0];
            if (singleField.locked && !options.showLockedControls) {
                return groupHtml;
            }
            var cardTitle = options.title || groupCardTitle(groupKey, visibleFields);
            var cardBody = '';
            if (!asAccordion) {
                cardBody += renderCardHeading(cardTitle);
            }
            if (singleField.hint) {
                cardBody += '<p class="grw-field__hint grw-field__hint--card">' + escHtml(singleField.hint) + '</p>';
            }
            cardBody += renderField(singleField, config, layout, { omitLabel: !options.title, omitHint: true });
            if (asAccordion) {
                var singleValue = accordionValueFromField(singleField, config);
                return renderSectionAccordion(cardTitle, withAppendedBody(cardBody, options), '', groupKey, accordionChromeFromOptions(options, singleValue ? {
                    value: singleValue.label,
                    valueKey: singleValue.key,
                } : {}));
            }
            return '<div class="grw-card" data-grwi-group="' + escHtml(groupKey) + '">' +
                '<div class="grw-card__body">' + withAppendedBody(cardBody, options) + '</div></div>';
        }

        var multiTitle = options.title || groupCardTitle(groupKey, visibleFields);
        if (asAccordion) {
            return renderSectionAccordion(multiTitle, withAppendedBody(groupHtml, options), '', groupKey, accordionChromeFromOptions(options));
        }
        return '<div class="grw-card" data-grwi-group="' + escHtml(groupKey) + '">' +
            '<div class="grw-card__body">' + renderCardHeading(multiTitle) + withAppendedBody(groupHtml, options) + '</div></div>';
    }

    function renderStyleSection(editor) {
        var builder = editor.builder || {};
        var config = editor.config || {};
        var layout = builder.layout || editor.layout || 'badge_card';
        var upgradeUrl = editor.upgrade_url || '';
        var renderedUpgradeFeatures = {};
        var groups = groupFields(builder.fields || [], 'style');
        var html = '<div class="grw-style-accordions" data-grwi-style-accordions data-grwi-exclusive-parents="style">';

        var themeBody = '';
        themeBody += '<p class="grw-field__hint">Basic styling: choose a light or dark theme.</p>';
        themeBody += renderFieldsHtml(groups.theme || [], config, layout, upgradeUrl, renderedUpgradeFeatures, builder.upgrade || {}, {
            fieldOptions: { omitLabel: true },
        });
        var themeField = (groups.theme || []).filter(function (field) { return field.key === 'theme'; })[0]
            || (groups.theme || [])[0];
        var themeValue = accordionValueFromField(themeField, config);
        html += renderSectionAccordion('Basic Appearance', themeBody, ' open', 'theme', themeValue ? {
            value: themeValue.label,
            valueKey: themeValue.key,
        } : {});

        var typographyBasic = renderFieldsHtml(groups.typography || [], config, layout, upgradeUrl, renderedUpgradeFeatures, builder.upgrade || {});
        var fontFamilyLabel = fontFamilySummaryLabel(config, groups.typography || []);
        html += renderSectionAccordion('Font Family', typographyBasic, '', 'typography', accordionChromeFromOptions({
            overflowVisible: true,
        }, fontFamilyLabel ? {
            value: fontFamilyLabel,
            valueKey: 'font_family_summary',
        } : {}));

        html += '<p class="grw-style-customize-hint">Looking for colours, spacing and typography? ' +
            '<button type="button" class="grw-style-customize-hint__link" data-grwi-open-section="customize">Open Customize</button>.</p>';

        html += '</div>';
        return html;
    }

    function renderInstall(widget, editor) {
        var shortcode = widget.shortcode || '';
        var embed = widget.embed_snippet || '';
        var embedWithoutScript = String(embed || '')
            .replace(/<script\b[^>]*\bsrc=(["'])[^"']*grwidget\.js[^"']*\1[^>]*>\s*<\/script>\s*/ig, '')
            .trim();
        var shortcodeBody = '<div class="grw-field">' +
            '<div class="grw-shortcode-field">' +
            '<input type="text" class="grw-shortcode-input" readonly value="' + escHtml(shortcode) + '" />' +
            '<button type="button" class="button button-small grw-copy-btn grw-copy-btn--install" data-copy="' + escHtml(shortcode) + '">Copy</button>' +
            '</div>' +
            '<p class="grw-field__hint">Paste this into the GR Widget block or any shortcode field. The plugin loads grwidget.js automatically.</p>' +
            '</div>';
        var html = '<div class="grw-style-accordions" data-grwi-section-accordions data-grwi-exclusive-parents="install">';
        html += renderSectionAccordion('WordPress Shortcode', shortcodeBody, ' open');
        if (embedWithoutScript) {
            var embedBody = '<div class="grw-field">' +
                '<div class="grw-embed-snippet-wrap">' +
                '<textarea class="grw-embed-snippet" readonly rows="4">' + escHtml(embedWithoutScript) + '</textarea>' +
                '<button type="button" class="button button-small grw-copy-btn grw-copy-btn--install" data-copy="' + escHtml(embedWithoutScript) + '">Copy</button>' +
                '</div>' +
                '<p class="grw-field__hint">For Custom HTML blocks or templates, paste only this container markup. Do not add a script tag.</p>' +
                '</div>';
            html += renderSectionAccordion('HTML Embed', embedBody);
        }
        html += '</div>';
        html += renderInstallCallout((editor && editor.install_prompt) || {}, editor);
        return html;
    }

    function installCalloutIconSvg() {
        return '<svg class="grw-install-callout__icon-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
            '<path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ' +
            'd="M2.25 15a4.5 4.5 0 0 0 4.5 4.5h11.25a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z"/>' +
            '</svg>';
    }

    function renderInstallCallout(installPrompt, editor) {
        if (!installPrompt || !installPrompt.body) {
            return '';
        }
        var cfg = window.grwiCustomize || {};
        var i18n = cfg.i18n || {};
        var title = String(installPrompt.title || '').trim();
        var body = String(installPrompt.body || '').trim();
        var mode = String(installPrompt.mode || '').trim();
        var cta = String(installPrompt.primary_label || '').trim();
        var eligible = installPrompt.trial_eligible;
        if (eligible === true || eligible === 1 || eligible === '1') {
            eligible = true;
        } else if (eligible === false || eligible === 0 || eligible === '0') {
            eligible = false;
        } else if (mode === 'link') {
            eligible = null;
        } else {
            eligible = customizeTrialEligibility(editor);
        }
        var plan = String(installPrompt.plan || 'site');
        var href = installPrompt.checkout_url || customizeCheckoutUrl(editor, eligible === true, plan) || '';
        var supporting = '';
        if (mode !== 'link') {
            supporting = installPrompt.supporting || trialSupportingCopy(plan, eligible, i18n, editor);
            if (eligible !== true && supporting.indexOf('$0 today') !== -1) {
                supporting = trialSupportingCopy(plan, eligible, i18n, editor);
            }
            if (eligible !== true) {
                supporting = String(supporting || '').replace(/\$0 today[^.]*\.\s*/g, '');
            }
        }
        if (!cta) {
            cta = mode === 'link'
                ? (i18n.linkLayoutCta || 'Link free account')
                : trialCtaLabel(plan, eligible, i18n, editor);
        }

        var html = '<aside class="grw-install-callout" role="note">';
        html += '<span class="grw-install-callout__icon" aria-hidden="true">' + installCalloutIconSvg() + '</span>';
        html += '<div class="grw-install-callout__content">';
        if (title) {
            html += '<p class="grw-install-callout__title">' + escHtml(title) + '</p>';
        }
        html += '<p class="grw-install-callout__text">' + escHtml(body) + '</p>';
        if (mode === 'link') {
            html += '<button type="button" class="grw-install-callout__btn" data-grwi-connect-account>' +
                escHtml(cta) + '</button>';
        } else if (href || cta) {
            html += '<button type="button" class="grw-install-callout__btn" data-grwi-trial-cta="1"' +
                ' data-feature="review_limit" data-plan="' + escHtml(plan) + '"' +
                ' data-trial-eligible="' + (eligible === null ? '' : (eligible ? '1' : '0')) + '"' +
                ' data-checkout-url="' + escHtml(href) + '"' +
                ' data-feature-label="more reviews"' +
                ' data-modal-title="' + escHtml(title || 'Unlock more reviews') + '"' +
                ' data-modal-body="' + escHtml(body) + '"' +
                ' data-modal-supporting="' + escHtml(supporting) + '">' +
                escHtml(cta) + '</button>';
        }
        html += '</div></aside>';
        return html;
    }

    function normalizeLayoutEntitlement(raw) {
        var value = String(raw || '').toLowerCase();
        if (value === 'link_account') {
            return 'linked_free';
        }
        if (value === 'linked_free' || value === 'site' || value === 'unlinked' || value === 'business') {
            return value;
        }
        return value || 'site';
    }

    function layoutCatalogByKey(editor) {
        var cfg = window.grwiCustomize || {};
        var catalog = (editor.builder && editor.builder.layout_catalog)
            || cfg.layoutCatalog
            || [];
        var map = {};
        (Array.isArray(catalog) ? catalog : []).forEach(function (row) {
            var key = String((row && row.key) || '').trim();
            if (!key) {
                return;
            }
            map[key] = row;
        });
        return map;
    }

    function layoutPickerSections(editor) {
        var cfg = window.grwiCustomize || {};
        var sections = (editor.builder && editor.builder.layout_sections)
            || cfg.layoutSections
            || {};
        if (Array.isArray(sections)) {
            return sections;
        }
        return Object.keys(sections).map(function (key) {
            var section = sections[key] || {};
            return {
                id: key,
                title: section.title || key,
                hint: section.hint || '',
                layouts: section.layouts || [],
            };
        });
    }

    function renderLayoutCardHtml(layoutKey, meta, selectedLayout, theme) {
        var i18nLocal = (window.grwiCustomize && window.grwiCustomize.i18n) || {};
        var label = String((meta && meta.label) || layoutKey);
        var family = String((meta && meta.family) || String(layoutKey).split('_')[0] || 'badge');
        var locked = !!(meta && meta.locked);
        var entitlement = normalizeLayoutEntitlement((meta && meta.entitlement) || (locked ? 'site' : 'unlinked'));
        var selected = selectedLayout === layoutKey;
        var classes = ['grw-layout-card', 'grw-customize-layout-card'];
        var attrs = ' data-grwi-layout-card="1" data-layout="' + escHtml(layoutKey) + '"' +
            ' data-layout-label="' + escHtml(label) + '"' +
            ' data-entitlement="' + escHtml(entitlement) + '"';

        if (locked && !selected) {
            classes.push('grw-layout-card--locked');
            classes.push('grw-layout-card--entitlement-' + entitlement);
            var planName = entitlement === 'linked_free'
                ? (i18nLocal.freeWithAccount || 'FREE WITH ACCOUNT')
                : (entitlement === 'business'
                    ? (i18nLocal.businessPlan || 'BUSINESS PLAN')
                    : (i18nLocal.sitePlan || 'SITE PLAN'));
            attrs += ' role="button" tabindex="0" aria-label="' +
                escHtml(label + ', ' + planName + '. Activating this layout explains how to unlock it.') + '"';
        } else {
            classes.push('grw-layout-card--selectable');
            if (selected) {
                classes.push('grw-layout-card--selected');
            }
            attrs += ' role="button" tabindex="0"';
        }

        var badge = '';
        var icon = '';
        if (locked && !selected) {
            // Entitlement badges only — no duplicate orange UPGRADE pill on Layout cards.
            if (entitlement === 'linked_free') {
                badge = '<span class="grw-layout-card__pill grw-admin-badge grw-admin-badge--free-account">' +
                    escHtml(i18nLocal.freeWithAccount || 'FREE WITH ACCOUNT') + '</span>';
                icon = '<span class="grw-layout-card__icon grw-layout-card__icon--account"></span>';
            } else if (entitlement === 'business') {
                badge = '<span class="grw-layout-card__pill grw-admin-badge grw-admin-badge--site">' +
                    escHtml(i18nLocal.businessPlan || 'BUSINESS PLAN') + '</span>';
                icon = '<span class="grw-layout-card__icon grw-layout-card__icon--lock"></span>';
            } else {
                badge = '<span class="grw-layout-card__pill grw-admin-badge grw-admin-badge--site">' +
                    escHtml(i18nLocal.sitePlan || 'SITE PLAN') + '</span>';
                icon = '<span class="grw-layout-card__icon grw-layout-card__icon--lock"></span>';
            }
        } else if (selected) {
            badge = '<span class="grw-layout-card__selected-pill">' + escHtml(i18nLocal.selected || 'Selected') + '</span>';
        }

        return '<div class="' + classes.join(' ') + '"' + attrs + '>' +
            '<span class="grw-layout-card__header" aria-hidden="true">' + badge + icon + '</span>' +
            '<span class="grw-layout-card__preview grw-layout-card__preview--theme-' + escHtml(theme) +
            ' grw-layout-card__preview--' + escHtml(family) +
            ' grw-layout-card__preview--' + escHtml(layoutKey) + '">' +
            '<span class="grw-layout-card__mock" data-layout="' + escHtml(layoutKey) +
            '" data-preview-theme="' + escHtml(theme) + '" role="img" aria-label="' + escHtml(label) + '">' +
            '<span class="grw-layout-card__stage" data-grw-layout-stage aria-hidden="true">' +
            '<span class="grw-layout-card__target" data-grw-layout-target></span>' +
            '</span></span></span>' +
            '<span class="grw-layout-card__label">' + escHtml(label) + '</span>' +
            '</div>';
    }

    function renderLayoutSection(editor) {
        var builder = editor.builder || {};
        var selectedLayout = builder.layout || editor.layout || 'badge_card';
        var cfg = window.grwiCustomize || {};
        var theme = String(builder.layout_preview_theme || cfg.layoutPreviewTheme || 'light');
        var catalog = layoutCatalogByKey(editor);
        var sections = layoutPickerSections(editor);
        var i18nLocal = cfg.i18n || {};
        var upgradeUrl = editor.upgrade_url || cfg.upgradeUrl || '';
        var html = '<div class="grw-customize-layout" data-grwi-layout-picker>';
        var hasLocked = false;

        if (!sections.length) {
            html += '<p class="grw-hint">No layouts available.</p></div>';
            return html;
        }

        sections.forEach(function (section) {
            var layouts = section.layouts || [];
            if (!layouts.length) {
                return;
            }
            html += '<section class="grw-layout-category grw-customize-layout__category" aria-label="' + escHtml(section.title || '') + '">';
            html += '<header class="grw-layout-category__head">';
            html += '<p class="grw-layout-category__title">' + escHtml(section.title || '') + '</p>';
            if (section.hint) {
                html += '<p class="grw-layout-category__hint">' + escHtml(section.hint) + '</p>';
            }
            html += '</header>';
            html += '<div class="grw-layout-picker grw-customize-layout__grid">';
            layouts.forEach(function (layoutKey) {
                var meta = catalog[layoutKey] || { key: layoutKey, label: layoutKey, locked: false, entitlement: 'unlinked' };
                if (meta.locked) {
                    hasLocked = true;
                }
                html += renderLayoutCardHtml(layoutKey, meta, selectedLayout, theme);
            });
            html += '</div></section>';
        });

        if (hasLocked) {
            var layoutEligible = customizeTrialEligibility(editor);
            var selectedMeta = catalog[selectedLayout] || {};
            var selectedLocked = !!selectedMeta.locked;
            var layoutFeature = (selectedLocked && LAYOUT_FEATURE_SLUGS[selectedLayout])
                ? LAYOUT_FEATURE_SLUGS[selectedLayout]
                : 'premium_layouts';
            var layoutPrompt = {};
            if (selectedLocked && editor.layout_prompts && editor.layout_prompts[selectedLayout]) {
                layoutPrompt = editor.layout_prompts[selectedLayout];
            } else {
                layoutPrompt = featurePromptFromEditor(editor, 'premium_layouts');
            }
            var selectedEntitlement = normalizeLayoutEntitlement((selectedMeta && selectedMeta.entitlement) || 'site');
            var checkoutPlan = selectedEntitlement === 'business' ? 'business' : 'site';
            var layoutCheckoutUrl = layoutPrompt.checkout_url
                || customizeCheckoutUrl(editor, layoutEligible === true, checkoutPlan)
                || upgradeUrl;
            var hint = editor.layout_upgrade_hint
                || (cfg.layoutUpgradeHint)
                || (layoutEligible === null
                    ? (i18nLocal.layoutUpgradeHintUnlinked || 'Link Free for 17 more layouts · Site unlocks 31')
                    : (i18nLocal.layoutUpgradeHint || 'Unlock 31 layouts with Site'));
            var layoutModalTitle = layoutPrompt.title || 'Unlock more layouts with Site';
            var layoutModalBody = layoutPrompt.body
                || 'Site includes 31 layouts, up to 30 reviews, reviewer photos, filters, bi-weekly syncing and full design control.';
            if (layoutCheckoutUrl || hint) {
                html += '<p class="grw-customize-layout__upgrade-hint"><button type="button" class="button-link" data-grwi-trial-cta="1"' +
                    ' data-feature="' + escHtml(layoutPrompt.feature || layoutFeature) + '" data-plan="' + escHtml(checkoutPlan) + '"' +
                    (selectedLocked ? ' data-layout="' + escHtml(selectedLayout) + '"' : '') +
                    ' data-trial-eligible="' + (layoutEligible === null ? '' : (layoutEligible ? '1' : '0')) + '"' +
                    ' data-checkout-url="' + escHtml(layoutCheckoutUrl) + '"' +
                    ' data-feature-label="more layouts"' +
                    ' data-modal-title="' + escHtml(layoutModalTitle) + '"' +
                    ' data-modal-body="' + escHtml(layoutModalBody) + '"' +
                    ' data-modal-supporting="' + escHtml(trialSupportingCopy(checkoutPlan, layoutEligible, i18nLocal, editor)) + '">' +
                    escHtml(hint) +
                    '</button></p>';
            }
        }

        html += '</div>';
        return html;
    }

    function aiCheckboxDefaultOn(field, config) {
        var key = field && field.key;
        var defaultsOn = {
            ai_summary_typing_animation: true,
            ai_summary_picture_animation: true,
            flyout_show_ai_summary: true
        };
        if (defaultsOn[key] && (config[key] === undefined || config[key] === null || config[key] === '')) {
            return true;
        }
        return config[key] === true || config[key] === 1 || config[key] === '1';
    }

    function renderAiSummaryHiddenFields(config) {
        var pairs = [
            ['ai_summary_text', ''],
            ['ai_summary_list', ''],
            ['ai_summary_regenerated_at', ''],
            ['ai_summary_review_count', '0']
        ];
        return pairs.map(function (pair) {
            var val = config[pair[0]];
            if (val == null || val === '') {
                val = pair[1];
            }
            return '<input type="hidden" data-config-key="' + escHtml(pair[0]) + '" value="' + escHtml(String(val)) + '" />';
        }).join('');
    }

    function renderAiSummaryTypographyRow(builder, config, labelFields) {
        var typoFields = (labelFields || []).filter(function (field) {
            return String(field.key || '').indexOf('typo_ai_summary_label_') === 0;
        });
        if (!typoFields.length) {
            return '';
        }
        var typography = builder.typography || {};
        var locked = typoFields.some(function (field) { return !!field.locked; });
        var roleMeta = {
            role: 'ai_summary_label',
            label: 'Label Typography',
            size_key: 'typo_ai_summary_label_size',
            color_key: 'typo_ai_summary_label_color',
            weight_key: 'typo_ai_summary_label_weight',
            locked: locked,
            upgrade_feature: 'ai_summary',
        };
        return renderCardHeading('Label typography') +
            renderTypographyRoleRow(roleMeta, typography, config, readEditor(), { bare: true });
    }

    function renderAiSummaryFieldsHtml(fields, config, layout, upgradeUrl, renderedUpgradeFeatures, builder) {
        return renderFieldsHtml(fields, config, layout, upgradeUrl, renderedUpgradeFeatures, builder.upgrade || {}, {
            showLockedControls: true,
        });
    }

    function renderAiSummarySection(editor, groups, config, layout, upgradeUrl, renderedUpgradeFeatures, builder, aiLocked) {
        var allAi = [];
        ['ai_enable', 'ai_style', 'ai_label', 'ai_stars', 'ai_content', 'ai_panel', 'ai'].forEach(function (groupKey) {
            allAi = allAi.concat(groups[groupKey] || []);
        });
        var enableField = allAi.filter(function (field) { return field.key === 'ai_summary_enabled'; })[0];
        var styleFields = allAi.filter(function (field) {
            return field.key === 'ai_summary_style' || field.key === 'ai_summary_typing_animation' || field.key === 'ai_summary_picture_animation';
        });
        var labelFields = allAi.filter(function (field) {
            return field.key === 'ai_summary_label' || String(field.key || '').indexOf('typo_ai_summary_label_') === 0;
        });
        var starFields = allAi.filter(function (field) {
            return String(field.key || '').indexOf('ai_summary_star_') === 0;
        });
        var premiumPreview = fieldIsPremiumPreview({ locked: aiLocked, upgrade_feature: 'ai_summary' });
        var accordionChrome = accordionChromeFromOptions({
            locked: !!aiLocked && !premiumPreview,
            premiumPreview: !!premiumPreview,
            plan: 'business',
        });

        var enableHtml = '';
        if (enableField) {
            if (aiLocked) {
                enableField = $.extend({}, enableField, { locked: true, upgrade_feature: 'ai_summary' });
            }
            enableHtml = '<div data-grwi-ai-enable-toggle="1">' + renderField(enableField, config, layout) + '</div>';
        }

        var styleHtml = '';
        styleFields.forEach(function (field) {
            var extra = {};
            if (field.key === 'ai_summary_typing_animation' || field.key === 'ai_summary_picture_animation') {
                extra.checked = aiCheckboxDefaultOn(field, config);
            }
            styleHtml += renderField(field, config, layout, extra);
        });

        var labelTextFields = labelFields.filter(function (field) {
            return String(field.key || '').indexOf('typo_ai_summary_label_') !== 0;
        });
        var labelHtml = renderAiSummaryFieldsHtml(labelTextFields, config, layout, upgradeUrl, renderedUpgradeFeatures, builder) +
            renderAiSummaryTypographyRow(builder, config, labelFields);

        var starHtml = renderAiSummaryFieldsHtml(starFields, config, layout, upgradeUrl, renderedUpgradeFeatures, builder);

        var childHtml = '';
        childHtml += renderFeatureChildAccordion('Summary Style', styleHtml, '', 'ai_style');
        childHtml += renderFeatureChildAccordion('Summary Label', labelHtml, '', 'ai_label');
        childHtml += renderFeatureChildAccordion('Summary Stars', starHtml, '', 'ai_stars');

        var parentBody = enableHtml +
            wrapFeatureChildren(childHtml, {
                attrs: ' data-grwi-ai-summary-controls',
                offTooltip: 'Turn on Show AI summary card to customise these options.',
            }) +
            renderAiSummaryHiddenFields(config);

        var accordionHtml = renderFeatureGroup('AI Review Summary', parentBody, '', 'ai', accordionChrome);
        var controls = '<div class="grw-style-accordions" data-grwi-section-accordions data-grwi-exclusive-parents="ai-summary">' + accordionHtml + '</div>';
        if (aiLocked && !premiumPreview) {
            controls = '<div class="grw-customize-panel grw-customize-panel--locked" data-grwi-ai-summary-locked="1" aria-disabled="true">' +
                controls +
            '</div>';
        }

        return '<div class="grw-ai-summary-stack">' +
            controls +
            '</div>' +
            (aiLocked && !premiumPreview ? renderUpgradeCard(builder.upgrade && builder.upgrade.ai_summary, upgradeUrl, 'ai_summary') : '');
    }

    function renderPanelSection(editor, groups, config, layout, upgradeUrl, renderedUpgradeFeatures) {
        var builder = editor.builder || {};
        var upgrade = builder.upgrade || {};
        var showFields = groups.panel_show || [];
        var styleFields = groups.panel_style || [];
        var colorFields = groups.panel_colors || [];
        var contentFields = groups.panel_content || [];
        var buttonKeys = {
            flyout_show_write_review_button: true,
            show_view_on_google_in_flyout: true,
        };
        var appearanceFields = [];
        var restContent = [];
        var buttonFields = [];
        var aiFields = [];
        var photoFields = [];
        contentFields.forEach(function (field) {
            var key = String(field.key || '');
            if (key === 'flyout_show_ai_summary') {
                aiFields.push(field);
                return;
            }
            if (key === 'flyout_show_review_photos' || key === 'flyout_review_image_filter') {
                photoFields.push(field);
                return;
            }
            if (buttonKeys[key]) {
                buttonFields.push(field);
                return;
            }
            restContent.push(field);
        });

        var enableField = showFields.filter(function (field) { return field.key === 'flyout_enabled'; })[0];
        var otherShowFields = showFields.filter(function (field) { return field.key !== 'flyout_enabled'; });
        var parentOn = !(config.flyout_enabled === false || config.flyout_enabled === 0 || config.flyout_enabled === '0' || config.flyout_enabled === '');
        var behaviourFields = styleFields.filter(function (field) {
            return field.key === 'flyout_use_domain_default' || field.key === 'review_panel_mode';
        });
        appearanceFields = styleFields.filter(function (field) {
            return field.key === 'flyout_theme';
        });
        var leftoverStyle = styleFields.filter(function (field) {
            return field.key !== 'flyout_use_domain_default'
                && field.key !== 'review_panel_mode'
                && field.key !== 'flyout_theme';
        });

        var parentBody = '';
        if (enableField) {
            parentBody += '<div data-grwi-panel-enable-toggle="1">' + renderField(enableField, config, layout) + '</div>';
        }
        parentBody += renderFieldsHtml(otherShowFields, config, layout, upgradeUrl, renderedUpgradeFeatures, upgrade, {
            showLockedControls: true,
        });

        var children = '';
        var behaviourHtml = renderFieldsHtml(behaviourFields.concat(leftoverStyle), config, layout, upgradeUrl, renderedUpgradeFeatures, upgrade, {
            showLockedControls: true,
        });
        children += renderFeatureChildAccordion('Panel Behaviour', behaviourHtml, '', 'panel_behaviour');
        var appearanceHtml = renderFieldsHtml(appearanceFields, config, layout, upgradeUrl, renderedUpgradeFeatures, upgrade, {
            showLockedControls: true,
        });
        children += renderFeatureChildAccordion('Basic Appearance', appearanceHtml, '', 'panel_appearance');
        var colorsHtml = renderFieldsHtml(colorFields, config, layout, upgradeUrl, renderedUpgradeFeatures, upgrade, {
            showLockedControls: true,
        });
        var siteGated = !editor.can_use_builder_customize;
        var typoLocked = !!(builder.typography && builder.typography.roles_locked);
        var colorsLocked = siteGated || colorFields.some(function (field) { return !!field.locked; });
        var colorsPreview = colorFields.some(function (field) { return fieldIsPremiumPreview(field); });
        var contentLocked = siteGated || typoLocked || restContent.some(function (field) { return !!field.locked; });
        var contentPreview = restContent.some(function (field) { return fieldIsPremiumPreview(field); });
        var buttonsLocked = siteGated || typoLocked || buttonFields.some(function (field) { return !!field.locked; });
        var buttonsPreview = buttonFields.some(function (field) { return fieldIsPremiumPreview(field); });
        if (colorsHtml) {
            children += renderFeatureChildAccordion('Panel Colours', colorsHtml, '', 'panel_colors', accordionChromeFromOptions({
                locked: colorsLocked && !colorsPreview,
                premiumPreview: colorsPreview && colorsLocked,
                plan: 'site',
            }));
        }

        var contentHtml = renderFieldsHtml(restContent, config, layout, upgradeUrl, renderedUpgradeFeatures, upgrade, {
            showLockedControls: true,
        });
        var typography = builder.typography || {};
        contentHtml += renderTypographyRoleBare(typography, 'flyout_label', config, layout, { ignoreVisibility: true });
        contentHtml += renderTypographyRoleBare(typography, 'flyout_heading', config, layout, { ignoreVisibility: true });
        contentHtml += renderTypographyRoleBare(typography, 'review_text', config, layout, { ignoreVisibility: true });
        contentHtml += renderTypographyRoleBare(typography, 'review_author', config, layout, { ignoreVisibility: true });
        contentHtml += renderTypographyRoleBare(typography, 'review_date', config, layout, { ignoreVisibility: true });
        if (contentHtml) {
            children += renderFeatureChildAccordion('Panel Content', contentHtml, '', 'panel_content', accordionChromeFromOptions({
                locked: contentLocked && !contentPreview,
                premiumPreview: contentPreview && contentLocked,
                plan: 'site',
            }));
        }

        var buttonsHtml = renderFieldsHtml(buttonFields, config, layout, upgradeUrl, renderedUpgradeFeatures, upgrade, {
            showLockedControls: true,
        });
        buttonsHtml += renderTypographyRoleBare(typography, 'button', config, layout, { ignoreVisibility: true });
        buttonsHtml += renderTypographyRoleBare(typography, 'link', config, layout, { ignoreVisibility: true });
        if (buttonsHtml) {
            children += renderFeatureChildAccordion('Panel Buttons', buttonsHtml, '', 'panel_buttons', accordionChromeFromOptions({
                locked: buttonsLocked && !buttonsPreview,
                premiumPreview: buttonsPreview && buttonsLocked,
                plan: 'site',
            }));
        }

        if (aiFields.length) {
            var aiLocked = aiFields.some(function (field) { return !!field.locked; });
            var aiPreview = aiFields.some(function (field) { return fieldIsPremiumPreview(field); });
            var aiHtml = renderFieldsHtml(aiFields, config, layout, upgradeUrl, renderedUpgradeFeatures, upgrade, {
                showLockedControls: true,
            });
            children += renderFeatureChildAccordion('AI Summary', aiHtml, '', 'panel_ai', accordionChromeFromOptions({
                locked: aiLocked && !aiPreview,
                premiumPreview: aiPreview && aiLocked,
                plan: 'business',
            }));
        }

        if (photoFields.length) {
            var photosLocked = photoFields.some(function (field) { return !!field.locked; });
            var photosPreview = photoFields.some(function (field) { return fieldIsPremiumPreview(field); });
            var photosHtml = '';
            photoFields.forEach(function (field) {
                photosHtml += renderField(
                    photosLocked && field.show_when ? copyFieldForLockedDisplay(field) : field,
                    config,
                    layout
                );
            });
            children += renderFeatureChildAccordion('Review Photos', photosHtml, '', 'panel_photos', accordionChromeFromOptions({
                locked: photosLocked && !photosPreview,
                premiumPreview: photosPreview && photosLocked,
                plan: 'business',
            }));
        }

        parentBody += wrapFeatureChildren(children, {
            attrs: ' data-grwi-panel-controls',
            offTooltip: parentOn ? '' : 'Turn on Show review panel to customise these options.',
        });

        var parentValue = accordionValueFromField(styleFields.filter(function (field) {
            return field.key === 'review_panel_mode';
        })[0], config);
        var accordionHtml = renderFeatureGroup('Review Panel', parentBody, '', 'panel_show', parentValue ? {
            value: parentValue.label,
            valueKey: parentValue.key,
        } : {});
        return wrapSectionAccordions(accordionHtml, 'panel');
    }

    function isReviewerAvatarField(field) {
        return !!(field && (field.upgrade_feature === 'reviewer_avatars' || /_show_author_avatar$/.test(String(field.key || ''))));
    }

    function isUploadedReviewPhotoField(field) {
        return !!(field && (field.upgrade_feature === 'review_photos' || /_show_review_photos$/.test(String(field.key || '')) || /_review_image_filter$/.test(String(field.key || ''))));
    }

    function copyFieldForLockedDisplay(field) {
        var spec = {};
        Object.keys(field || {}).forEach(function (key) {
            spec[key] = field[key];
        });
        delete spec.show_when;
        return spec;
    }

    function renderLockedFeatureAccordion(title, fields, editor, config, layout, groupKey, featureKey, plan, renderedUpgradeFeatures) {
        if (!fields.length) {
            return '';
        }
        var locked = fields.some(function (field) { return !!field.locked; });
        var body = '';
        fields.forEach(function (field) {
            body += renderField(locked && field.show_when ? copyFieldForLockedDisplay(field) : field, config, layout);
        });
        if (locked && !editorIsPreviewFirst()) {
            renderedUpgradeFeatures[featureKey] = true;
            body += renderUpsellCard(editor, featureKey);
        }
        return renderSectionAccordion(title, body, '', groupKey, accordionChromeFromOptions({
            locked: locked,
            plan: plan,
        }));
    }

    function renderUploadedPhotosAccordion(title, fields, editor, config, layout, groupKey, featureKey, plan, renderedUpgradeFeatures) {
        if (!fields.length) {
            return '';
        }
        var locked = fields.some(function (field) { return !!field.locked; });
        var showFields = fields.filter(function (field) {
            return /_show_review_photos$/.test(String(field.key || ''));
        });
        var filterFields = fields.filter(function (field) {
            return /_review_image_filter$/.test(String(field.key || ''));
        });
        var leftover = fields.filter(function (field) {
            return showFields.indexOf(field) < 0 && filterFields.indexOf(field) < 0;
        });
        var body = '';
        showFields.concat(leftover).forEach(function (field) {
            body += renderField(locked && field.show_when ? copyFieldForLockedDisplay(field) : field, config, layout);
        });
        var filterHtml = '';
        filterFields.forEach(function (field) {
            filterHtml += renderField(locked && field.show_when ? copyFieldForLockedDisplay(field) : field, config, layout);
        });
        body += renderNestedGroups([{ title: 'Photo Filtering', html: filterHtml, key: 'photo_filtering' }]);
        if (locked && !editorIsPreviewFirst()) {
            renderedUpgradeFeatures[featureKey] = true;
            body += renderUpsellCard(editor, featureKey);
        }
        return renderSectionAccordion(title, body, '', groupKey, accordionChromeFromOptions({
            locked: locked,
            plan: plan,
        }));
    }

    function renderReviewPhotosAccordion(editor, groups, config, layout, upgradeUrl, renderedUpgradeFeatures) {
        var avatarFields = (groups.reviewer_avatars || []).filter(function (field) {
            return isReviewerAvatarField(field) && fieldVisible(field, config, layout);
        });
        var photoFields = (groups.review_photos || []).filter(function (field) {
            if (isReviewerAvatarField(field) || !isUploadedReviewPhotoField(field)) {
                return false;
            }
            if (fieldVisible(field, config, layout)) {
                return true;
            }
            return !!field.locked && !!field.show_when && (!field.layouts || !field.layouts.length || field.layouts.indexOf(layout) >= 0);
        });
        return renderLockedFeatureAccordion(
            GROUP_LABELS.reviewer_avatars,
            avatarFields,
            editor,
            config,
            layout,
            'reviewer_avatars',
            'reviewer_avatars',
            'site',
            renderedUpgradeFeatures
        ) + renderUploadedPhotosAccordion(
            GROUP_LABELS.review_photos,
            photoFields,
            editor,
            config,
            layout,
            'review_photos',
            'review_photos',
            'business',
            renderedUpgradeFeatures
        );
    }

    function collectPlacementFields(groups, builder) {
        var placementKeys = ['placement', 'display_mode', 'float_position', 'device_visibility', 'float_offsets'];
        var placementFieldKeys = {
            widget_display_mode: true,
            widget_float_position: true,
            widget_device_visibility: true,
            widget_float_offsets: true,
            widget_align: true
        };
        var fields = [];
        var seen = {};
        placementKeys.forEach(function (key) {
            (groups[key] || []).forEach(function (field) {
                if (!field || !field.key || seen[field.key]) {
                    return;
                }
                seen[field.key] = true;
                fields.push(field);
            });
        });
        (builder.fields || []).forEach(function (field) {
            if (!field || !placementFieldKeys[field.key] || seen[field.key]) {
                return;
            }
            if (field.section && field.section !== 'settings' && field.section !== 'options') {
                return;
            }
            seen[field.key] = true;
            fields.push(field);
        });
        return fields;
    }

    function renderSettingsSection(editor, groups, config, layout, upgradeUrl, renderedUpgradeFeatures) {
        var builder = editor.builder || {};
        var upgrade = builder.upgrade || {};
        var html = '';
        var placementFields = collectPlacementFields(groups, builder);
        var placementBody = renderFieldsHtml(placementFields, config, layout, upgradeUrl, renderedUpgradeFeatures, upgrade, {
            showLockedControls: true,
            compositeAsInner: true,
        });
        var positionHtml = renderPositionFields(builder.position_fields, config, layout, { asInner: true });
        var orderHtml = renderElementOrder(builder.element_order, config, { asInner: true });
        if (placementBody || positionHtml || orderHtml) {
            var displayField = placementFields.filter(function (field) {
                return field.key === 'widget_display_mode';
            })[0];
            var displayValue = accordionValueFromField(displayField, config);
            html += renderSectionAccordion('Placement', placementBody + positionHtml + orderHtml, '', 'placement', displayValue ? {
                value: displayValue.label,
                valueKey: displayValue.key,
            } : {});
        }
        html += renderGroupCard('widget_width', groups.widget_width || [], config, layout, upgradeUrl, renderedUpgradeFeatures, upgrade, {
            asAccordion: true,
            title: 'Width',
        });
        html += renderGroupCard('outer_spacing', groups.outer_spacing || [], config, layout, upgradeUrl, renderedUpgradeFeatures, upgrade, {
            asAccordion: true,
        });
        var jsonFields = groups.json_ld || [];
        var jsonLocked = jsonFields.some(function (field) {
            return !!field.locked && fieldVisible(field, config, layout);
        });
        html += renderGroupCard('json_ld', jsonFields, config, layout, upgradeUrl, renderedUpgradeFeatures, upgrade, {
            asAccordion: true,
            showLockedControls: true,
            locked: jsonLocked,
            plan: 'business',
            title: GROUP_LABELS.json_ld,
            bodyPrepend: jsonLdExplainerFigureHtml(editor, jsonFields[0] || null),
            bodyAppend: jsonLocked && !editorIsPreviewFirst() ? renderUpsellCard(editor, 'json_ld') : '',
        });
        var legacyPhotoFields = groups.photos || [];
        if (legacyPhotoFields.length) {
            var photosLocked = legacyPhotoFields.some(function (field) {
                return !!field.locked && fieldVisible(field, config, layout);
            });
            html += renderGroupCard('photos', legacyPhotoFields, config, layout, upgradeUrl, renderedUpgradeFeatures, upgrade, {
            asAccordion: true,
            showLockedControls: true,
                locked: photosLocked,
            plan: 'business',
                bodyAppend: photosLocked && !editorIsPreviewFirst() ? renderUpsellCard(editor, 'review_photos') : '',
        });
        }
        return wrapSectionAccordions(html, 'settings');
    }

    function renderSectionBody(sectionId, editor) {
        editor = editor || {};
        activeEditorRef = editor;
        var builder = editor.builder || {};
        var config = editor.config || {};
        var layout = builder.layout || editor.layout || 'badge_card';
        var upgradeUrl = editor.upgrade_url || '';
        var canCustomize = !!editor.can_use_builder_customize;
        var section = (builder.sections || []).find(function (s) { return s.id === sectionId; }) || {};
        var aiLocked = !!(builder.ai_summary && builder.ai_summary.locked);
        var customizeLocked = sectionId === 'customize' && (!canCustomize || !!section.locked);
        var useAccordions = !!SECTION_ACCORDION_IDS[sectionId];
        if (sectionId === 'style' || SECTION_ACCORDION_IDS[sectionId]) {
            setExclusiveParentDetailsName('grwi-' + sectionId);
        } else {
            setExclusiveParentDetailsName('');
        }

        // Hard-block only non-explore gated sections (filters/customize/AI stay explorative).
        if (section.locked && section.upgrade_feature
            && sectionId !== 'customize'
            && sectionId !== 'ai-summary') {
            return renderUpgradeCard(
                (builder.upgrade || {})[section.upgrade_feature],
                upgradeUrl,
                section.upgrade_feature
            );
        }

        if (sectionId === 'install') {
            return renderInstall(editor.widget || {}, editor);
        }

        if (sectionId === 'layout') {
            return renderLayoutSection(editor);
        }

        if (sectionId === 'style') {
            return renderStyleSection(editor);
        }

        var html = '';
        var accordionHtml = '';
        if (sectionId === 'options') {
            html += '<div class="grw-callout grw-callout--info"><p><strong>' + escHtml(builder.layout_label || layout) +
                '</strong> — Adjust placement and display options below, then save.</p></div>';
            accordionHtml += renderPositionFields(builder.position_fields, config, layout, { asAccordion: true });
            accordionHtml += renderElementOrder(builder.element_order, config, { asAccordion: true });
        }

        // Track upgrade cards already rendered in this section so a group with several
        // locked fields sharing the same upgrade_feature (e.g. the three "filters" fields:
        // min_rating, filter_keywords, filter_exclude_keywords) renders ONE upgrade card
        // instead of one per locked field.
        var renderedUpgradeFeatures = {};
        var groups = groupFields(builder.fields || [], sectionId);
        var groupOrder = groups.__order || Object.keys(groups).filter(function (key) { return key !== '__order'; });
        var groupOptions = useAccordions ? { asAccordion: true } : {};

        if (sectionId === 'ai-summary') {
            return renderAiSummarySection(editor, groups, config, layout, upgradeUrl, renderedUpgradeFeatures, builder, aiLocked);
        }

        if (sectionId === 'panel') {
            return renderPanelSection(editor, groups, config, layout, upgradeUrl, renderedUpgradeFeatures);
        }

        if (sectionId === 'settings') {
            return renderSettingsSection(editor, groups, config, layout, upgradeUrl, renderedUpgradeFeatures);
        }

        if (sectionId === 'customize') {
            return renderCustomizeSection(editor);
        }

        groupOrder.forEach(function (groupKey) {
            if (groupKey === 'branding') {
                return;
            }
            if (sectionId === 'reviews' && (groupKey === 'review_photos' || groupKey === 'reviewer_avatars')) {
                return;
            }
            var cardOptions = groupOptions;
            if (sectionId === 'reviews' && groupKey === 'filters') {
                var filterFields = groups[groupKey] || [];
                var filtersLocked = filterFields.some(function (field) {
                    return !!field.locked && field.upgrade_feature === 'filters';
                });
                var extra = {};
                if (filtersLocked) {
                    extra.locked = true;
                    extra.plan = 'site';
                } else {
                    var sortField = filterFields.filter(function (field) {
                        return field.key === 'review_sort';
                    })[0];
                    var sortValue = accordionValueFromField(sortField, config);
                    if (sortValue) {
                        extra.value = sortValue.label;
                        extra.valueKey = sortValue.key;
                    }
                }
                var sortHtml = renderFieldsHtml(fieldsByKeys(filterFields, ['review_sort', 'review_sort_dir']), config, layout, upgradeUrl, renderedUpgradeFeatures, builder.upgrade || {}, {
                    showLockedControls: true,
                });
                var ratingHtml = renderFieldsHtml(fieldsByKeys(filterFields, ['min_rating']), config, layout, upgradeUrl, renderedUpgradeFeatures, builder.upgrade || {}, {
                    showLockedControls: true,
                });
                var keywordHtml = renderFieldsHtml(fieldsByKeys(filterFields, ['filter_keywords', 'filter_exclude_keywords']), config, layout, upgradeUrl, renderedUpgradeFeatures, builder.upgrade || {}, {
                    showLockedControls: true,
                });
                var leftoverFilters = fieldsExceptKeys(filterFields, ['review_sort', 'review_sort_dir', 'min_rating', 'filter_keywords', 'filter_exclude_keywords', 'filter_reviewers']);
                keywordHtml += renderFieldsHtml(leftoverFilters, config, layout, upgradeUrl, renderedUpgradeFeatures, builder.upgrade || {}, {
                    showLockedControls: true,
                });
                var reviewerHtml = renderFieldsHtml(fieldsByKeys(filterFields, ['filter_reviewers']), config, layout, upgradeUrl, renderedUpgradeFeatures, builder.upgrade || {}, {
                    showLockedControls: true,
                });
                var filterBody = renderNestedGroups([
                    { title: 'Sort Order', html: sortHtml, key: 'filter_sort' },
                    { title: 'Rating Filter', html: ratingHtml, key: 'filter_rating' },
                    { title: 'Keyword Filters', html: keywordHtml, key: 'filter_keywords' },
                    { title: 'Reviewer Filters', html: reviewerHtml, key: 'filter_reviewers' },
                ]);
                if (filtersLocked && !editorIsPreviewFirst()) {
                    renderedUpgradeFeatures.filters = true;
                    filterBody += renderUpsellCard(editor, 'filters');
                }
                accordionHtml += renderSectionAccordion(
                    GROUP_LABELS.filters,
                    filterBody,
                    '',
                    'filters',
                    accordionChromeFromOptions(groupOptions, extra)
                );
                return;
            }
            if (sectionId === 'reviews' && groupKey === 'limits') {
                var limitFields = groups[groupKey] || [];
                var limitField = fieldByKey(limitFields, 'max_reviews') || limitFields[0];
                var limitBody = renderFieldsHtml(limitFields, config, layout, upgradeUrl, renderedUpgradeFeatures, builder.upgrade || {}, {
                    showLockedControls: true,
                });
                var limitLabel = displayLimitSummaryLabel(limitField, config);
                accordionHtml += renderSectionAccordion(GROUP_LABELS.limits, limitBody, '', 'limits', accordionChromeFromOptions(groupOptions, {
                    value: limitLabel,
                    valueKey: 'max_reviews_summary',
                }));
                return;
            }
            accordionHtml += renderGroupCard(
                groupKey,
                groups[groupKey] || [],
                config,
                layout,
                upgradeUrl,
                renderedUpgradeFeatures,
                builder.upgrade || {},
                cardOptions
            );
        });

        if (sectionId === 'reviews') {
            accordionHtml += renderReviewPhotosAccordion(editor, groups, config, layout, upgradeUrl, renderedUpgradeFeatures);
            html = wrapSectionAccordions(
                renderReviewCurator(editor, { asAccordion: true }) + accordionHtml,
                sectionId
            );
            return html;
        }

        if (useAccordions) {
            html += wrapSectionAccordions(accordionHtml, sectionId);
        } else {
            html += accordionHtml;
        }

        return html;
    }

    function uniqueKeys(list) {
        var seen = {};
        var out = [];
        (list || []).forEach(function (key) {
            if (!key || seen[key]) {
                return;
            }
            seen[key] = true;
            out.push(key);
        });
        return out;
    }

    function aiSummaryLockedForEditor(editor) {
        if (editor && editor.builder && editor.builder.ai_summary && typeof editor.builder.ai_summary.locked !== 'undefined') {
            return !!editor.builder.ai_summary.locked;
        }
        if (editor && editor.features && typeof editor.features.ai_summary !== 'undefined') {
            return !editor.features.ai_summary;
        }
        return true;
    }

    function ensureAiSummaryFields(editor, isFeed) {
        if (!editor.builder) {
            editor.builder = {};
        }
        var fields = Array.isArray(editor.builder.fields) ? editor.builder.fields.slice() : [];
        var hasAi = fields.some(function (field) {
            return field && field.key === 'ai_summary_enabled';
        });
        if (isFeed && !hasAi) {
            var locked = aiSummaryLockedForEditor(editor);
            DEFAULT_AI_SUMMARY_FIELDS.forEach(function (field) {
                var copy = $.extend({}, field);
                if (locked) {
                    copy.locked = true;
                    copy.upgrade_feature = 'ai_summary';
                }
                fields.push(copy);
            });
            editor.builder.fields = fields;
        }
        if (!editor.builder.ai_summary || typeof editor.builder.ai_summary !== 'object') {
            editor.builder.ai_summary = {};
        }
        editor.builder.ai_summary.visible = !!isFeed;
        editor.builder.ai_summary.locked = aiSummaryLockedForEditor(editor);
    }

    function syncAiSummarySectionModel(editor, layoutKey) {
        dropLegacyOptionsNav(editor);
        var isFeed = isFeedLayoutKey(layoutKey);
        var sections = Array.isArray(editor.builder && editor.builder.sections)
            ? editor.builder.sections.slice()
            : [];
        var hasAi = sections.some(function (section) {
            return section && section.id === 'ai-summary';
        });
        var locked = aiSummaryLockedForEditor(editor);

        if (isFeed && !hasAi) {
            var aiSection = {
                id: 'ai-summary',
                title: 'AI Features',
                subtitle: 'AI Review Summary and related options',
                locked: locked,
                upgrade_feature: 'ai_summary',
            };
            var installIndex = -1;
            sections.forEach(function (section, index) {
                if (section && section.id === 'install') {
                    installIndex = index;
                }
            });
            if (installIndex >= 0) {
                sections.splice(installIndex, 0, aiSection);
            } else {
                sections.push(aiSection);
            }
        } else if (!isFeed && hasAi) {
            sections = sections.filter(function (section) {
                return !(section && section.id === 'ai-summary');
            });
        } else if (isFeed && hasAi) {
            sections = sections.map(function (section) {
                if (!section || section.id !== 'ai-summary') {
                    return section;
                }
                return $.extend({}, section, {
                    locked: locked,
                    upgrade_feature: 'ai_summary',
                });
            });
        }

        editor.builder.sections = sections;
        ensureAiSummaryFields(editor, isFeed);
        return { isFeed: isFeed, sections: sections, locked: locked };
    }

    function ensureAiSummaryPanelDom(section) {
        var $panels = $('#grwi-customize-panels');
        var $rail = $('#grwi-customize-rail');
        if (!$panels.length || !$rail.length || !section) {
            return;
        }
        if ($panels.find('[data-grwi-panel="ai-summary"]').length) {
            var $btn = $rail.find('[data-grwi-section="ai-summary"]');
            $btn.find('.grw-customize__rail-label').text(section.title || 'AI Features');
            $panels.find('[data-grwi-panel="ai-summary"] .grw-panel__title').text(section.title || 'AI Features');
            if (section.subtitle) {
                $panels.find('[data-grwi-panel="ai-summary"] .grw-panel__subtitle').text(section.subtitle);
            }
            if (section.locked) {
                $btn.attr('data-grwi-locked', '1');
                if (!$btn.find('.grw-customize__rail-lock').length) {
                    $btn.append('<span class="dashicons dashicons-lock grw-customize__rail-lock" aria-hidden="true"></span>');
                }
            } else {
                $btn.removeAttr('data-grwi-locked');
                $btn.find('.grw-customize__rail-lock').remove();
            }
            return;
        }

        var $installBtn = $rail.find('[data-grwi-section="install"]');
        var $installPanel = $panels.find('[data-grwi-panel="install"]');
        var lockHtml = section.locked
            ? '<span class="dashicons dashicons-lock grw-customize__rail-lock" aria-hidden="true"></span>'
            : '';
        var btnHtml = '<button type="button" role="tab" id="grwi-tab-ai-summary" class="grw-customize__rail-btn"' +
            ' data-grwi-section="ai-summary" aria-selected="false" aria-controls="grwi-panel-ai-summary" tabindex="-1"' +
            (section.locked ? ' data-grwi-locked="1"' : '') + '>' +
            '<svg class="grw-customize__rail-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
            '<path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="' +
            AI_SUMMARY_RAIL_SVG + '"/></svg>' +
            '<span class="grw-customize__rail-label">AI Features</span>' + lockHtml + '</button>';
        var panelHtml = '<section class="grw-customize__section" id="grwi-panel-ai-summary" role="tabpanel"' +
            ' aria-labelledby="grwi-tab-ai-summary" data-grwi-panel="ai-summary" hidden>' +
            '<header class="grw-customize__section-head">' +
            '<h2 class="grw-panel__title">AI Features</h2>' +
            '<p class="grw-panel__subtitle">AI Review Summary and related options</p>' +
            '</header>' +
            '<div class="grw-customize__section-body" data-grwi-section-body="ai-summary"></div>' +
            '</section>';

        if ($installBtn.length) {
            $installBtn.before(btnHtml);
        } else {
            $rail.find('.grw-customize__rail-footer').before(btnHtml);
        }
        if ($installPanel.length) {
            $installPanel.before(panelHtml);
        } else {
            $panels.append(panelHtml);
        }
    }

    function removeAiSummaryPanelDom() {
        $('#grwi-customize-rail [data-grwi-section="ai-summary"]').remove();
        $('#grwi-customize-panels [data-grwi-panel="ai-summary"]').remove();
    }

    function rehydratePreviewMetaForLayout(editor, layoutKey) {
        if (!editor.builder) {
            editor.builder = {};
        }
        if (!editor.builder.preview || typeof editor.builder.preview !== 'object') {
            editor.builder.preview = {};
        }
        var previewMeta = editor.builder.preview;
        var theme = ((editor.config && editor.config.theme) || 'light') === 'dark' ? 'dark' : 'light';
        var byLayout = previewMeta.layout_full_defaults_by_layout || {};
        var colorByLayout = previewMeta.color_picker_defaults_by_layout || {};
        var examplesConfigs = previewMeta.examples_preview_configs || {};
        var examplesPresentations = previewMeta.examples_preview_presentations || {};

        if (byLayout[layoutKey]) {
            previewMeta.layout_full_defaults = {
                light: byLayout[layoutKey].light || byLayout[layoutKey],
                dark: byLayout[layoutKey].dark || byLayout[layoutKey].light || byLayout[layoutKey],
            };
            previewMeta.layout_full_defaults_for = layoutKey;
        } else if (window.GrwiPreviewOpts && typeof GrwiPreviewOpts.layoutPickerDemoConfig === 'function') {
            var demoCfg = GrwiPreviewOpts.layoutPickerDemoConfig(previewMeta, layoutKey, theme);
            previewMeta.layout_full_defaults = { light: demoCfg, dark: demoCfg };
            previewMeta.layout_full_defaults_for = layoutKey;
        }

        if (colorByLayout[layoutKey]) {
            previewMeta.color_picker_defaults = {
                light: colorByLayout[layoutKey].light || colorByLayout[layoutKey],
                dark: colorByLayout[layoutKey].dark || colorByLayout[layoutKey].light || colorByLayout[layoutKey],
            };
        }
        if (examplesConfigs[layoutKey]) {
            previewMeta.examples_preview_config = examplesConfigs[layoutKey];
        }
        if (examplesPresentations[layoutKey]) {
            previewMeta.examples_preview_presentation = examplesPresentations[layoutKey];
        }
        if (previewMeta.layout_picker_demo && previewMeta.layout_picker_demo.configs && previewMeta.layout_picker_demo.configs[layoutKey]) {
            previewMeta.layout_master_defaults = previewMeta.layout_picker_demo.configs[layoutKey];
        }
        editor.builder.preview = previewMeta;
        return previewMeta;
    }

    function rehydrateConfigForLayout(editor, layoutKey) {
        var previewMeta = rehydratePreviewMetaForLayout(editor, layoutKey);
        var theme = ((editor.config && editor.config.theme) || 'light') === 'dark' ? 'dark' : 'light';
        var defaults = {};
        if (window.GrwiPreviewOpts && typeof GrwiPreviewOpts.layoutDefaultsForPreview === 'function') {
            defaults = GrwiPreviewOpts.layoutDefaultsForPreview(previewMeta, layoutKey, theme) || {};
        } else {
            var bundle = (previewMeta.layout_full_defaults_by_layout || {})[layoutKey]
                || previewMeta.layout_full_defaults
                || {};
            defaults = bundle[theme] || bundle.light || bundle || {};
        }

        var keys = uniqueKeys([].concat(
            editor.builder.style_reset_keys || [],
            previewMeta.appearance_keys || [],
            previewMeta.typography_keys || [],
            previewMeta.visibility_keys || [],
            previewMeta.display_keys || [],
            previewMeta.review_photo_keys || [],
            previewMeta.spacing_keys || [],
            [
                'rating_display_mode', 'rating_custom_label', 'review_count_format',
                'badge_show_verified_badge', 'pill_show_verified_badge',
                'google_logo_style', 'google_logo_size', 'badge_logo_position',
                'feed_initial_review_count', 'feed_style', 'showcase_rows',
            ]
        ));

        var next = $.extend({}, editor.config || {});
        keys.forEach(function (key) {
            if (Object.prototype.hasOwnProperty.call(defaults, key)) {
                next[key] = defaults[key];
            }
        });
        next.layout = layoutKey;
        applyReviewPhotoEntitlementOnLayoutChange(editor, next, layoutKey, defaults);
        editor.config = next;
        return next;
    }

    function liveBoolValue(value) {
        return value === true || value === 1 || value === '1' || value === 'true';
    }

    function applyReviewPhotoEntitlementOnLayoutChange(editor, next, layoutKey, defaults) {
        var catalog = (editor && editor.preview_first_catalog) || {};
        var entitlements = catalog.entitlements || {};
        var liveCfg = editor.live_config || {};
        var family = layoutFamilyFromLayout(layoutKey, editor);
        if (family === 'slider') {
            family = 'showcase';
        }
        var photoFamilies = ['list', 'carousel', 'grid', 'masonry', 'showcase'];
        var photoKeys = ['show_review_photos', 'list_show_review_photos', 'flyout_show_review_photos'].concat(
            photoFamilies.map(function (name) { return name + '_show_review_photos'; })
        );
        photoKeys = uniqueKeys(photoKeys);
        var entitled = !!entitlements.review_photos;
        photoKeys.forEach(function (key) {
            if (liveBoolValue(liveCfg[key])) {
                next[key] = liveCfg[key];
                return;
            }
            if (entitled) {
                if (Object.prototype.hasOwnProperty.call(defaults || {}, key)) {
                    next[key] = defaults[key];
                }
                return;
            }
            var applies = (key === 'flyout_show_review_photos')
                || (key === 'show_review_photos' && photoFamilies.indexOf(family) >= 0)
                || (key === family + '_show_review_photos');
            if (!applies) {
                next[key] = false;
                return;
            }
            next[key] = false;
        });
        var contentKeys = ['enable_json_ld', 'ai_summary_enabled', 'flyout_show_ai_summary'];
        if (family) {
            contentKeys.push(family + '_show_author_avatar');
        }
        contentKeys.forEach(function (key) {
            if (liveBoolValue(liveCfg[key])) {
                next[key] = liveCfg[key];
                return;
            }
            var allowed = true;
            if (key === 'enable_json_ld') allowed = !!entitlements.json_ld;
            else if (key === 'ai_summary_enabled' || key === 'flyout_show_ai_summary') allowed = !!entitlements.ai_summary;
            else if (key.indexOf('_show_author_avatar') >= 0) allowed = !!entitlements.reviewer_avatars;
            if (allowed) {
                if (Object.prototype.hasOwnProperty.call(defaults || {}, key)) {
                    next[key] = defaults[key];
                }
                return;
            }
            next[key] = false;
        });
    }

    function applyLayoutChange(editor, layoutKey, layoutLabel) {
        editor = editor || readEditor();
        layoutKey = String(layoutKey || '').trim() || 'badge_card';
        if (!editor.builder || typeof editor.builder !== 'object') {
            editor.builder = {};
        }

        editor.layout = layoutKey;
        editor.builder.layout = layoutKey;
        editor.builder.layout_label = layoutLabel || layoutKey;
        editor.builder.layout_family = layoutKey.indexOf('sticker_') === 0
            ? 'pill'
            : (layoutKey.indexOf('feed_') === 0 ? layoutKey.replace(/^feed_/, '') : layoutKey.split('_')[0]);

        var visibilityByLayout = editor.builder.visibility_by_layout || {};
        if (visibilityByLayout[layoutKey] && typeof visibilityByLayout[layoutKey] === 'object') {
            try {
                editor.builder.visibility = JSON.parse(JSON.stringify(visibilityByLayout[layoutKey]));
            } catch (err) {
                editor.builder.visibility = visibilityByLayout[layoutKey];
            }
        } else {
        if (!editor.builder.visibility || typeof editor.builder.visibility !== 'object') {
            editor.builder.visibility = {};
        }
        editor.builder.visibility.is_feed = isFeedLayoutKey(layoutKey);
        }

        var orderByLayout = editor.builder.element_order_by_layout || {};
        if (Object.prototype.hasOwnProperty.call(orderByLayout, layoutKey)) {
            editor.builder.element_order = orderByLayout[layoutKey];
        }

        var positionByLayout = editor.builder.position_fields_by_layout || {};
        if (Object.prototype.hasOwnProperty.call(positionByLayout, layoutKey)) {
            editor.builder.position_fields = positionByLayout[layoutKey];
        }

        var sectionState = syncAiSummarySectionModel(editor, layoutKey);
        rehydrateConfigForLayout(editor, layoutKey);

        if (sectionState.isFeed) {
            var aiSection = (editor.builder.sections || []).find(function (section) {
                return section && section.id === 'ai-summary';
            });
            ensureAiSummaryPanelDom(aiSection || {
                id: 'ai-summary',
                locked: sectionState.locked,
            });
        } else {
            removeAiSummaryPanelDom();
        }

        activeEditorRef = editor;
        return editor;
    }

    function applyPanelTabLabel() {
        var title = sectionDisplayTitle({ id: 'panel', title: 'Panel' });
        var $btnLabel = $('#grwi-customize-rail [data-grwi-section="panel"] .grw-customize__rail-label');
        if ($btnLabel.length && ($btnLabel.text().trim() === 'Panel' || $btnLabel.text().trim() === '')) {
            $btnLabel.text(title);
        }
        var $heading = $('#grwi-customize-panels [data-grwi-panel="panel"] .grw-panel__title');
        if ($heading.length && ($heading.text().trim() === 'Panel' || $heading.text().trim() === '')) {
            $heading.text(title);
        }
    }

    function renderAllPanels(editor) {
        activeEditorRef = editor || readEditor();
        applyPanelTabLabel();
        (activeEditorRef.builder && activeEditorRef.builder.sections || []).forEach(function (section) {
            var $body = $('[data-grwi-section-body="' + section.id + '"]');
            if ($body.length) {
                $body.html(renderSectionBody(section.id, activeEditorRef));
                disableLockedExploreControls($body.find('.grw-customize-panel--locked, .grw-collapse--locked > .grw-collapse__body'));
                initExclusiveAccordions(($body.get && $body.get(0)) || $body[0] || null);
            }
        });
    }

    function stableReviewId(review) {
        if (review.id) {
            return review.id;
        }
        var payload = [review.author_name || '', review.text || '', review.relative_time || ''].join('|');
        var hash = 0;
        for (var i = 0; i < payload.length; i++) {
            hash = ((hash << 5) - hash) + payload.charCodeAt(i);
            hash |= 0;
        }
        return 'r_' + Math.abs(hash).toString(16);
    }

    function curationReviewHasPhotos(review) {
        var raw = (review && (review.photo_urls || review.photos || review.review_photos)) || [];
        if (!Array.isArray(raw)) {
            return false;
        }
        return raw.some(function (url) { return typeof url === 'string' && url.trim() !== ''; });
    }

    function curationReviewTimestamp(review) {
        if (!review) return 0;
        var ts = review.review_timestamp;
        if (ts != null && !isNaN(parseInt(ts, 10))) return parseInt(ts, 10);
        if (review.review_date) {
            var parsed = Date.parse(review.review_date);
            if (!isNaN(parsed)) return Math.floor(parsed / 1000);
        }
        return 0;
    }

    function applyReviewCuration(reviews, config) {
        var hidden = [];
        try {
            hidden = JSON.parse(config.hidden_review_ids || '[]');
        } catch (e) {
            hidden = Array.isArray(config.hidden_review_ids) ? config.hidden_review_ids : [];
        }
        if (!Array.isArray(hidden)) {
            hidden = [];
        }
        var order = [];
        try {
            order = JSON.parse(config.review_order || '[]');
        } catch (e2) {
            order = Array.isArray(config.review_order) ? config.review_order : [];
        }
        var sort = config.review_sort || 'newest';
        var filtered = (reviews || []).map(function (r) {
            var copy = $.extend({}, r);
            if (!copy.id) {
                copy.id = stableReviewId(copy);
            }
            return copy;
        }).filter(function (r) {
            return hidden.indexOf(r.id) < 0;
        });

        var field = canonicalReviewSortField(sort, order, true);
        var dir = canonicalReviewSortDir(field, sort, config.review_sort_dir);
        if (field === 'manual' && order.length) {
            var byId = {};
            filtered.forEach(function (r) { byId[r.id] = r; });
            var ordered = [];
            order.forEach(function (id) {
                if (byId[id]) {
                    ordered.push(byId[id]);
                }
            });
            filtered.forEach(function (r) {
                if (ordered.indexOf(r) < 0) {
                    ordered.push(r);
                }
            });
            filtered = ordered;
        } else if (field !== 'manual') {
            filtered.sort(function (a, b) {
                if (field === 'rating') {
                    var ratingDiff = (parseInt(b.rating, 10) || 0) - (parseInt(a.rating, 10) || 0);
                    if (dir === 'lowest') ratingDiff = -ratingDiff;
                    if (ratingDiff !== 0) return ratingDiff;
                }
                if (field === 'photos') {
                    var aHas = curationReviewHasPhotos(a) ? 1 : 0;
                    var bHas = curationReviewHasPhotos(b) ? 1 : 0;
                    var photoDiff = bHas - aHas;
                    if (dir === 'photos_last') photoDiff = -photoDiff;
                    if (photoDiff !== 0) return photoDiff;
                }
                var timeDiff = curationReviewTimestamp(b) - curationReviewTimestamp(a);
                if (field === 'date' && dir === 'oldest') timeDiff = -timeDiff;
                if (timeDiff !== 0) return timeDiff;
                return String(a.id || '').localeCompare(String(b.id || ''));
            });
        }

        var mode = String(config.max_reviews_mode || '');
        if (mode === 'max') {
            var limits = ((readEditor() || {}).limits) || {};
            var planMax = parseInt(limits.max_reviews_shown != null ? limits.max_reviews_shown : limits.max_reviews_display, 10);
            if (!isNaN(planMax) && planMax > 0) {
                return filtered.slice(0, planMax);
            }
            return filtered;
        }
        var max = parseInt(config.max_reviews, 10);
        if (!max || max < 1) {
            return filtered;
        }
        return filtered.slice(0, max);
    }

    function mergeHostedOverlay(base, merged, previewMeta) {
        if (window.GrwiPreviewOpts && typeof GrwiPreviewOpts.mergeHostedOverlay === 'function') {
            return GrwiPreviewOpts.mergeHostedOverlay(base, merged, previewMeta);
        }
        var out = $.extend({}, base || {});
        if (!merged || !previewMeta) {
            return out;
        }

        var keySet = {};
        (previewMeta.visibility_keys || [])
            .concat(previewMeta.appearance_keys || [])
            .concat(previewMeta.typography_keys || [])
            .concat(previewMeta.display_keys || [])
            .concat(previewMeta.ai_summary_keys || [])
            .concat(previewMeta.review_photo_keys || [])
            .forEach(function (key) {
                keySet[key] = true;
            });

        Object.keys(keySet).forEach(function (key) {
            if (!Object.prototype.hasOwnProperty.call(merged, key)) {
                return;
            }
            out[key] = merged[key];
        });

        [
            'theme',
            'badge_element_order',
            'sticker_element_order',
            'review_sort',
            'review_sort_dir',
            'max_reviews',
            'max_reviews_mode',
            'hidden_review_ids',
            'review_order',
            'min_rating',
            'google_logo_style',
            'google_logo_size',
            'showcase_title',
            'rating_display_mode',
            'rating_custom_label',
            'review_count_format',
            'review_count_label_preset',
            'review_count_label_before',
            'review_count_label_after',
            'badge_logo_position',
            'font_source',
            'font_family_preset',
            'ai_summary_enabled',
            'ai_summary_upgrade_tease',
            'ai_summary_text',
            'ai_summary_list',
            'ai_summary_style',
            'ai_summary_typing_animation',
            'ai_summary_picture_animation',
            'ai_summary_label',
            'ai_summary_star_color',
            'ai_summary_star_size_mode',
            'ai_summary_star_size_custom',
            'ai_summary_bg_color',
            'ai_summary_regenerated_at',
            'ai_summary_review_count',
            'flyout_show_ai_summary',
        ].forEach(function (key) {
            if (Object.prototype.hasOwnProperty.call(merged, key)) {
                out[key] = merged[key];
            }
        });

        return out;
    }

    function layoutPickerDemoConfig(previewMeta, layout, theme) {
        if (window.GrwiPreviewOpts && typeof GrwiPreviewOpts.layoutPickerDemoConfig === 'function') {
            return GrwiPreviewOpts.layoutPickerDemoConfig(previewMeta, layout, theme);
        }
        var configs = previewMeta && previewMeta.layout_picker_demo && previewMeta.layout_picker_demo.configs;
        var base = (configs && configs[layout]) || previewMeta.layout_master_defaults || {};
        return $.extend({}, base, { layout: layout, theme: theme === 'dark' ? 'dark' : 'light' });
    }

    function googleTracerDefaultBorderWidth(layout) {
        layout = String(layout || '').trim();
        return layout === 'badge_card' ? 4 : 3;
    }

    var borderWidthMemory = {
        solid: null,
        google_tracer: null,
    };
    var lastBorderStyleForWidth = null;

    function defaultWidgetBorderWidthForStyle(style, layout) {
        style = String(style || 'solid').trim();
        if (style === 'google_tracer') {
            return googleTracerDefaultBorderWidth(layout);
        }
        return 1;
    }

    function rememberWidgetBorderWidth(style, widthValue) {
        style = String(style || '').trim();
        if (style !== 'solid' && style !== 'google_tracer') {
            return;
        }
        if (widthValue == null || String(widthValue).trim() === '') {
            return;
        }
        borderWidthMemory[style] = widthValue;
    }

    function syncWidgetBorderWidthDefault(config, layout, previousStyle) {
        config = config || {};
        var style = String(config.widget_border_style || 'solid').trim();
        var prev = previousStyle != null ? String(previousStyle).trim() : lastBorderStyleForWidth;

        if (style === 'none') {
            if (prev && prev !== 'none' && prev !== style) {
                rememberWidgetBorderWidth(prev, config.widget_border_width);
            }
            lastBorderStyleForWidth = style;
            return config;
        }

        if (prev && prev !== 'none' && prev !== style) {
            rememberWidgetBorderWidth(prev, config.widget_border_width);
        }

        if (prev !== style) {
            if (borderWidthMemory[style] != null && String(borderWidthMemory[style]).trim() !== '') {
                config.widget_border_width = borderWidthMemory[style];
            } else if (prev == null) {
                var seeded = parseInt(config.widget_border_width, 10);
                if (isNaN(seeded) || seeded < 1) {
                    config.widget_border_width = defaultWidgetBorderWidthForStyle(style, layout);
                }
                rememberWidgetBorderWidth(style, config.widget_border_width);
            } else {
                config.widget_border_width = defaultWidgetBorderWidthForStyle(style, layout);
                rememberWidgetBorderWidth(style, config.widget_border_width);
            }
        } else {
            var current = parseInt(config.widget_border_width, 10);
            if (isNaN(current) || current < 1) {
                config.widget_border_width = defaultWidgetBorderWidthForStyle(style, layout);
            }
            rememberWidgetBorderWidth(style, config.widget_border_width);
        }

        lastBorderStyleForWidth = style;
        return config;
    }

    function refreshConditionalSections(editor, changedKey, activeSectionId) {
        var builder = editor.builder || {};
        if (!fieldDependsOnKey(builderConditionalFields(builder), changedKey)) {
            return false;
        }
        var config = editor.config || {};
        if (changedKey === 'widget_border_style') {
            var layout = builder.layout || editor.layout || 'badge_card';
            // previousStyle is already tracked in lastBorderStyleForWidth when
            // admin-customize.js synced first; fall back to editor value otherwise.
            config = syncWidgetBorderWidthDefault($.extend({}, config), layout);
            editor.config = config;
        }
        var sections = sectionsForConditionalDriver(builder, changedKey);
        if (activeSectionId && sections.indexOf(activeSectionId) < 0) {
            sections.push(activeSectionId);
        }
        sections.forEach(function (sectionId) {
            var $body = $('[data-grwi-section-body="' + sectionId + '"]');
            if ($body.length) {
                var node = ($body.get && $body.get(0)) || $body[0] || null;
                var captured = captureOpenAccordionGroups(node);
                pendingAccordionOpenGroups = captured;
                if (captured) {
                    suppressSummaryToggleUntil = Date.now() + 80;
                }
                try {
                $body.html(renderSectionBody(sectionId, editor));
                    disableLockedExploreControls($body.find('.grw-customize-panel--locked, .grw-collapse--locked > .grw-collapse__body'));
                    initExclusiveAccordions(node);
                    restoreOpenAccordionGroups(node, captured);
                    scheduleAccordionOpenRestore(node, captured);
                } finally {
                    pendingAccordionOpenGroups = null;
                }
            }
        });
        return sections.length > 0;
    }

    window.GrwiBuilder = {
        readEditor: readEditor,
        renderAllPanels: renderAllPanels,
        renderSectionBody: renderSectionBody,
        applyReviewCuration: applyReviewCuration,
        mergeHostedOverlay: mergeHostedOverlay,
        layoutPickerDemoConfig: layoutPickerDemoConfig,
        layoutFullDefaultsForEditor: layoutFullDefaultsForEditor,
        applyLayoutChange: applyLayoutChange,
        layoutFamilyFromLayout: layoutFamilyFromLayout,
        syncAiSummarySectionModel: syncAiSummarySectionModel,
        rehydrateConfigForLayout: rehydrateConfigForLayout,
        isFeedLayoutKey: isFeedLayoutKey,
        fieldVisible: fieldVisible,
        fieldDependsOnKey: fieldDependsOnKey,
        builderConditionalFields: builderConditionalFields,
        refreshConditionalSections: refreshConditionalSections,
        syncWidgetBorderWidthDefault: syncWidgetBorderWidthDefault,
        syncFloatOffsetAxisIcons: syncFloatOffsetAxisIcons,
        floatOffsetAxesForPosition: floatOffsetAxesForPosition,
        disableLockedExploreControls: disableLockedExploreControls,
        layoutDefaultColorForField: layoutDefaultColorForField,
        syncColorFieldSwatch: syncColorFieldSwatch,
        syncAllColorFieldSwatches: syncAllColorFieldSwatches,
        resetTypographyRoleFields: resetTypographyRoleFields,
        initExclusiveAccordions: initExclusiveAccordions,
        syncAccordionSummaries: syncAccordionSummaries,
        syncAccordionValueEl: syncAccordionValueEl,
        isExclusiveParentAccordion: isExclusiveParentAccordion,
        closeSiblingExclusiveParents: closeSiblingExclusiveParents,
        captureOpenAccordionGroups: captureOpenAccordionGroups,
        preserveAccordionOpenGroups: preserveAccordionOpenGroups,
        renderFeatureGroup: renderFeatureGroup,
        renderFeatureGroupHeader: renderFeatureGroupHeader,
        renderFeatureChildAccordion: renderFeatureChildAccordion,
        renderPlanBadge: renderPlanBadge,
        renderEntitlementLock: renderEntitlementLock,
        renderSegmentedControl: renderSegmentedControl,
        fieldUsesSegmentedControl: fieldUsesSegmentedControl,
        renderSelectField: renderSelectField,
        renderSwitchField: renderSwitchField,
        sectionDisplayTitle: sectionDisplayTitle,
        applyPanelTabLabel: applyPanelTabLabel,
        renderLayoutCardHtml: renderLayoutCardHtml,
        collectPlacementFields: collectPlacementFields,
        composeWidthCustomValue: composeWidthCustomValue,
    };
})(window, jQuery);
