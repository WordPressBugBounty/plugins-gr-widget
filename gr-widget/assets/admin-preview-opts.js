(function (window, $) {
    'use strict';

    var LAYOUT_PICKER_FLAGS = {
        layoutPickerPreview: true,
        show_branding: false,
        flyout_enabled: false,
        review_click_action: 'none',
    };

    /** Saved-widget canvas (customize + list modal) — hosted builder parity, not layout-picker mount. */
    var SAVED_WIDGET_PREVIEW_FLAGS = {
        builderPreview: true,
        flyout_enabled: false,
        review_click_action: 'none',
    };

    function resolveTheme(theme) {
        return theme === 'dark' || theme === 'transparent' ? theme : 'light';
    }

    function layoutPickerDemoConfig(previewMeta, layout, theme) {
        var demos = previewMeta && previewMeta.layout_picker_demo && previewMeta.layout_picker_demo.configs;
        var picker = demos && demos[layout];
        var base = picker || (previewMeta && previewMeta.layout_master_defaults) || {};
        return $.extend({}, base, {
            layout: layout,
            theme: resolveTheme(theme),
        });
    }

    function layoutFullDefaultsFor(previewMeta, layout, theme) {
        var resolvedTheme = resolveTheme(theme);
        var byLayout = previewMeta && previewMeta.layout_full_defaults_by_layout;
        if (byLayout && byLayout[layout]) {
            var mapped = byLayout[layout];
            if (mapped.light || mapped.dark) {
                return $.extend({}, mapped[resolvedTheme] || mapped.light || {});
            }
            return $.extend({}, mapped);
        }

        var bundle = previewMeta && previewMeta.layout_full_defaults;
        if (!bundle) {
            return layoutPickerDemoConfig(previewMeta, layout, theme);
        }

        // Single light/dark bundle is only valid for the layout the editor opened with.
        var bundleFor = previewMeta && previewMeta.layout_full_defaults_for;
        if ((bundle.light || bundle.dark) && bundleFor && bundleFor !== layout) {
            return layoutPickerDemoConfig(previewMeta, layout, theme);
        }
        if (bundle.light || bundle.dark) {
            return $.extend({}, bundle[resolvedTheme] || bundle.light || {});
        }
        var perLayout = bundle[layout];
        if (perLayout && (perLayout.light || perLayout.dark)) {
            return $.extend({}, perLayout[resolvedTheme] || perLayout.light || {});
        }
        return $.extend({}, perLayout || bundle);
    }

    function examplesPreviewConfigFor(previewMeta, layout) {
        var configs = previewMeta && previewMeta.examples_preview_configs;
        if (configs && configs[layout]) {
            return configs[layout];
        }
        var single = previewMeta && previewMeta.examples_preview_config;
        return single && typeof single === 'object' ? single : null;
    }

    function examplesPreviewPresentationFor(previewMeta, layout) {
        var presentations = previewMeta && previewMeta.examples_preview_presentations;
        if (presentations && presentations[layout]) {
            return presentations[layout];
        }
        var single = previewMeta && previewMeta.examples_preview_presentation;
        return single && typeof single === 'object' ? single : null;
    }

    function layoutDefaultsForPreview(previewMeta, layout, theme) {
        // Saved customize/dashboard canvas uses layout defaults + saved config.
        // Do not merge marketing examples configs — those cap galleries at 5–6 cards.
        return layoutFullDefaultsFor(previewMeta, layout, theme);
    }

    function mergeHostedOverlay(base, merged, previewMeta) {
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
            'custom_css',
            'language',
            'language_mode', 'ai_summary_language', 'ai_summary_language_override',
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
            'widget_align',
            'widget_width_mode',
            'widget_width_custom',
            'widget_width',
            'widget_display_mode',
            'widget_float_position',
            'widget_float_offset_x',
            'widget_float_offset_y',
            'widget_float_hide_mobile',
            'widget_visible_desktop',
            'widget_visible_mobile',
            'badge_alignment',
            'pill_alignment',
            'widget_margin_top',
            'widget_margin_right',
            'widget_margin_bottom',
            'widget_margin_left',
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
            'badge_logo_align',
            'font_source',
            'font_family_preset',
            // AI Summary explore / upgrade tease must overlay saved config even if
            // previewMeta.ai_summary_keys is missing from an older editor payload.
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
            'hide_branding',
            'show_branding',
            'flyout_show_ai_summary',
            'review_panel_mode',
            'flyout_enabled',
            'review_click_action',
            'flyout_title',
            'show_view_on_google_in_flyout',
            'flyout_theme',
            'flyout_show_drawer_title',
            'flyout_show_business_name',
            'flyout_show_address',
            'flyout_show_rating_summary',
            'flyout_show_review_photos',
            'flyout_review_image_filter',
            'show_review_photos',
            'review_image_filter',
            'list_show_review_photos',
            'carousel_show_review_photos',
            'grid_show_review_photos',
            'masonry_show_review_photos',
            'showcase_show_review_photos',
            'list_show_author_avatar',
            'carousel_show_author_avatar',
            'grid_show_author_avatar',
            'masonry_show_author_avatar',
            'showcase_show_author_avatar',
            'show_view_all',
            'list_show_view_all',
            'carousel_show_view_all',
            'grid_show_view_all',
            'masonry_show_view_all',
            'showcase_show_view_all',
            'feed_review_button_mode',
            'feed_footer_button_bg_color',
            'feed_footer_button_border_color',
            'feed_columns',
            'feed_rows',
            'feed_initial_review_count',
            'feed_load_more_count',
            'ai_summary_enabled',
            'list_review_image_filter',
            'carousel_review_image_filter',
            'grid_review_image_filter',
            'masonry_review_image_filter',
            'showcase_review_image_filter',
            'flyout_show_author',
            'flyout_show_date',
            'flyout_show_review_text',
            'flyout_show_write_review_button',
            'flyout_bg',
            'flyout_text',
            'flyout_heading',
            'flyout_border',
            'flyout_button_bg',
            'flyout_button_text',
            'flyout_link',
            'flyout_muted',
            'flyout_star_color',
        ].forEach(function (key) {
            if (Object.prototype.hasOwnProperty.call(merged, key)) {
                out[key] = merged[key];
            }
        });

        return out;
    }

    function mergeSavedConfig(base, savedConfig) {
        if (!savedConfig || typeof savedConfig !== 'object') {
            return $.extend({}, base || {});
        }
        return $.extend({}, base || {}, savedConfig);
    }

    function applyPresentation(opts, presentation) {
        if (!presentation) {
            return opts;
        }
        if (presentation.filled_class) {
            opts.filledClass = presentation.filled_class;
        }
        if (presentation.preview_variant) {
            opts.previewVariant = presentation.preview_variant;
        }
        if (presentation.masonry_show_all) {
            opts.masonryShowAll = true;
        }
        if (presentation.max_reviews != null) {
            var n = parseInt(presentation.max_reviews, 10);
            if (!isNaN(n) && n > 0) {
                opts.maxReviews = n;
            }
        }
        if (presentation.showcase_rows != null) {
            var rows = parseInt(presentation.showcase_rows, 10);
            if (!isNaN(rows) && rows > 0) {
                opts.showcase_rows = rows;
            }
        }
        if (presentation.demo_photos) {
            opts.demoPhotos = presentation.demo_photos;
        }
        return opts;
    }

    function previewMetaFromDemo(previewDemo) {
        if (!previewDemo) {
            return {};
        }
        return {
            layout_picker_demo: previewDemo,
            layout_master_defaults: null,
        };
    }

    /**
     * Layout picker cards, create-flow live preview — demo configs only.
     */
    function buildLayoutPickerPreviewOpts(options) {
        options = options || {};
        var layout = options.layout || 'badge_card';
        var theme = resolveTheme(options.theme || 'light');
        var previewMeta = options.previewMeta || previewMetaFromDemo(options.previewDemo);
        var base = layoutPickerDemoConfig(previewMeta, layout, theme);
        var opts = $.extend({}, base, LAYOUT_PICKER_FLAGS, options.extra || {}, {
            layout: layout,
            theme: theme,
            reviews: options.reviews || [],
        });

        if (options.maxReviews != null) {
            opts.maxReviews = options.maxReviews;
        }
        if (options.filledClass) {
            opts.filledClass = options.filledClass;
        }
        applyPresentation(opts, options.presentation || examplesPreviewPresentationFor(previewMeta, layout));
        return opts;
    }

    /**
     * Saved widget previews (dashboard modal, customize canvas) — layout defaults + saved config + optional form overlay.
     */
    function buildSavedWidgetPreviewOpts(options) {
        options = options || {};
        var layout = options.layout || 'badge_card';
        var savedConfig = options.savedConfig || {};
        var previewMeta = options.previewMeta || previewMetaFromDemo(options.previewDemo);
        var theme = resolveTheme(options.theme || savedConfig.theme || 'light');
        var base = layoutDefaultsForPreview(previewMeta, layout, theme);
        var merged = mergeSavedConfig(base, savedConfig);

        if (options.formOverlay) {
            merged = mergeHostedOverlay(merged, options.formOverlay, previewMeta);
        }

        var opts = $.extend({}, merged, SAVED_WIDGET_PREVIEW_FLAGS, {
            layout: layout,
            theme: theme,
            reviews: options.reviews || [],
        });
        var hideBranding = true;
        opts.hide_branding = hideBranding;
        opts.show_branding = !hideBranding;

        if (options.layoutLocked) {
            opts.layoutLocked = true;
        }
        if (options.maxReviews != null) {
            opts.maxReviews = options.maxReviews;
        } else if (opts.max_reviews != null) {
            var max = parseInt(opts.max_reviews, 10);
            if (!isNaN(max) && max > 0) {
                opts.maxReviews = max;
            }
        }
        if (options.filledClass) {
            opts.filledClass = options.filledClass;
        }
        // Layout-picker / marketing thumbs use examples presentation. Saved customize
        // canvas must keep the widget's own max_reviews (and not a 5–6 card gallery cap).
        applyPresentation(opts, options.presentation || null);
        if (options.maxReviews != null) {
            opts.maxReviews = options.maxReviews;
        }
        opts.language = merged.language || 'auto';
        opts.language_mode = opts.language === 'auto' ? 'auto' : 'fixed';
        return opts;
    }

    window.GrwiPreviewOpts = {
        LAYOUT_PICKER_FLAGS: LAYOUT_PICKER_FLAGS,
        SAVED_WIDGET_PREVIEW_FLAGS: SAVED_WIDGET_PREVIEW_FLAGS,
        layoutPickerDemoConfig: layoutPickerDemoConfig,
        layoutFullDefaultsFor: layoutFullDefaultsFor,
        layoutDefaultsForPreview: layoutDefaultsForPreview,
        mergeHostedOverlay: mergeHostedOverlay,
        mergeSavedConfig: mergeSavedConfig,
        buildLayoutPickerPreviewOpts: buildLayoutPickerPreviewOpts,
        buildSavedWidgetPreviewOpts: buildSavedWidgetPreviewOpts,
    };
})(window, jQuery);
