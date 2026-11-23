(function ($) {
    'use strict';

    var cfg = window.grwiCustomize || {};
    var i18n = cfg.i18n || {};
    var embedKey = cfg.embedKey || '';

    function previewFirstEnabled() {
        return !!(cfg.previewFirst || (editor && editor.preview_first));
    }
    var LAYOUT_FEATURE_SLUGS = {
        feed_masonry: 'premium_layout_masonry',
        feed_slider: 'premium_layout_slider',
        feed_classic_carousel: 'premium_layout_classic_carousel',
        feed_classic_masonry: 'premium_layout_classic_masonry',
        sticker_bold: 'premium_layout_bold',
        sticker_ribbon: 'premium_layout_ribbon',
        sticker_pill: 'premium_layout_pill'
    };
    var $root = $('.grw-customize');
    var $mount = $('#grwi-customize-preview-mount');
    var previewPayload = null;
    var savedWidgetConfig = null;
    var previewTimer = null;
    var lastPreviewRunAt = 0;
    var PREVIEW_THROTTLE_MS = 80;
    var saving = false;
    var editor = (window.GrwiBuilder && GrwiBuilder.readEditor) ? GrwiBuilder.readEditor() : {};

    (function renderBuilderNotice() {
        var $box = $('#grwi-builder-notice');
        var notice = editor && editor.builder_notice;
        if (!$box.length || !notice || !notice.message) {
            return;
        }
        var sync = editor.review_sync || {};
        var catalog = editor.preview_first_catalog || cfg.previewFirstCatalog || {};
        var caps = catalog.max_reviews || {};
        var parsed = String(notice.message).match(/has\s+([\d,]+)\s+Google reviews\.\s+Your\s+(.+?)\s+plan syncs\s+([\d,]+)/i);
        function asCount(value) {
            var n = parseInt(String(value == null ? '' : value).replace(/,/g, ''), 10);
            return isNaN(n) ? 0 : n;
        }
        function formatCount(n) {
            try {
                return Number(n).toLocaleString();
            } catch (e) {
                return String(n);
            }
        }
        var total = asCount(sync.total_review_count);
        var limit = asCount(sync.plan_display_limit != null ? sync.plan_display_limit : sync.plan_limit);
        if (total <= 0 && parsed) {
            total = asCount(parsed[1]);
        }
        if (limit <= 0 && parsed) {
            limit = asCount(parsed[3]);
        }
        if (total <= 0 || limit <= 0 || total <= limit) {
            return;
        }
        var linked = cfg.isLinked === true || cfg.isLinked === 1 || cfg.isLinked === '1';
        var planLabel = 'current';
        if (linked) {
            planLabel = String(catalog.account_plan_name || '').trim();
            if (!planLabel && parsed) {
                planLabel = String(parsed[2] || '').trim();
            }
            if (!planLabel || planLabel.toLowerCase() === 'unlinked') {
                planLabel = 'Free';
            }
        }
        var more = Math.max(0, total - limit);
        var siteCap = asCount(caps.site) || 30;
        var planKey = String(notice.plan_key || '').toLowerCase();
        var offerSite = limit < siteCap;
        var offerBusiness = planKey === 'business' || total > siteCap;
        var trialEligible = editor.trial_eligible;
        if (typeof trialEligible === 'undefined' || trialEligible === '') {
            trialEligible = cfg.trialEligible;
        }
        var canTrial = trialEligible !== false && trialEligible !== 0 && trialEligible !== '0';
        var trialCopy = cfg.trialCopy || {};
        var siteCopy = trialCopy.site || {};
        var businessCopy = trialCopy.business || {};
        var siteLabel = canTrial
            ? 'Start 7-day Site trial'
            : (siteCopy.ineligible_cta || 'Upgrade to Site');
        var businessLabel = canTrial
            ? 'Start 7-day Business trial'
            : (businessCopy.ineligible_cta || 'Upgrade to Business');
        var siteUrl = editor.trial_url || cfg.trialUrl || 'https://grwidget.com/pricing?source=wordpress&plan=site&cycle=monthly';
        var businessUrl = editor.business_trial_url || cfg.businessTrialUrl || 'https://grwidget.com/pricing?source=wordpress&plan=business&cycle=monthly';
        var compareUrl = 'https://grwidget.com/pricing?source=wordpress';
        var $copy = $('<p>', { 'class': 'grwi-builder-notice__copy' });
        $copy.append($('<strong>', {
            'class': 'grwi-builder-notice__title',
            text: 'Your business has ' + formatCount(total) + ' Google reviews!'
        }));
        $copy.append(document.createTextNode(
            ' Your ' + planLabel + ' plan includes up to ' + formatCount(limit) +
            ' reviews, but you\u2019ve got another ' + formatCount(more) +
            ' that could be helping build trust with your website visitors.'
        ));
        if (offerSite && offerBusiness && total > siteCap) {
            $copy.append(document.createTextNode(canTrial ? ' Start a free trial of ' : ' Upgrade to '));
            $copy.append($('<strong>', { text: 'Site to display up to ' + formatCount(siteCap) }));
            $copy.append(document.createTextNode(' reviews, or '));
            $copy.append($('<strong>', { text: 'Business to display all ' + formatCount(total) }));
            $copy.append(document.createTextNode('.'));
        } else if (offerSite) {
            $copy.append(document.createTextNode(canTrial ? ' Start a free trial of ' : ' Upgrade to '));
            $copy.append($('<strong>', { text: 'Site to display all ' + formatCount(total) }));
            $copy.append(document.createTextNode(' reviews.'));
        } else if (offerBusiness) {
            $copy.append(document.createTextNode(canTrial ? ' Start a free trial of ' : ' Upgrade to '));
            $copy.append($('<strong>', { text: 'Business to display all ' + formatCount(total) }));
            $copy.append(document.createTextNode('.'));
        }
        var $actions = $('<div>', { 'class': 'grwi-builder-notice__actions' });
        function trialButton(href, label) {
            return $('<a>', {
                'class': 'grwi-builder-notice__btn',
                href: href,
                target: '_blank',
                rel: 'noopener noreferrer',
                text: label
            });
        }
        if (offerSite) {
            $actions.append(trialButton(siteUrl, siteLabel));
        }
        if (offerBusiness) {
            $actions.append(trialButton(businessUrl, businessLabel));
        }
        $actions.append($('<a>', {
            'class': 'grwi-builder-notice__compare',
            href: compareUrl,
            target: '_blank',
            rel: 'noopener noreferrer',
            text: 'Compare all plans'
        }));
        var $close = $('<button>', {
            type: 'button',
            'class': 'grwi-builder-notice__close',
            'aria-label': i18n.dismiss || 'Dismiss',
            text: '\u00d7'
        });
        $close.on('click', function () {
            $box.attr('hidden', true);
        });
        $box.empty().append($copy, $actions, $close).removeAttr('hidden');
    })();
    var layoutTabEnabled = cfg.layoutTabEnabled !== false;
    (function ensureLayoutEarly(ed) {
        if (!ed || typeof ed !== 'object') { return; }
        if (!ed.builder || typeof ed.builder !== 'object') { ed.builder = {}; }
        dropLegacyOptionsNav(ed);
        var sections = Array.isArray(ed.builder.sections) ? ed.builder.sections.slice() : [];
        if (!layoutTabEnabled) {
            ed.builder.sections = sections.filter(function (section) {
                return !(section && section.id === 'layout');
            });
            return;
        }
        var hasLayout = sections.some(function (section) { return section && section.id === 'layout'; });
        if (!hasLayout) {
            sections.unshift({ id: 'layout', title: 'Layout', subtitle: 'Choose a layout to get started with' });
            ed.builder.sections = sections;
        }
        if (!ed.builder.layout_catalog && cfg.layoutCatalog) { ed.builder.layout_catalog = cfg.layoutCatalog; }
        if (!ed.builder.layout_sections && cfg.layoutSections) { ed.builder.layout_sections = cfg.layoutSections; }
        if (!ed.builder.layout_preview_theme && cfg.layoutPreviewTheme) { ed.builder.layout_preview_theme = cfg.layoutPreviewTheme; }
        if (typeof ed.trial_eligible === 'undefined' && typeof cfg.trialEligible !== 'undefined') {
            ed.trial_eligible = !!cfg.trialEligible;
        }
        if (!ed.trial_url && cfg.trialUrl) { ed.trial_url = cfg.trialUrl; }
        if (!ed.upgrade_checkout_url && cfg.upgradeCheckoutUrl) { ed.upgrade_checkout_url = cfg.upgradeCheckoutUrl; }
        if (!ed.business_trial_url && cfg.businessTrialUrl) { ed.business_trial_url = cfg.businessTrialUrl; }
        if (!ed.business_upgrade_checkout_url && cfg.businessUpgradeCheckoutUrl) {
            ed.business_upgrade_checkout_url = cfg.businessUpgradeCheckoutUrl;
        }
        if (!ed.agency_trial_url && cfg.agencyTrialUrl) { ed.agency_trial_url = cfg.agencyTrialUrl; }
        if (!ed.agency_upgrade_checkout_url && cfg.agencyUpgradeCheckoutUrl) {
            ed.agency_upgrade_checkout_url = cfg.agencyUpgradeCheckoutUrl;
        }
        if (cfg.previewFirst) {
            ed.preview_first = true;
            ed.premium_preview = true;
        }
        if (cfg.previewFirstCatalog && !ed.preview_first_catalog) {
            ed.preview_first_catalog = cfg.previewFirstCatalog;
        }
    })(editor);
    if (previewFirstEnabled()) {
        $root.attr('data-preview-first', '1');
    }
    (function clampUntouchedReviewLimit(ed) {
        if (!ed || !ed.config) {
            return;
        }
        var limits = ed.limits || {};
        var catalog = ed.preview_first_catalog || cfg.previewFirstCatalog || {};
        var caps = catalog.max_reviews || {};
        var allowance = parseInt(limits.max_reviews_shown, 10);
        if (isNaN(allowance) || allowance <= 0) {
            allowance = parseInt(limits.max_reviews_display, 10);
        }
        var unlinked = catalog.account_linked === false || catalog.account_linked === 0
            || cfg.isLinked === false || cfg.isLinked === 0 || cfg.isLinked === '0' || cfg.isLinked === '';
        if (unlinked) {
            var unlinkedCap = parseInt(caps.unlinked, 10);
            if (!isNaN(unlinkedCap) && unlinkedCap > 0) {
                allowance = unlinkedCap;
            }
        }
        if (isNaN(allowance) || allowance <= 0 || allowance >= 100000) {
            return;
        }
        var requested = parseInt(ed.config.max_reviews, 10);
        if (isNaN(requested) || requested <= allowance) {
            return;
        }
        var layout = String(ed.layout || (ed.builder && ed.builder.layout) || 'badge_card');
        var theme = ed.config.theme === 'dark' ? 'dark' : 'light';
        var baseline = (((catalog.appearance_baselines || {})[layout] || {})[theme]) || {};
        var baseMax = parseInt(baseline.max_reviews, 10);
        if (isNaN(baseMax) || requested !== baseMax) {
            return;
        }
        ed.config.max_reviews = allowance;
        ed.config.max_reviews_mode = 'max';
    })(editor);
    var editorConfig = $.extend({}, editor.config || {});
    var savedWidgetConfig = $.extend({}, editorConfig);
    // Layout last persisted on the server — used so in-tab layout switches don't let
    // stale badge/sticker saved config override the new layout's preview defaults.
    var persistedLayoutKey = String(editor.layout || $root.data('layout') || 'badge_card');

    function mapLegacyOptionsTab(tab) {
        if (tab !== 'options') {
            return tab;
        }
        if (cfg.mergedSettingsNav
            || ($('.grw-customize__rail-btn[data-grwi-section="settings"]').length
                && !$('.grw-customize__rail-btn[data-grwi-section="options"]').length)) {
            return 'settings';
        }
        return tab;
    }

    function dropLegacyOptionsNav(ed) {
        if (!cfg.mergedSettingsNav || !ed || typeof ed !== 'object') {
            return ed;
        }
        if (!ed.builder || typeof ed.builder !== 'object') {
            ed.builder = {};
        }
        var sections = Array.isArray(ed.builder.sections) ? ed.builder.sections : [];
        ed.builder.sections = sections.filter(function (section) {
            return !(section && section.id === 'options');
        });
        var fields = Array.isArray(ed.builder.fields) ? ed.builder.fields : [];
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
        ed.builder.fields = fields.map(function (field) {
            if (!field) {
                return field;
            }
            var copy = field;
            if (field.section === 'options') {
                copy = $.extend({}, field);
                copy.section = 'settings';
            }
            if ((copy.section === 'settings' || field.section === 'options')
                && (placementFieldKeys[copy.key] || placementGroups[copy.group])) {
                if (copy === field) {
                    copy = $.extend({}, field);
                }
                copy.group = 'placement';
                copy.section = 'settings';
            }
            return copy;
        });
        $('.grw-customize__rail-btn[data-grwi-section="options"]').remove();
        $('[data-grwi-panel="options"]').remove();
        return window.GrwiBuilder && GrwiBuilder.ensureLanguageSeoTabs ? GrwiBuilder.ensureLanguageSeoTabs(ed) : ed;
    }

    function readInitialSection() {
        var fromDom = String($root.data('grwi-active-section') || '').trim();
        fromDom = mapLegacyOptionsTab(fromDom);
        if (fromDom && $('.grw-customize__rail-btn[data-grwi-section="' + fromDom + '"]').length) {
            return fromDom;
        }
        try {
            var params = new URLSearchParams(window.location.search);
            var tab = mapLegacyOptionsTab(String(params.get('tab') || '').trim());
            if (tab && $('.grw-customize__rail-btn[data-grwi-section="' + tab + '"]').length) {
                return tab;
            }
        } catch (e) { /* ignore */ }
        if ($('.grw-customize__rail-btn[data-grwi-section="style"]').length) {
            return 'style';
        }
        return (editor.builder && editor.builder.sections && editor.builder.sections[0])
            ? editor.builder.sections[0].id
            : 'style';
    }

    var activeSection = readInitialSection();
    var lastPreviewConfigJson = '';
    var lastChangedConfigKey = '';
    var pendingPanelScrollTop = null;
    var pendingPageScrollTop = null;
    var dirty = false;
    var savedFingerprint = '';
    var allowNavigateAway = false;

    function configFingerprint(cfg) {
        try {
            return JSON.stringify({
                layout: currentLayoutKey(),
                config: cfg || {},
            });
        } catch (e) {
            return '';
        }
    }

    function currentLayoutKey() {
        return String($root.data('layout') || (editor && editor.layout) || '').trim();
    }

    function ensureLayoutPickerOnEditor(ed) {
        if (window.GrwiBuilder && GrwiBuilder.ensureLanguageSeoTabs) ed = GrwiBuilder.ensureLanguageSeoTabs(ed);
        if (!ed || typeof ed !== 'object') {
            return ed;
        }
        if (!ed.builder || typeof ed.builder !== 'object') {
            ed.builder = {};
        }
        dropLegacyOptionsNav(ed);
        var sections = Array.isArray(ed.builder.sections) ? ed.builder.sections.slice() : [];
        if (!layoutTabEnabled) {
            ed.builder.sections = sections.filter(function (section) {
                return !(section && section.id === 'layout');
            });
            return ed;
        }
        var hasLayout = sections.some(function (section) {
            return section && section.id === 'layout';
        });
        if (!hasLayout) {
            sections.unshift({
                id: 'layout',
                title: 'Layout',
                subtitle: 'Choose a layout to get started with',
            });
            ed.builder.sections = sections;
        }
        if (!ed.builder.layout_catalog && cfg.layoutCatalog) {
            ed.builder.layout_catalog = cfg.layoutCatalog;
        }
        if (!ed.builder.layout_sections && cfg.layoutSections) {
            ed.builder.layout_sections = cfg.layoutSections;
        }
        if (!ed.builder.layout_preview_theme && cfg.layoutPreviewTheme) {
            ed.builder.layout_preview_theme = cfg.layoutPreviewTheme;
        }
        if (typeof ed.trial_eligible === 'undefined' && typeof cfg.trialEligible !== 'undefined') {
            ed.trial_eligible = !!cfg.trialEligible;
        }
        if (!ed.trial_url && cfg.trialUrl) {
            ed.trial_url = cfg.trialUrl;
        }
        if (!ed.upgrade_checkout_url && cfg.upgradeCheckoutUrl) {
            ed.upgrade_checkout_url = cfg.upgradeCheckoutUrl;
        }
        if (!ed.business_trial_url && cfg.businessTrialUrl) {
            ed.business_trial_url = cfg.businessTrialUrl;
        }
        if (!ed.business_upgrade_checkout_url && cfg.businessUpgradeCheckoutUrl) {
            ed.business_upgrade_checkout_url = cfg.businessUpgradeCheckoutUrl;
        }
        if (!ed.agency_trial_url && cfg.agencyTrialUrl) {
            ed.agency_trial_url = cfg.agencyTrialUrl;
        }
        if (!ed.agency_upgrade_checkout_url && cfg.agencyUpgradeCheckoutUrl) {
            ed.agency_upgrade_checkout_url = cfg.agencyUpgradeCheckoutUrl;
        }
        return ed;
    }


    function baselineSavedConfig() {
        try {
            savedFingerprint = configFingerprint(collectConfigFromForm());
        } catch (e) {
            savedFingerprint = configFingerprint(savedWidgetConfig || editorConfig || {});
        }
        dirty = false;
        updateSaveStatus();
    }

    function refreshDirtyState() {
        if (saving) {
            return;
        }
        var next = configFingerprint(collectConfigFromForm());
        dirty = !!savedFingerprint && next !== savedFingerprint;
        updateSaveStatus();
    }

    function updateSaveStatus() {
        var $status = $('#grwi-customize-status');
        var $btn = $('#grwi-customize-save');
        if ($status.length) {
            var state = 'saved';
            var label = i18n.statusSaved || 'Saved';
            if (saving) {
                state = 'saving';
                label = i18n.saving || 'Saving…';
            } else if (dirty) {
                state = 'unsaved';
                label = i18n.statusUnsaved || 'Unsaved changes';
            }
            $status.attr('data-state', state);
            $status.find('.grw-customize__status-text').text(label);
        }
        if ($btn.length && !saving) {
            $btn.prop('disabled', false);
        }
    }

    /** Wait for hosted grw-preview.js (defines grwWhenPreviewReady) before mounting previews. */
    function grwiWhenPreviewReady(cb) {
        if (typeof cb !== 'function') {
            return false;
        }
        if (typeof window.grwiWhenPreviewReady === 'function') {
            window.grwiWhenPreviewReady(cb);
            return true;
        }
        if (typeof window.grwWhenPreviewReady === 'function') {
            window.grwWhenPreviewReady(cb);
            return true;
        }
        if (window.GrwPreview) {
            cb();
            return true;
        }
        return false;
    }

    function showNotice(message, type) {
        var $wrap = $('#grwi-customize-notices');
        if (!$wrap.length) {
            return;
        }
        var tone = type === 'error' ? 'error' : (type === 'warning' ? 'warning' : 'success');
        var icon = tone === 'error' ? 'dismiss' : (tone === 'warning' ? 'warning' : 'yes-alt');
        var $toast = $('<div>', {
            'class': 'grw-toast grw-toast--' + tone,
            'role': 'status',
            'data-grwi-toast': '',
            'data-grwi-toast-autodismiss': '4500'
        })
            .append($('<span>', { 'class': 'dashicons dashicons-' + icon + ' grw-toast__icon', 'aria-hidden': 'true' }))
            .append($('<p>', { 'class': 'grw-toast__text' }).text(message))
            .append($('<button>', {
                type: 'button',
                'class': 'grw-toast__dismiss',
                'data-grwi-toast-dismiss': '',
                'aria-label': i18n.dismiss || 'Dismiss'
            }).html('&times;'));
        $wrap.empty().append($toast);
        armToastAutodismiss($toast);
    }

    function dismissToast($toast) {
        if (!$toast || !$toast.length) {
            return;
        }
        var timer = $toast.data('grwiToastTimer');
        if (timer) {
            window.clearTimeout(timer);
        }
        $toast.addClass('is-leaving');
        window.setTimeout(function () {
            $toast.remove();
        }, 200);
    }

    function armToastAutodismiss($toast) {
        if (!$toast || !$toast.length) {
            return;
        }
        var ms = parseInt($toast.attr('data-grwi-toast-autodismiss') || '4500', 10);
        if (isNaN(ms) || ms <= 0) {
            return;
        }
        var timer = window.setTimeout(function () {
            dismissToast($toast);
        }, ms);
        $toast.data('grwiToastTimer', timer);
    }

    function parseFieldValue($el, key) {
        if ($el.is('[type="checkbox"]')) {
            return $el.prop('checked');
        }
        if ($el.is('[type="number"], [type="range"]')) {
            return parseInt($el.val(), 10);
        }
        if ($el.is('textarea')) {
            return $el.val();
        }
        var raw = $el.val();
        if (key === 'review_order' || key === 'hidden_review_ids' || key === 'badge_element_order' || key === 'sticker_element_order' || key === 'ai_summary_themes') {
            try {
                var decoded = JSON.parse(raw || '[]');
                return Array.isArray(decoded) ? decoded : [];
            } catch (e) {
                return [];
            }
        }
        return raw;
    }

    function syncLinkedConfigKeys(el) {
        var raw = el && el.getAttribute && el.getAttribute('data-grwi-sync-keys');
        if (!raw) {
            return;
        }
        var keys;
        try {
            keys = JSON.parse(raw);
        } catch (e) {
            return;
        }
        if (!Array.isArray(keys) || !keys.length) {
            return;
        }
        var val = (el.type === 'checkbox') ? (el.checked ? '1' : '0') : String(el.value == null ? '' : el.value);
        keys.forEach(function (key) {
            $('[data-config-key="' + key + '"][data-grwi-sync-target]').val(val);
        });
    }

    function collectConfigFromForm() {
        var next = $.extend({}, editorConfig);
        var seenRadio = {};

        $('[data-config-key]').each(function () {
            var key = this.getAttribute('data-config-key');
            if (!key) {
                return;
            }
            if (this.getAttribute('data-grwi-locked-switch') || this.getAttribute('data-grwi-locked-field') || this.disabled) {
                return;
            }
            if (this.type === 'hidden') {
                var hasEnabledCheckbox = $('[data-config-key="' + key + '"]').filter(function () {
                    return this.type === 'checkbox' && !this.disabled && !this.getAttribute('data-grwi-locked-switch');
                }).length;
                if (hasEnabledCheckbox) {
                    return;
                }
            }
            if (this.type === 'radio') {
                if (seenRadio[key]) {
                    return;
                }
                seenRadio[key] = true;
                var $checked = $('[data-config-key="' + key + '"]:checked');
                if ($checked.length) {
                    next[key] = $checked.val();
                }
                return;
            }
            if (this.getAttribute('data-grwi-sync-target')) {
                next[key] = this.value === '1' || this.value === 'true';
                return;
            }
            next[key] = parseFieldValue($(this), key);
        });

        var layoutKey = String((editor && editor.builder && editor.builder.layout) || next.layout || '');
        var widthMode = String(next.widget_width_mode || '').toLowerCase();
        if (widthMode === 'fit' && layoutKey.indexOf('feed_') !== 0) {
            widthMode = 'auto';
            next.widget_width_mode = 'auto';
        }
        if (layoutKey === 'sticker_light' || layoutKey === 'sticker_bold') {
            next.widget_width_mode = 'auto';
            next.widget_width_custom = '';
            next.widget_width = 'auto';
        } else if (layoutKey.indexOf('feed_') === 0 && (widthMode === 'auto' || widthMode === '')) {
            next.widget_width_mode = 'full';
            next.widget_width = '100%';
        } else if (widthMode === 'full') {
            next.widget_width = '100%';
        } else if (widthMode === 'custom') {
            next.widget_width = next.widget_width_custom || next.widget_width || '320px';
        } else if (widthMode) {
            next.widget_width = 'auto';
        }

        return next;
    }

    $(document).on('click', '[data-grwi-generate-ai-summary]', function () {
        var $button=$(this);if($button.prop('disabled'))return;
        var settings=collectConfigFromForm();
        var selection=JSON.stringify([settings.language,settings.ai_summary_language_override,settings.ai_summary_length]);
        $button.prop('disabled',true).text('Generating…');
        $.post(cfg.ajaxUrl,{action:'grwi_generate_ai_summary',nonce:cfg.nonce,embed_key:embedKey,config:JSON.stringify(settings)})
            .done(function(response){
                if(!response || !response.success){showNotice(response && response.data && response.data.message || 'Could not generate the summary.','error');return;}
                var current=collectConfigFromForm();
                if(selection!==JSON.stringify([current.language,current.ai_summary_language_override,current.ai_summary_length])){showNotice('Summary settings changed. Generate again to use the new selection.','info');return;}
                var result=response.data || {};
                editor.config=$.extend({},current,{ai_summary_text:result.text || '',ai_summary_list:result.list || '',ai_summary_themes:result.themes || [],ai_summary_language:result.language || 'en',ai_summary_regenerated_at:result.generated_at || '',ai_summary_review_count:result.review_count || 0});
                editorConfig=$.extend({},editor.config);dirty=true;
                GrwiBuilder.renderAllPanels(editor);mountPreview();updateSaveStatus();
                showNotice('Summary generated. Save or publish to keep it.','success');
            }).fail(function(xhr){showNotice(xhr.responseJSON && xhr.responseJSON.data && xhr.responseJSON.data.message || 'Could not generate the summary.','error');})
            .always(function(){$('[data-grwi-generate-ai-summary]').prop('disabled',aiSummaryLocked()).text('Generate summary');});
    });

    function syncRangeOutputs() {
        $('input[type="range"][data-config-key]').each(function () {
            var id = this.id;
            if (!id) {
                return;
            }
            $('output[for="' + id + '"]').text(String(this.value) + 'px');
        });
    }

    function hostedPreviewPlace(place, reviews, state) {
        var demo = editor.builder && editor.builder.preview && editor.builder.preview.demo_place;
        if (!place) {
            return place;
        }

        var hasCachedReviews = !!(state && state.hasCachedReviews);
        var inPlaceholderState = !!(state && state.placeholder);

        // Badge rating/count = Google place totals when synced — not curated review subset.
        if (hasCachedReviews || !inPlaceholderState) {
            return place;
        }

        if (!demo) {
            return place;
        }

        return $.extend({}, place, {
            rating: demo.rating,
            review_count: demo.review_count,
        });
    }

    function currentPreviewLayout(layout) {
        return layout
            || (previewPayload && previewPayload.layout)
            || $root.data('layout')
            || 'badge_card';
    }

    function planMaxReviewsFromEditor() {
        var limits = (editor && editor.limits) || {};
        var shown = parseInt(limits.max_reviews_shown, 10);
        if (!isNaN(shown) && shown > 0) {
            return shown;
        }
        var display = parseInt(limits.max_reviews_display, 10);
        if (!isNaN(display) && display > 0) {
            return display;
        }
        return null;
    }

    // Max mode must ignore a leftover custom count (e.g. user set 1, then Max).
    // 0 = no cap in previewReviewLimit when builderPreview is on.
    function resolvePreviewMaxReviews(formConfig) {
        formConfig = formConfig || {};
        var mode = String(formConfig.max_reviews_mode || '');
        var planMax = planMaxReviewsFromEditor();
        if (mode === 'max' || (mode !== 'custom' && (formConfig.max_reviews == null || formConfig.max_reviews === ''))) {
            if (planMax != null) {
                return planMax;
            }
            return 0;
        }
        var n = parseInt(formConfig.max_reviews, 10);
        if (!isNaN(n) && n > 0) {
            return n;
        }
        return planMax != null ? planMax : 10;
    }

    function customizeActiveSectionId() {
        return activeSection || String($('.grw-customize').attr('data-grwi-active-section') || '');
    }

    function honorCustomizePlacementInPreview() {
        return customizeActiveSectionId() === 'layout';
    }

    function previewPlacementConfig(config) {
        config = config || {};
        if (honorCustomizePlacementInPreview()) {
            return config;
        }
        return $.extend({}, config, {
            widget_display_mode: 'inline',
        });
    }

    function syncCustomizePreviewAlignment(layout, config) {
        var $previewRoot = $('[data-grwi-preview-root]');
        if (!$previewRoot.length) {
            return;
        }

        layout = currentPreviewLayout(layout);
        config = previewPlacementConfig(config || collectConfigFromForm());
        var isIntrinsic = layout.indexOf('badge_') === 0 || layout.indexOf('sticker_') === 0;
        var displayMode = config.widget_display_mode || 'inline';
        var isFloating = displayMode === 'floating';
        var previewAlign = isIntrinsic ? 'intrinsic' : 'feed';
        $previewRoot.attr('data-grwi-preview-align', previewAlign);
        $previewRoot.attr('data-wb-preview-align', previewAlign);
        $previewRoot.attr('data-grwi-display-mode', isFloating ? 'floating' : 'inline');
        $previewRoot.toggleClass('is-floating-mode', isFloating);

        if (!isFloating) {
            var align = config.widget_align || 'center';
            if (align !== 'left' && align !== 'right') {
                align = 'center';
            }
            $previewRoot.attr('data-grwi-widget-align', align);
            $previewRoot.attr('data-wb-widget-align', align);
        } else {
            $previewRoot.removeAttr('data-grwi-widget-align');
            $previewRoot.removeAttr('data-wb-widget-align');
        }

        var widthMode = String(config.widget_width_mode || '').trim().toLowerCase();
        if (widthMode === 'fit') widthMode='auto';
        if (widthMode === 'fit') widthMode = 'auto';
        if (widthMode !== 'full' && widthMode !== 'custom' && widthMode !== 'auto') {
            widthMode = (layout.indexOf('feed_') === 0) ? 'full' : 'auto';
        }
        if (isFloating) {
            $previewRoot.removeAttr('data-grw-width-mode');
            $mount.removeAttr('data-grw-width-mode');
        } else {
            $previewRoot.attr('data-grw-width-mode', widthMode);
            $mount.attr('data-grw-width-mode', widthMode);
        }

        $mount.attr('data-wb-display-mode', isFloating ? 'floating' : 'inline');
        $mount.removeAttr('data-wb-float-hide-mobile');
        $mount.removeAttr('data-wb-visible-desktop');
        $mount.removeAttr('data-wb-visible-mobile');
    }

    function aiSummaryLocked() {
        return !!(editor.builder && editor.builder.ai_summary && editor.builder.ai_summary.locked);
    }

    function aiSummaryUpgradeMessage() {
        var upgrade = editor.builder && editor.builder.upgrade && editor.builder.upgrade.ai_summary;
        return (upgrade && upgrade.message) || 'AI review summary is available on Business and Agency plans.';
    }

    function withAiSummaryExplorePreview(formConfig) {
        var next = $.extend({}, formConfig || {});
        if (!aiSummaryLocked()) {
            next.ai_summary_upgrade_tease = false;
            return next;
        }
        if (previewFirstEnabled()) {
            next.ai_summary_upgrade_tease = true;
            if (!next.ai_summary_text) {
                next.ai_summary_text = aiSummaryUpgradeMessage();
            }
            return next;
        }
        next.ai_summary_enabled = false;
        next.ai_summary_upgrade_tease = false;
        next.ai_summary_text = '';
        next.ai_summary_list = '';
        next.flyout_show_ai_summary = false;
        return next;
    }

    function stripLockedAiSummaryFromPayload(payload) {
        if (previewFirstEnabled() || !aiSummaryLocked() || !payload) {
            return payload;
        }
        payload.ai_summary_enabled = false;
        payload.ai_summary_text = '';
        payload.ai_summary_list = '';
        payload.ai_summary_style = 'text';
        payload.ai_summary_typing_animation = true;
        payload.ai_summary_picture_animation = true;
        payload.ai_summary_regenerated_at = '';
        payload.ai_summary_review_count = 0;
        payload.ai_summary_label = 'AI Summary';
        payload.ai_summary_star_color = '';
        payload.flyout_show_ai_summary = false;
        return payload;
    }

    function buildPreviewMountOpts(layout, formConfig, reviews) {
        var previewMeta = (editor.builder && editor.builder.preview) || {};
        var layoutChanged = String(layout || '') !== String(persistedLayoutKey || '');
        // After a Layout-tab switch, prefer rehydrated live config over the still-persisted
        // previous-layout snapshot so badge CSS vars don't stick on a feed preview.
        var savedConfig = layoutChanged
            ? $.extend({}, editorConfig || {}, (previewPayload && previewPayload.config) || {}, { layout: layout })
            : $.extend({}, savedWidgetConfig || editorConfig || {}, (previewPayload && previewPayload.config) || {});
        var theme = formConfig.theme || savedConfig.theme || (previewPayload && previewPayload.theme) || 'light';
        var previewOpts = GrwiPreviewOpts.buildSavedWidgetPreviewOpts({
            layout: layout,
            theme: theme,
            savedConfig: savedConfig,
            formOverlay: withAiSummaryExplorePreview(formConfig),
            previewMeta: previewMeta,
            reviews: reviews || [],
            maxReviews: resolvePreviewMaxReviews(formConfig),
            layoutLocked: isPreviewLayoutLocked(layout),
        });
        if (previewOpts.layoutLocked) {
            previewOpts.upgradeMessage = layoutPreviewUpgradeMessage(layout);
            previewOpts.upgradeUrl = layoutPreviewUpgradeUrl(layout);
        }
        applyPluginPanelPreviewOpts(previewOpts, formConfig);
        applyPluginReviewContentPreviewOpts(previewOpts, formConfig, layout);
        if (!honorCustomizePlacementInPreview()) {
            previewOpts.widget_display_mode = 'inline';
        }
        return previewOpts;
    }

    function applyPluginReviewContentPreviewOpts(previewOpts, formConfig, layout) {
        if (!previewOpts || !formConfig) {
            return previewOpts;
        }
        Object.keys(formConfig).forEach(function (key) {
            if (key === 'show_review_photos' || key === 'review_image_filter'
                || key === 'show_view_all' || key === 'feed_review_button_mode'
                || key === 'feed_footer_button_bg_color' || key === 'feed_footer_button_border_color'
                || key === 'feed_columns' || key === 'feed_rows'
                || key === 'feed_initial_review_count' || key === 'feed_load_more_count'
                || key === 'ai_summary_enabled'
                || /_show_review_photos$/.test(key) || /_review_image_filter$/.test(key)
                || /_show_author_avatar$/.test(key) || /_show_view_all$/.test(key)) {
                previewOpts[key] = formConfig[key];
            }
        });
        var family = layoutFamilyFromLayout(layout || previewOpts.layout || '');
        if (family === 'slider') {
            family = 'showcase';
        }
        var photoKey = family + '_show_review_photos';
        var showPhotos;
        if (Object.prototype.hasOwnProperty.call(previewOpts, photoKey)) {
            showPhotos = previewOpts[photoKey] !== false && previewOpts[photoKey] !== 0 && previewOpts[photoKey] !== '0';
        } else if (Object.prototype.hasOwnProperty.call(previewOpts, 'show_review_photos')) {
            showPhotos = previewOpts.show_review_photos !== false && previewOpts.show_review_photos !== 0 && previewOpts.show_review_photos !== '0';
        }
        if (showPhotos !== undefined) {
            previewOpts.show_review_photos = showPhotos;
            previewOpts.showReviewPhotos = showPhotos;
            previewOpts.showReviewImages = showPhotos;
        }
        var avatarKey = family + '_show_author_avatar';
        if (Object.prototype.hasOwnProperty.call(previewOpts, avatarKey)) {
            var showProfilePhotos = previewOpts[avatarKey] !== false && previewOpts[avatarKey] !== 0 && previewOpts[avatarKey] !== '0';
            previewOpts[avatarKey] = showProfilePhotos;
            if (!showProfilePhotos) {
                previewOpts.reviewerAvatars = false;
            }
        }
        return previewOpts;
    }

    var PLUGIN_PANEL_PREVIEW_KEYS = [
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
        'flyout_show_author',
        'flyout_show_date',
        'flyout_show_review_text',
        'flyout_show_write_review_button',
        'flyout_show_ai_summary',
        'flyout_bg',
        'flyout_text',
        'flyout_heading',
        'flyout_border',
        'flyout_button_bg',
        'flyout_button_text',
        'flyout_link',
        'flyout_muted',
        'flyout_star_color',
    ];

    function applyPluginPanelPreviewOpts(previewOpts, formConfig) {
        if (!previewOpts || !formConfig) {
            return previewOpts;
        }
        PLUGIN_PANEL_PREVIEW_KEYS.forEach(function (key) {
            if (Object.prototype.hasOwnProperty.call(formConfig, key)) {
                previewOpts[key] = formConfig[key];
            }
        });
        return previewOpts;
    }

    function syncPluginFlyoutPreview() {
        if (!window.GrwPreview) {
            return;
        }
        var previewRoot = document.querySelector('[data-grwi-preview-root]');
        if (!previewRoot) {
            return;
        }
        var section = customizeActiveSectionId();
        if (section !== 'panel') {
            if (typeof GrwPreview.closeScopedReviewsDrawer === 'function') {
                GrwPreview.closeScopedReviewsDrawer(previewRoot);
            }
            return;
        }
        // tab=panel can activate before previewPayload / mount exist. Never throw —
        // that would abort boot and skip loadPreviewData(), leaving a blank canvas.
        if (!previewPayload || !$mount.length || $mount.attr('data-grw-mounted') !== '1') {
            return;
        }
        if (typeof GrwPreview.syncBuilderFlyoutDrawer !== 'function') {
            return;
        }
        var layout = currentPreviewLayout();
        var formConfig = collectConfigFromForm();
        var reviews = previewPayload.reviews || [];
        var curated = (window.GrwiBuilder && typeof GrwiBuilder.applyReviewCuration === 'function')
            ? GrwiBuilder.applyReviewCuration(reviews, formConfig)
            : reviews;
        var opts = buildPreviewMountOpts(layout, formConfig, curated);
        var mountEl = $mount[0];
        var place = (mountEl && mountEl.__grwLightboxPlace)
            || previewPayload.place
            || null;
        var drawerReviews = (mountEl && Array.isArray(mountEl.__grwDrawerReviews))
            ? mountEl.__grwDrawerReviews
            : curated;
        try {
            GrwPreview.syncBuilderFlyoutDrawer(previewRoot, place, drawerReviews, opts);
        } catch (e) { /* ignore */ }
    }

    function syncPluginFlyoutPreviewAfterMount() {
        syncPluginFlyoutPreview();
        if (customizeActiveSectionId() !== 'panel') {
            return;
        }
        window.requestAnimationFrame(function () {
            syncPluginFlyoutPreview();
        });
    }

    function syncCustomizePreviewForSection() {
        var layout = currentPreviewLayout();
        var formConfig = collectConfigFromForm();
        var reviews = (previewPayload && previewPayload.reviews) || [];
        syncCustomizePreviewAlignment(layout, formConfig);
        patchCustomizePreviewPlacement(layout, formConfig, reviews);
        syncPluginFlyoutPreview();
    }

    function isPreviewLayoutLocked(layoutKey) {
        if (previewFirstEnabled()) {
            return false;
        }
        var catalog = (editor && editor.builder && editor.builder.layout_catalog)
            || cfg.layoutCatalog
            || [];
        var rows = Array.isArray(catalog) ? catalog : [];
        var i;
        var row;
        for (i = 0; i < rows.length; i += 1) {
            row = rows[i] || {};
            if (String(row.key || '') === String(layoutKey || '')) {
                return !!row.locked;
            }
        }
        return false;
    }

    function layoutPreviewUpgradeMessage(layoutKey) {
        var prompt = (editor && editor.layout_prompts && editor.layout_prompts[layoutKey]) || {};
        var generic = (editor && editor.feature_prompts && editor.feature_prompts.premium_layouts) || {};
        return prompt.title
            || generic.title
            || i18n.layoutUpgradeHint
            || 'Unlock 31 layouts with Site';
    }

    function layoutPreviewUpgradeUrl(layoutKey) {
        var prompt = (editor && editor.layout_prompts && editor.layout_prompts[layoutKey]) || {};
        var generic = (editor && editor.feature_prompts && (editor.feature_prompts.premium_layouts || editor.feature_prompts.premium_layout)) || {};
        var feature = prompt.feature || LAYOUT_FEATURE_SLUGS[layoutKey] || 'premium_layouts';
        var url = prompt.checkout_url
            || generic.checkout_url
            || cfg.upgradeCheckoutUrl
            || cfg.upgradeUrl
            || '';
        try {
            var checkout = new URL(url, window.location.origin);
            checkout.searchParams.set('feature', feature);
            if (prompt.plan === 'business' || prompt.plan === 'site' || prompt.plan === 'agency') {
                checkout.searchParams.set('plan', prompt.plan);
            }
            if (layoutKey && LAYOUT_FEATURE_SLUGS[layoutKey]) {
                checkout.searchParams.set('layout', layoutKey);
            } else {
                checkout.searchParams.delete('layout');
            }
            checkout.searchParams.set('section', 'layout');
            if (embedKey) {
                checkout.searchParams.set('widget', embedKey);
            }
            if (cfg.siteId) {
                checkout.searchParams.set('site_id', String(cfg.siteId));
            }
            var existingSource = checkout.searchParams.get('source');
            if (!existingSource || existingSource === 'pricing') {
                checkout.searchParams.set('source', 'wordpress');
            }
            if (checkout.searchParams.get('feature') === 'advanced_customisation') {
                checkout.searchParams.set('feature', feature);
            }
            return checkout.toString();
        } catch (err) {
            return url;
        }
    }

    function patchCustomizePreviewPlacement(layout, formConfig, reviews) {
        if (!$mount.length || $mount.attr('data-grw-mounted') !== '1') {
            return;
        }
        if (!window.GrwPreview || typeof GrwPreview.patchPlacementInPreview !== 'function') {
            return;
        }
        var mountOpts = buildPreviewMountOpts(layout, formConfig, reviews);
        GrwPreview.patchPlacementInPreview($mount[0], mountOpts);
    }

    function layoutFamilyFromLayout(layout) {
        layout = String(layout || '');
        if (layout.indexOf('badge_') === 0) {
            return 'badge';
        }
        if (layout.indexOf('sticker_') === 0) {
            return 'pill';
        }
        // Public Carousel is feed_slider / showcase. Public Slider is feed_carousel / carousel.
        if (layout === 'feed_slider' || layout.indexOf('feed_showcase') === 0 || layout === 'showcase' || layout === 'slider') {
            return 'showcase';
        }
        if (layout.indexOf('feed_') === 0) {
            return layout.replace(/^feed_/, '');
        }
        return layout;
    }

    function isPluginFeedFooterPatchKey(key) {
        if (!key) {
            return false;
        }
        if (key === 'show_view_all' || key === 'feed_review_button_mode') {
            return true;
        }
        if (key === 'feed_footer_button_bg_color' || key === 'feed_footer_button_border_color') {
            return true;
        }
        if (key === 'typo_link_size' || key === 'typo_link_weight' || key === 'typo_link_color') {
            return true;
        }
        return /^(list|carousel|grid|masonry|showcase)_show_view_all$/.test(key);
    }

    function captureCustomizeScrollPositions() {
        var $body = $('.grw-customize__section.is-active .grw-customize__section-body');
        if ($body.length) {
            pendingPanelScrollTop = $body.scrollTop();
        }
        pendingPageScrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
    }

    function restoreCustomizeScrollPositions() {
        var panelTop = pendingPanelScrollTop;
        var pageTop = pendingPageScrollTop;
        pendingPanelScrollTop = null;
        pendingPageScrollTop = null;
        if (panelTop == null && pageTop == null) {
            return;
        }
        function apply() {
            if (panelTop != null) {
                var $body = $('.grw-customize__section.is-active .grw-customize__section-body');
                if ($body.length) {
                    $body.scrollTop(panelTop);
                }
            }
            if (pageTop != null && (window.pageYOffset || document.documentElement.scrollTop || 0) !== pageTop) {
                window.scrollTo(0, pageTop);
            }
        }
        apply();
        window.requestAnimationFrame(function () {
            apply();
            window.requestAnimationFrame(apply);
        });
    }

    function tryPatchCustomizePreview(changedKey) {
        if (!$mount.length || $mount.attr('data-grw-mounted') !== '1' || !window.GrwPreview) {
            return false;
        }

        var layout = currentPreviewLayout();
        var formConfig = collectConfigFromForm();
        var reviews = (previewPayload && previewPayload.reviews) || [];
        var curated = GrwiBuilder.applyReviewCuration(reviews, formConfig);
        var mountOpts = buildPreviewMountOpts(layout, formConfig, curated);
        if (typeof GrwPreview.applyThemeChrome === 'function') {
            mountOpts = GrwPreview.applyThemeChrome($.extend({}, mountOpts));
        }
        var patched = false;

        if (changedKey === 'widget_shadow_enabled') {
            try {
                if (typeof GrwPreview.patchIntrinsicShellShadowInPreview === 'function') {
                    patched = !!GrwPreview.patchIntrinsicShellShadowInPreview($mount[0], mountOpts);
                }
            } catch (e) {
                patched = false;
            }
            if (!patched) {
                return false;
            }
            lastPreviewConfigJson = JSON.stringify(formConfig);
            restoreCustomizeScrollPositions();
            return true;
        }

        if (changedKey === 'card_star_color') {
            try {
                if (typeof GrwPreview.patchCardStarsInPreview === 'function') {
                    patched = !!GrwPreview.patchCardStarsInPreview($mount[0], mountOpts);
                }
            } catch (e) {
                patched = false;
            }
            if (!patched) {
                return false;
            }
            lastPreviewConfigJson = JSON.stringify(formConfig);
            restoreCustomizeScrollPositions();
            return true;
        }

        if (changedKey === 'google_logo_color') {
            try {
                if (typeof GrwPreview.patchGoogleColoredWordInPreview === 'function') {
                    patched = !!GrwPreview.patchGoogleColoredWordInPreview($mount[0], mountOpts);
                }
                if (typeof GrwPreview.patchGoogleLogoChromeInPreview === 'function') {
                    patched = !!GrwPreview.patchGoogleLogoChromeInPreview($mount[0], mountOpts) || patched;
                }
            } catch (e) {
                patched = false;
            }
            if (!patched) {
                return false;
            }
            lastPreviewConfigJson = JSON.stringify(formConfig);
            restoreCustomizeScrollPositions();
            return true;
        }

        if (isPluginFeedFooterPatchKey(changedKey)) {
            try {
                if (typeof GrwPreview.patchFeedReviewsFooterInPreview === 'function') {
                    var footerPlace = hostedPreviewPlace(previewPayload.place || {}, curated, {
                        hasCachedReviews: previewPayload && previewPayload.has_cached_reviews,
                        placeholder: previewPayload && previewPayload.placeholder,
                    });
                    patched = !!GrwPreview.patchFeedReviewsFooterInPreview($mount[0], mountOpts, footerPlace);
                }
            } catch (e) {
                patched = false;
            }
            if (!patched) {
                return false;
            }
            lastPreviewConfigJson = JSON.stringify(formConfig);
            restoreCustomizeScrollPositions();
            return true;
        }

        if (!isCustomizeTypographyPatchKey(changedKey)) {
            return false;
        }

        var family = layoutFamilyFromLayout(layout);
        var place = hostedPreviewPlace(previewPayload.place || {}, curated, {
            hasCachedReviews: previewPayload && previewPayload.has_cached_reviews,
            placeholder: previewPayload && previewPayload.placeholder,
        });

        try {
            if (shouldCustomizeRemountBadgeForTypography(changedKey, layout)) {
                if (typeof GrwPreview.patchBadgeChromeInPreview !== 'function' ||
                    !GrwPreview.patchBadgeChromeInPreview($mount[0], mountOpts, place)) {
                    return false;
                }
                patched = true;
            } else if (shouldCustomizeRemountStickerForTypography(changedKey, layout)) {
                if (typeof GrwPreview.patchPillStickerChromeInPreview !== 'function' ||
                    !GrwPreview.patchPillStickerChromeInPreview($mount[0], mountOpts, place)) {
                    return false;
                }
                patched = true;
            }
            if (typeof GrwPreview.patchTypographyInPreview === 'function') {
                patched = !!GrwPreview.patchTypographyInPreview($mount[0], mountOpts) || patched;
            }
        } catch (e) {
            return false;
        }

        if (!patched) {
            return false;
        }

        lastPreviewConfigJson = JSON.stringify(formConfig);
        restoreCustomizeScrollPositions();
        return true;
    }

    function isCustomizeTypographyPatchKey(key) {
        if (!key) {
            return false;
        }
        if (key === 'font_family_preset' || key === 'font_source') {
            return true;
        }
        return /^typo_[a-z_]+_(size|color|weight)$/.test(key);
    }

    function customizeTypoRoleFromFieldName(fieldName) {
        var match = String(fieldName || '').match(/^typo_([a-z_]+)_(size|color|weight)$/);
        return match ? match[1] : '';
    }

    function shouldCustomizeRemountStickerForTypography(fieldName, layout) {
        layout = String(layout || '');
        if (layout.indexOf('sticker_') !== 0 && layoutFamilyFromLayout(layout) !== 'pill') {
            return false;
        }
        if (fieldName === 'font_family_preset' || fieldName === 'font_source') {
            return true;
        }
        return ['rating_label', 'rating_value', 'review_count'].indexOf(customizeTypoRoleFromFieldName(fieldName)) >= 0;
    }

    function shouldCustomizeRemountBadgeForTypography(fieldName, layout) {
        if (layoutFamilyFromLayout(layout) !== 'badge') {
            return false;
        }
        return fieldName === 'font_family_preset' || fieldName === 'font_source';
    }

    function mountPublishedPreview() {
        var live = editor.live_preview && editor.live_preview.payload;
        if (!$mount.length || !live || !window.GrwPreview || typeof GrwPreview.mount !== 'function') {
            return;
        }
        var business = live.business || {};
        var place = {
            business_name: business.name || business.business_name || '',
            place_id: business.place_id || '',
            rating: business.rating,
            review_count: business.review_count,
            formatted_address: business.formatted_address || business.address || '',
            profile_url: business.profile_url || business.googleMapsUri || ''
        };
        var config = live.config || {};
        var reviews = Array.isArray(live.reviews) ? live.reviews : [];
        $mount.empty();
        try {
            var liveOpts = $.extend({}, config, {
                demo: false,
                reviews: reviews,
                loading: false,
                theme: config.theme === 'dark' ? 'dark' : 'light',
                layoutLocked: false,
                upgradeMessage: null
            });
            liveOpts.builderPreview = true;
            GrwPreview.mount($mount[0], place, live.layout, liveOpts);
        } catch (e) {
            $mount.html('<p class="grw-hint">' + (i18n.previewFailed || 'Could not load preview.') + '</p>');
        }
    }

    function mountPreview() {
        if (window.grwiLivePreviewActive) {
            mountPublishedPreview();
            return;
        }
        if (!$mount.length || !previewPayload || !window.GrwPreview || !window.GrwiBuilder || !window.GrwiPreviewOpts) {
            return;
        }

        var layout = currentLayoutKey() || previewPayload.layout || 'badge_card';
        var place = previewPayload.place || {};
        var reviews = previewPayload.reviews || [];
        var formConfig = collectConfigFromForm();
        var curated = GrwiBuilder.applyReviewCuration(reviews, formConfig);
        var mountOpts = buildPreviewMountOpts(layout, formConfig, curated);

        $mount.empty();
        try {
            GrwPreview.mount(
                $mount[0],
                hostedPreviewPlace(place, curated, {
                    hasCachedReviews: previewPayload && previewPayload.has_cached_reviews,
                    placeholder: previewPayload && previewPayload.placeholder,
                }),
                layout,
                mountOpts
            );
            syncCustomizePreviewAlignment(layout, formConfig);
            patchCustomizePreviewPlacement(layout, formConfig, curated);
            if (window.GrwPreview && typeof GrwPreview.ensureBuilderPreviewFullyVisible === 'function') {
                GrwPreview.ensureBuilderPreviewFullyVisible();
            }
            syncPluginFlyoutPreviewAfterMount();
            lastPreviewConfigJson = JSON.stringify(formConfig);
        } catch (e) {
            $mount.html('<p class="grw-hint">' + (i18n.previewFailed || 'Could not load preview.') + '</p>');
        }
    }

    function runScheduledPreview() {
        lastPreviewRunAt = Date.now();
        if (window.grwiLivePreviewActive) {
            mountPublishedPreview();
            return;
        }
        if (window.GrwiCustomizeLayout && typeof GrwiCustomizeLayout.syncPreviewFirstBanner === 'function') {
            GrwiCustomizeLayout.syncPreviewFirstBanner();
        }
        var config = collectConfigFromForm();
        var nextJson = JSON.stringify(config);
        var layout = currentPreviewLayout();
        if (nextJson === lastPreviewConfigJson && $mount.attr('data-grw-mounted') === '1') {
            syncCustomizePreviewAlignment(layout, config);
            patchCustomizePreviewPlacement(layout, config, (previewPayload && previewPayload.reviews) || []);
            syncPluginFlyoutPreview();
            return;
        }
        if (tryPatchCustomizePreview(lastChangedConfigKey)) {
            return;
        }
        lastPreviewConfigJson = nextJson;
        mountPreview();
    }

    function refreshConditionalFormFields(changedKey) {
        if (!window.GrwiBuilder || typeof GrwiBuilder.refreshConditionalSections !== 'function') {
            return;
        }
        var builder = editor.builder || {};
        if (typeof GrwiBuilder.fieldDependsOnKey === 'function') {
            var conditionalFields = typeof GrwiBuilder.builderConditionalFields === 'function'
                ? GrwiBuilder.builderConditionalFields(builder)
                : builder.fields;
            if (!GrwiBuilder.fieldDependsOnKey(conditionalFields, changedKey)) {
                return;
            }
        }
        var config = collectConfigFromForm();
        if (changedKey === 'widget_border_style' && window.GrwiBuilder && typeof GrwiBuilder.syncWidgetBorderWidthDefault === 'function') {
            var layout = (editor.builder || {}).layout || editor.layout || 'badge_card';
            var previousStyle = String((editor.config || editorConfig || {}).widget_border_style || 'solid').trim();
            config = GrwiBuilder.syncWidgetBorderWidthDefault(config, layout, previousStyle);
        }
        editorConfig = $.extend({}, editorConfig, config);
        editor.config = editorConfig;
        if (GrwiBuilder.refreshConditionalSections(editor, changedKey, activeSection)) {
            bindPanelInteractions();
            restoreCustomizeScrollPositions();
        }
    }

    // Colour pickers (and other inputs) can fire many rapid `input` events while the
    // user drags — e.g. dragging inside a native <input type="color"> picker. A plain
    // debounce (fire only after events stop) meant the live preview only updated on
    // mouse release, making colour changes feel laggy/unresponsive while dragging.
    // This throttles updates to run at most every PREVIEW_THROTTLE_MS during a
    // continuous drag, while still scheduling one trailing call so the final value
    // is always reflected once input settles.
    function schedulePreview() {
        clearTimeout(previewTimer);
        refreshDirtyState();
        var now = Date.now();
        var elapsed = now - lastPreviewRunAt;
        if (elapsed >= PREVIEW_THROTTLE_MS) {
            runScheduledPreview();
            return;
        }
        previewTimer = window.setTimeout(runScheduledPreview, PREVIEW_THROTTLE_MS - elapsed);
    }

    function loadPreviewData() {
        if (!embedKey) {
            return;
        }

        $.post(cfg.ajaxUrl, {
            action: 'grwi_get_widget_preview',
            nonce: cfg.nonce,
            embed_key: embedKey,
        }).done(function (response) {
            if (!response || !response.success) {
                return;
            }
            // Review responses may describe the published widget. The editor owns the
            // current saved draft and any changes made while this request was in flight.
            previewPayload = $.extend({}, response.data || {}, {
                layout: currentLayoutKey() || (response.data || {}).layout || 'badge_card',
                config: $.extend({}, editorConfig),
            });
            var $sub = $('#grwi-customize-preview-sub');
            if ($sub.length) {
                if (previewPayload.has_cached_reviews) {
                    $sub.text(i18n.previewReady || 'Showing your synced Google reviews.');
                } else if (previewPayload.placeholder) {
                    $sub.text(previewPayload.placeholder);
                }
            }
            if (!grwiWhenPreviewReady(mountPreview)) {
                mountPreview();
            }
            if (!dirty) {
                baselineSavedConfig();
            }
        });
    }

    function syncSectionUrl(section, mode) {
        try {
            var url = new URL(window.location.href);
            section = mapLegacyOptionsTab(String(section || '').trim());
            if (!section || url.searchParams.get('tab') === section) {
                return;
            }
            url.searchParams.set('tab', section);
            if (mode === 'replace' && window.history.replaceState) {
                window.history.replaceState({ grwiSection: section }, '', url.toString());
            } else if (window.history.pushState) {
                window.history.pushState({ grwiSection: section }, '', url.toString());
            }
        } catch (e) { /* ignore */ }
    }

    function activateSection(section, options) {
        if (!section) {
            return;
        }
        options = options || {};
        section = mapLegacyOptionsTab(section);
        activeSection = section;
        var $tabs = $('.grw-customize__rail-btn[data-grwi-section]');
        $tabs.removeClass('is-active').attr('aria-selected', 'false').attr('tabindex', '-1');
        var $active = $tabs.filter('[data-grwi-section="' + section + '"]');
        $active.addClass('is-active').attr('aria-selected', 'true').attr('tabindex', '0');
        $('.grw-customize__section').attr('hidden', true).removeClass('is-active');
        $('.grw-customize__section[data-grwi-panel="' + section + '"]').removeAttr('hidden').addClass('is-active');
        $('.grw-customize').attr('data-grwi-active-section', section);
        if (!options.skipHistory) {
            syncSectionUrl(section, options.replaceHistory ? 'replace' : 'push');
        }
        syncCustomizePreviewForSection();
        if (window.GrwiBuilder && typeof window.GrwiBuilder.syncAccordionSummaries === 'function') {
            window.GrwiBuilder.syncAccordionSummaries(
                document.querySelector('.grw-customize__section[data-grwi-panel="' + section + '"]')
            );
        }
        if (section === 'layout' && window.GrwiCustomizeLayout) {
            GrwiCustomizeLayout.mountLayoutGalleryPreviews();
            requestAnimationFrame(function () {
                GrwiCustomizeLayout.refitMountedLayoutGalleryPreviews();
            });
        }
    }

    function navigateAway(url) {
        var target = String(url || cfg.dashboardUrl || '').trim();
        if (!target) {
            return;
        }
        allowNavigateAway = true;
        dirty = false;
        window.location.href = target;
    }

    /**
     * @param {Object=} options
     * @param {function():void=} options.onSuccess Called after a successful save (before toast/preview refresh).
     * @param {function(string):void=} options.onError
     * @param {boolean=} options.skipUiRefresh When true, skip toast + preview reload (e.g. Save & leave).
     */
    function saveWidget(options) {
        options = options || {};
        if (saving || !embedKey) {
            return;
        }

        saving = true;
        var $btn = $('#grwi-customize-save');
        $btn.prop('disabled', true).text(i18n.saving || 'Saving…');
        updateSaveStatus();

        var payload = stripLockedAiSummaryFromPayload($.extend({}, collectConfigFromForm()));
        var skipUiRefresh = !!options.skipUiRefresh;
        var onSuccess = typeof options.onSuccess === 'function' ? options.onSuccess : null;
        var onError = typeof options.onError === 'function' ? options.onError : null;

        $.post(cfg.ajaxUrl, {
            action: 'grwi_save_widget',
            nonce: cfg.nonce,
            embed_key: embedKey,
            layout: $root.data('layout') || '',
            config: JSON.stringify(payload),
            save_mode: options.saveMode || (previewFirstEnabled() ? 'auto' : ''),
            publish_plan_safe: options.publishPlanSafe ? '1' : '',
        }).done(function (response) {
            if (!response || !response.success) {
                var errData = (response && response.data) ? response.data : {};
                if (errData.publish_blocked && previewFirstEnabled()) {
                    if (window.GrwiCustomizeLayout && typeof GrwiCustomizeLayout.showPreviewFirstPublishModal === 'function') {
                        GrwiCustomizeLayout.showPreviewFirstPublishModal(errData.requirement || editor.requirement);
                    }
                    if (onError) {
                        onError(errData.message || '');
                    }
                    return;
                }
                var err = errData.message
                    ? errData.message
                    : (i18n.saveFailed || 'Could not save widget styling.');
                showNotice(err, 'error');
                if (onError) {
                    onError(err);
                }
                return;
            }

            var nextEditor = response.data && response.data.editor;
            if (nextEditor) {
                editor = ensureLayoutPickerOnEditor(nextEditor);
                if (nextEditor.config) {
                    editorConfig = $.extend({}, nextEditor.config);
                    savedWidgetConfig = $.extend({}, nextEditor.config);
                }
                var savedLayout = (nextEditor.builder && nextEditor.builder.layout)
                    || nextEditor.layout
                    || $root.data('layout')
                    || '';
                if (savedLayout) {
                    persistedLayoutKey = String(savedLayout);
                    $root.attr('data-layout', savedLayout).data('layout', savedLayout);
                }
                if (nextEditor.business_trial_url) {
                    editor.business_trial_url = nextEditor.business_trial_url;
                }
                if (nextEditor.business_upgrade_checkout_url) {
                    editor.business_upgrade_checkout_url = nextEditor.business_upgrade_checkout_url;
                }
                var savedLabel = (nextEditor.builder && nextEditor.builder.layout_label)
                    || (nextEditor.widget && nextEditor.widget.layout_label)
                    || '';
                if (savedLabel) {
                    $('.grw-customize__subtitle').text((i18n.editingSubtitle || '%s · Editing').replace('%s', savedLabel));
                }
                if (!skipUiRefresh && window.GrwiBuilder) {
                    GrwiBuilder.renderAllPanels(editor);
                    bindPanelInteractions();
                    if (window.GrwiCustomizeLayout) {
                        GrwiCustomizeLayout.mountLayoutGalleryPreviews();
                    }
                }
            } else {
                savedWidgetConfig = $.extend({}, payload);
                editorConfig = $.extend({}, editorConfig, payload);
            }
            baselineSavedConfig();
            if (onSuccess) {
                onSuccess();
            }
            if (skipUiRefresh) {
                return;
            }
            var draftStillDiffers = nextEditor && nextEditor.live_preview
                ? !!nextEditor.live_preview.show_toggle
                : !!(nextEditor && nextEditor.has_unpublished_draft);
            showNotice(
                draftStillDiffers
                    ? (i18n.previewFirstDraftSaved || 'Draft saved. Your current live widget is unchanged.')
                    : (i18n.saved || 'Widget styling saved.'),
                'success'
            );
            applySavedLiveDraftState(nextEditor);
        }).fail(function (xhr) {
            var failData = (xhr.responseJSON && xhr.responseJSON.data) ? xhr.responseJSON.data : {};
            if (failData.publish_blocked && previewFirstEnabled()) {
                if (window.GrwiCustomizeLayout && typeof GrwiCustomizeLayout.showPreviewFirstPublishModal === 'function') {
                    GrwiCustomizeLayout.showPreviewFirstPublishModal(failData.requirement || editor.requirement);
                }
                if (onError) {
                    onError(failData.message || '');
                }
                return;
            }
            var failMsg = failData.message || i18n.saveFailed || 'Could not save widget styling.';
            showNotice(failMsg, 'error');
            if (onError) {
                onError(failMsg);
            }
        }).always(function () {
            saving = false;
            $btn.prop('disabled', false).text(i18n.save || 'Save changes');
            refreshDirtyState();
        });
    }

    function updateReviewCurationHidden() {
        var order = [];
        var hidden = [];
        $('#grwi-review-list .grw-review-item').each(function () {
            var id = $(this).data('review-id');
            if (!id) {
                return;
            }
            order.push(String(id));
            if (!$(this).find('.grw-review-item__toggle').prop('checked')) {
                hidden.push(String(id));
            }
        });
        $('[data-config-key="review_order"]').val(JSON.stringify(order));
        $('[data-config-key="hidden_review_ids"]').val(JSON.stringify(hidden));
    }

    function updateElementOrderHidden($list) {
        var order = [];
        $list.find('.grw-order-item').each(function () {
            order.push(String($(this).data('order-value')));
        });
        var key = $list.closest('[data-grwi-element-order]').data('grwi-element-order');
        if (key) {
            $('[data-config-key="' + key + '"]').val(JSON.stringify(order));
        }
    }

    function isOuterSpacingLinked($link) {
        return $link.length && $link.attr('aria-pressed') === 'true';
    }

    function syncOuterSpacingLinkLabel($link) {
        if (!$link || !$link.length) {
            return;
        }
        var linked = isOuterSpacingLinked($link);
        $link.attr('aria-label', linked ? 'Unlink sides — edit each side separately' : 'Link all sides — use one value for all');
        $link.attr('title', linked ? 'Unlink sides' : 'Link all sides');
    }

    function syncAllOuterSpacingLinkLabels() {
        $('.grw-outer-spacing__link').each(function () {
            syncOuterSpacingLinkLabel($(this));
        });
    }

    function syncOuterSpacingLinkedFields($wrap, changedEl) {
        if (!$wrap || !$wrap.length) {
            return;
        }
        var $link = $wrap.find('.grw-outer-spacing__link').first();
        if (!isOuterSpacingLinked($link)) {
            return;
        }
        var $inputs = $wrap.find('.grw-outer-spacing__input[data-config-key]');
        var $source = changedEl ? $(changedEl) : $inputs.first();
        if (!$source.length) {
            return;
        }
        var value = String($source.val() || '0');
        $inputs.each(function () {
            if (!$source.is(this)) {
                $(this).val(value);
            }
        });
    }

    function updateLanguageExample() {
        var node = document.querySelector('[data-grwi-language-example]');
        if (!node || !window.GrwI18n) return;
        var language = $('[data-config-key="language"]').val() || (editor && editor.config && editor.config.language) || 'auto';
        var config = { language: language, language_mode: language === 'auto' ? 'auto' : 'fixed' };
        GrwI18n.configure(node, config);
        GrwI18n.html(node, GrwI18n.msg('reviews.based_on', { count: 127 }) + ' · ' + GrwI18n.msg('reviews.read_more'), config);
    }

    function syncSeoState() {
        var node = document.querySelector('.wb-seo-panel');
        if (!node) return;
        var field = document.querySelector('[data-config-key="enable_json_ld"]');
        var enabled = !!(field && field.checked);
        node.classList.toggle('is-off', !enabled);
        var state = node.querySelector('[data-grwi-seo-state]');
        if (state) state.textContent = enabled ? 'Active' : 'Disabled';
    }

    function bindPanelInteractions() {
        syncSeoState();
        updateLanguageExample();
        syncRangeOutputs();
        syncAllOuterSpacingLinkLabels();
        if (window.GrwiBuilder && typeof GrwiBuilder.syncAllColorFieldSwatches === 'function') {
            GrwiBuilder.syncAllColorFieldSwatches(editor);
        }
    }

    $(document).on('pointerdown mousedown', '.grw-outer-spacing__link, .grw-outer-spacing__input', function (e) {
        e.stopPropagation();
    });

    $(document).on('click', '.grw-outer-spacing__link', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var $link = $(this);
        if ($link.prop('disabled') || $link.attr('aria-disabled') === 'true') {
            return;
        }
        var linked = isOuterSpacingLinked($link);
        $link.attr('aria-pressed', linked ? 'false' : 'true');
        syncOuterSpacingLinkLabel($link);
        if (!linked) {
            syncOuterSpacingLinkedFields($link.closest('.grw-outer-spacing'), null);
        }
        schedulePreview();
    });

    $(document).on('input change', '.grw-outer-spacing__input[data-config-key]', function () {
        syncOuterSpacingLinkedFields($(this).closest('.grw-outer-spacing'), this);
    });

    $(document).on('click', '.grw-customize__rail-btn[data-grwi-section]', function () {
        activateSection($(this).data('grwi-section'));
    });

    $(document).on('click', '[data-grwi-open-section]', function (e) {
        e.preventDefault();
        activateSection($(this).attr('data-grwi-open-section'));
    });

    try {
        var bootParams = new URLSearchParams(window.location.search);
        if (bootParams.get('tab') === 'options' && activeSection === 'settings') {
            syncSectionUrl(activeSection, 'replace');
        }
    } catch (e) { /* ignore */ }

    $(window).on('popstate', function () {
        activateSection(readInitialSection(), { skipHistory: true });
    });

    $(document).on('keydown', '.grw-customize__rail-btn[data-grwi-section]', function (e) {
        var key = e.key;
        if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'Home' && key !== 'End') {
            return;
        }
        e.preventDefault();
        var $tabs = $('.grw-customize__rail-btn[data-grwi-section]');
        var index = $tabs.index(this);
        if (index < 0) {
            return;
        }
        var next = index;
        if (key === 'ArrowDown') {
            next = (index + 1) % $tabs.length;
        } else if (key === 'ArrowUp') {
            next = (index - 1 + $tabs.length) % $tabs.length;
        } else if (key === 'Home') {
            next = 0;
        } else if (key === 'End') {
            next = $tabs.length - 1;
        }
        var $next = $tabs.eq(next);
        activateSection($next.data('grwi-section'));
        $next.trigger('focus');
    });

    $(document).on('change', 'input[type="radio"][name^="grwi-"]', function () {
        if (this.disabled || this.getAttribute('data-grwi-locked-field') || this.getAttribute('aria-disabled') === 'true') {
            return;
        }
        var name = this.name.replace(/^grwi-/, '');
        $('[data-config-key="' + name + '"]').val(this.value);
        var $group = $(this).closest('.grw-segmented');
        if ($group.length) {
            $group.find('.grw-segmented__option').removeClass('is-selected');
            $(this).closest('.grw-segmented__option').addClass('is-selected');
        }
        lastChangedConfigKey = name;
        refreshConditionalFormFields(name);
        schedulePreview();
    });

    $(document).on('mousedown', '.grw-style-toggle', function (e) {
        if (e.button !== 0) {
            return;
        }
        captureCustomizeScrollPositions();
        e.preventDefault();
    });

    $(document).on('click', '.grw-style-toggle', function (e) {
        e.preventDefault();
        var $input = $(this).find('.grw-style-toggle__input');
        if (!$input.length) {
            return;
        }
        if ($input.prop('disabled') || $input.attr('data-grwi-locked-field') || $input.attr('data-grwi-locked-switch')) {
            return;
        }
        $input.prop('checked', !$input.prop('checked')).trigger('change');
    });

    $(document).on('mousedown', '.grw-select__native', function () {
        if (this.disabled || this.getAttribute('data-grwi-locked-field') || this.getAttribute('aria-disabled') === 'true') {
            return;
        }
        $('.grw-select.is-open').removeClass('is-open');
        $(this).closest('.grw-select').addClass('is-open');
    });

    $(document).on('blur', '.grw-select__native', function () {
        $(this).closest('.grw-select').removeClass('is-open');
    });

    $(document).on('change', '.grw-select__native', function () {
        $(this).closest('.grw-select').removeClass('is-open');
    });

    $(document).on('keydown', '.grw-select__native', function (e) {
        if (this.disabled) {
            return;
        }
        if (e.key === 'Escape') {
            $(this).closest('.grw-select').removeClass('is-open');
            return;
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === ' ' || e.key === 'Enter') {
            $(this).closest('.grw-select').addClass('is-open');
        }
    });

    function setConfigFieldValue($field, value) {
        $field.val(value);
        var node = $field.get ? $field.get(0) : null;
        if (node && typeof node.dispatchEvent === 'function') {
            node.dispatchEvent(new Event('input', { bubbles: true }));
            node.dispatchEvent(new Event('change', { bubbles: true }));
        }
        $field.trigger('change');
    }

    $(document).on('change', '[data-grwi-review-limit] .grw-segmented__input', function () {
        if (this.disabled || this.getAttribute('aria-disabled') === 'true') {
            return;
        }
        var $wrap = $(this).closest('[data-grwi-review-limit]');
        var key = $wrap.attr('data-grwi-review-limit');
        var mode = this.value;
        var planMax = parseInt($wrap.attr('data-grwi-review-limit-plan-max'), 10);
        var unlimited = $wrap.attr('data-grwi-review-limit-unlimited') === '1';
        var $customWrap = $wrap.find('.grw-review-limit-custom');
        var $hidden = $wrap.find('[data-config-key="' + key + '"]');
        var $custom = $wrap.find('[data-grwi-review-limit-custom="' + key + '"]');
        $wrap.find('.grw-segmented__option').removeClass('is-selected');
        $(this).closest('.grw-segmented__option').addClass('is-selected');
        $wrap.find('[data-grwi-review-limit-mode-value="' + key + '"]').val(mode);
        if (mode === 'custom') {
            $customWrap.prop('hidden', false);
            var customVal = parseInt($custom.val(), 10);
            if (isNaN(customVal) || customVal < 1) {
                customVal = 1;
                $custom.val(customVal);
            }
            var previewMax = parseInt($wrap.attr('data-grwi-review-limit-preview-max'), 10);
            var absMax = (!isNaN(previewMax) && previewMax > 0) ? previewMax : null;
            if (absMax != null && customVal > absMax) {
                customVal = absMax;
                $custom.val(customVal);
            }
            setConfigFieldValue($hidden, customVal);
            return;
        }
        $customWrap.prop('hidden', true);
        var maxVal = (!unlimited && !isNaN(planMax) && planMax > 0)
            ? planMax
            : planMaxReviewsFromEditor();
        if (maxVal != null && maxVal > 0) {
            setConfigFieldValue($hidden, maxVal);
            return;
        }
        // Unlimited Max: clear the leftover custom count so preview/curation show all.
        setConfigFieldValue($hidden, '');
    });
    $(document).on('input change', '[data-grwi-review-limit-custom]', function () {
        var key = this.getAttribute('data-grwi-review-limit-custom');
        var $wrap = $(this).closest('[data-grwi-review-limit]');
        var planMax = parseInt($wrap.attr('data-grwi-review-limit-plan-max'), 10);
        var unlimited = $wrap.attr('data-grwi-review-limit-unlimited') === '1';
        var n = parseInt(this.value, 10);
        if (isNaN(n) || n < 1) {
            n = 1;
            this.value = n;
        }
        var previewMax = parseInt($wrap.attr('data-grwi-review-limit-preview-max'), 10);
        var absMax = (!isNaN(previewMax) && previewMax > 0) ? previewMax : null;
        if (absMax != null && n > absMax) {
            n = absMax;
            this.value = n;
        }
        var $hiddenField = $('[data-config-key="' + key + '"]');
        setConfigFieldValue($hiddenField, n);
    });

    function syncWidthCustomHidden($wrap) {
        if (!$wrap || !$wrap.length) {
            return;
        }
        var number = $wrap.find('.grw-width-custom__number').val();
        var unit = $wrap.find('.grw-width-custom__unit.is-selected').attr('data-grwi-width-unit') || 'px';
        var composed = (window.GrwiBuilder && typeof window.GrwiBuilder.composeWidthCustomValue === 'function')
            ? window.GrwiBuilder.composeWidthCustomValue(number, unit)
            : (String(number || '320') + unit);
        $wrap.find('[data-config-key]').val(composed).trigger('change');
    }

    $(document).on('input change', '.grw-width-custom__number', function () {
        syncWidthCustomHidden($(this).closest('[data-grwi-width-custom]'));
    });

    $(document).on('click', '.grw-width-custom__unit', function () {
        var $wrap = $(this).closest('[data-grwi-width-custom]');
        $wrap.find('.grw-width-custom__unit').removeClass('is-selected');
        $(this).addClass('is-selected');
        syncWidthCustomHidden($wrap);
    });

    $(document).on('click','[data-grwi-reset-appearance]',function(){
        if(!window.GrwiBuilder || !GrwiBuilder.resetAppearanceConfig)return;
        captureCustomizeScrollPositions();
        editorConfig=GrwiBuilder.resetAppearanceConfig(editor,collectConfigFromForm());
        editor.config=editorConfig;
        GrwiBuilder.renderAllPanels(editor);bindPanelInteractions();
        lastChangedConfigKey='';lastPreviewConfigJson='';schedulePreview();restoreCustomizeScrollPositions();
    });

    $(document).on('input change', '[data-config-key]', function () {
        if (this.getAttribute('data-grwi-locked-switch') || this.getAttribute('data-grwi-locked-field') || this.disabled) {
            if (this.type === 'checkbox') {
                this.checked = this.defaultChecked;
            }
            if (this.getAttribute('role') === 'switch') {
                this.setAttribute('aria-checked', this.checked ? 'true' : 'false');
            }
            return;
        }
        syncLinkedConfigKeys(this);
        syncDuplicateConfigKeyControls(this);
        syncRangeOutputs();
        if (this.getAttribute('role') === 'switch') {
            this.setAttribute('aria-checked', this.checked ? 'true' : 'false');
        }
        var key = this.getAttribute('data-config-key');
        if (key === 'language') updateLanguageExample();
        if (key === 'enable_json_ld') syncSeoState();
        if (key) {
            lastChangedConfigKey = key;
            refreshConditionalFormFields(key);
        }
        schedulePreview();
    });

    function syncDuplicateConfigKeyControls(el) {
        var key = el && el.getAttribute && el.getAttribute('data-config-key');
        if (!key) {
            return;
        }
        var $others = $('[data-config-key="' + key + '"]').not(el);
        if (!$others.length) {
            return;
        }
        if (el.type === 'checkbox') {
            $others.filter('input[type="checkbox"]').prop('checked', el.checked);
            $others.filter('[role="switch"]').each(function () {
                this.setAttribute('aria-checked', el.checked ? 'true' : 'false');
            });
            return;
        }
        var value = el.value;
        $others.each(function () {
            if (this.type === 'checkbox' || this.type === 'radio') {
                return;
            }
            $(this).val(value);
        });
    }

    // Colour swatches are visual-only (native <input type="color"> can't represent an
    // empty/"inherit" value) — sync the picked hex into the paired hidden field that
    // collectConfigFromForm() actually reads.
    $(document).on('input change', '.grw-color-input', function () {
        var $field = $(this).closest('[data-grwi-color-field]');
        var key = $field.data('grwi-color-field');
        if (!key) {
            return;
        }
        $field.removeClass('is-unset is-multicolour');
        $('[data-config-key="' + key + '"]').val(this.value);
        $field.find('.grw-color-hex').val(String(this.value || '').toUpperCase());
        schedulePreview();
    });

    $(document).on('change blur', '.grw-color-hex', function () {
        var $field = $(this).closest('[data-grwi-color-field]');
        var key = $field.data('grwi-color-field');
        if (!key) {
            return;
        }
        var raw = String(this.value || '').trim();
        if (!raw) {
            $('[data-config-key="' + key + '"]').val('');
            $field.addClass('is-unset');
            if (window.GrwiBuilder && typeof GrwiBuilder.syncColorFieldSwatch === 'function') {
                GrwiBuilder.syncColorFieldSwatch(key, editor);
            }
            schedulePreview();
            return;
        }
        if (raw.charAt(0) !== '#') {
            raw = '#' + raw;
        }
        if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(raw)) {
            return;
        }
        $field.removeClass('is-unset is-multicolour');
        $('[data-config-key="' + key + '"]').val(raw);
        $field.find('.grw-color-input').val(raw.length === 4
            ? '#' + raw.charAt(1) + raw.charAt(1) + raw.charAt(2) + raw.charAt(2) + raw.charAt(3) + raw.charAt(3)
            : raw.slice(0, 7));
        this.value = raw.toUpperCase();
        schedulePreview();
    });

    $(document).on('focus click', '.grw-shortcode-input', function () {
        this.select();
    });

    $(document).on('click', '.grw-visual-option', function () {
        if (this.disabled || this.getAttribute('aria-disabled') === 'true' || this.getAttribute('data-grwi-locked-field')) {
            return;
        }
        var key = $(this).data('visual-key');
        var value = $(this).data('visual-value');
        $('[data-config-key="' + key + '"]').val(value);
        $(this).closest('.grw-visual-options').find('.grw-visual-option').removeClass('is-selected');
        $(this).addClass('is-selected');
        refreshConditionalFormFields(key);
        schedulePreview();
    });

    $(document).on('click', '.grw-float-chip', function () {
        var key = $(this).data('float-key');
        var value = $(this).data('float-value');
        $('[data-config-key="' + key + '"]').val(value);
        $(this).closest('.grw-float-grid').find('.grw-float-chip').removeClass('is-selected');
        $(this).addClass('is-selected');
        if (window.GrwiBuilder && typeof GrwiBuilder.syncFloatOffsetAxisIcons === 'function') {
            GrwiBuilder.syncFloatOffsetAxisIcons(value);
        }
        refreshConditionalFormFields(key);
        schedulePreview();
    });

    $(document).on('click', '.grw-device-visibility__btn', function () {
        var key = $(this).data('visibility-key');
        if (!key) {
            return;
        }
        var $hidden = $('[data-config-key="' + key + '"]');
        var next = String($hidden.val() || '1') === '1' ? '0' : '1';
        $hidden.val(next);
        var device = key.indexOf('desktop') >= 0 ? 'Desktop' : 'Mobile';
        var active = next === '1';
        $(this).toggleClass('is-active', active);
        $(this).attr('aria-pressed', active ? 'true' : 'false');
        $(this).attr('title', device + ' — ' + (active ? 'visible' : 'hidden'));
        refreshConditionalFormFields(key);
        schedulePreview();
    });

    $(document).on('click', '[data-grwi-typo-reset]', function () {
        var sizeKey = $(this).data('size-key');
        var colorKey = $(this).data('color-key');
        var weightKey = $(this).data('weight-key');
        if (window.GrwiBuilder && typeof GrwiBuilder.resetTypographyRoleFields === 'function') {
            GrwiBuilder.resetTypographyRoleFields(sizeKey, colorKey, weightKey, editor);
        }
        if (sizeKey) {
            refreshConditionalFormFields(sizeKey);
        }
        schedulePreview();
    });

    $(document).on('click', '.grw-color-reset', function () {
        var key = $(this).data('reset-key');
        $('[data-config-key="' + key + '"]').val('');
        if (window.GrwiBuilder && typeof GrwiBuilder.syncColorFieldSwatch === 'function') {
            GrwiBuilder.syncColorFieldSwatch(key, editor);
        } else {
            var $field = $('[data-grwi-color-field="' + key + '"]');
            $field.addClass('is-unset').find('.grw-color-input').val('#ffffff');
        }
        schedulePreview();
    });

    $(document).on('change', '.grw-review-item__toggle', function () {
        updateReviewCurationHidden();
        schedulePreview();
    });

    $(document).on('dragstart', '.grw-review-item, .grw-order-item', function (e) {
        $(this).addClass('is-dragging');
        e.originalEvent.dataTransfer.setData('text/plain', $(this).index());
    });

    $(document).on('dragend', '.grw-review-item, .grw-order-item', function () {
        $(this).removeClass('is-dragging');
    });

    $(document).on('dragover', '.grw-review-item, .grw-order-item', function (e) {
        e.preventDefault();
    });

    $(document).on('drop', '.grw-review-item', function (e) {
        e.preventDefault();
        var fromIndex = parseInt(e.originalEvent.dataTransfer.getData('text/plain'), 10);
        var $items = $('#grwi-review-list .grw-review-item');
        var $from = $items.eq(fromIndex);
        var $to = $(this);
        if ($from.length && !$from.is($to)) {
            if ($from.index() < $to.index()) {
                $to.after($from);
            } else {
                $to.before($from);
            }
            $('[data-config-key="review_sort"]').val('manual');
            $('[data-grwi-field="review_sort_dir"]').hide();
            updateReviewCurationHidden();
            schedulePreview();
        }
    });

    $(document).on('drop', '.grw-order-item', function (e) {
        e.preventDefault();
        var fromIndex = parseInt(e.originalEvent.dataTransfer.getData('text/plain'), 10);
        var $list = $(this).closest('.grw-order-list');
        var $items = $list.find('.grw-order-item');
        var $from = $items.eq(fromIndex);
        var $to = $(this);
        if ($from.length && !$from.is($to)) {
            if ($from.index() < $to.index()) {
                $to.after($from);
            } else {
                $to.before($from);
            }
            updateElementOrderHidden($list);
            schedulePreview();
        }
    });

    $('#grwi-customize-save').on('click', function () {
        saveWidget({ saveMode: previewFirstEnabled() ? 'draft' : undefined });
    });
    $(document).on('click', '#grwi-customize-publish', function () {
        var req = editor.requirement || {};
        if (previewFirstEnabled() && req.can_publish === false) {
            if (window.GrwiCustomizeLayout && typeof GrwiCustomizeLayout.showPreviewFirstPublishModal === 'function') {
                GrwiCustomizeLayout.showPreviewFirstPublishModal(req);
            }
            return;
        }
        saveWidget({ saveMode: previewFirstEnabled() ? 'publish' : undefined });
    });

    // —— Leave guard (All widgets / back) when dirty ——
    (function initLeaveGuard() {
        var $modal = $('#grwi-leave-unsaved-modal');
        if (!$modal.length) {
            return;
        }
        var pendingLeaveUrl = '';
        var $saveBtn = $('#grwi-leave-save');
        var $discardBtn = $('#grwi-leave-discard');
        var $stayBtns = $modal.find('[data-grwi-leave-close]');

        function setLeaveBusy(busy) {
            $saveBtn.prop('disabled', !!busy);
            $discardBtn.prop('disabled', !!busy);
            $stayBtns.prop('disabled', !!busy);
            if (busy) {
                $saveBtn.text(i18n.saving || 'Saving…');
            } else {
                $saveBtn.text(i18n.leaveSaveAndLeave || 'Save & leave');
            }
        }

        function closeLeaveModal() {
            if (saving) {
                return;
            }
            pendingLeaveUrl = '';
            setLeaveBusy(false);
            $modal.prop('hidden', true);
            $('body').removeClass('grw-modal-open');
        }

        function openLeaveModal(url) {
            pendingLeaveUrl = String(url || cfg.dashboardUrl || '').trim();
            $('#grwi-leave-unsaved-title').text(i18n.leaveUnsavedTitle || i18n.statusUnsaved || 'Unsaved changes');
            $('#grwi-leave-unsaved-body').text(
                i18n.leaveUnsavedBody || 'You have unsaved changes. Save before leaving, or discard them.'
            );
            $discardBtn.text(i18n.leaveWithoutSaving || 'Leave without saving');
            $stayBtns.filter('button').text(i18n.leaveStay || 'Cancel');
            setLeaveBusy(false);
            $modal.prop('hidden', false);
            $('body').addClass('grw-modal-open');
            $saveBtn.trigger('focus');
        }

        $(document).on('click', '.grw-customize__back-btn, .grw-customize__back-label', function (e) {
            if (allowNavigateAway || !dirty) {
                return;
            }
            e.preventDefault();
            openLeaveModal($(this).attr('href') || cfg.dashboardUrl || '');
        });

        $modal.on('click', '[data-grwi-leave-close]', function (e) {
            e.preventDefault();
            closeLeaveModal();
        });

        $discardBtn.on('click', function (e) {
            e.preventDefault();
            if (saving) {
                return;
            }
            navigateAway(pendingLeaveUrl || cfg.dashboardUrl || '');
        });

        $saveBtn.on('click', function (e) {
            e.preventDefault();
            if (saving) {
                return;
            }
            var leaveUrl = pendingLeaveUrl || cfg.dashboardUrl || '';
            setLeaveBusy(true);
            saveWidget({
                skipUiRefresh: true,
                onSuccess: function () {
                    navigateAway(leaveUrl);
                },
                onError: function () {
                    setLeaveBusy(false);
                },
            });
        });

        $(document).on('keydown', function (e) {
            if (e.key === 'Escape' && !$modal.prop('hidden')) {
                closeLeaveModal();
            }
        });

        $(window).on('beforeunload', function (e) {
            if (allowNavigateAway || !dirty || saving) {
                return undefined;
            }
            e.preventDefault();
            e.returnValue = '';
            return '';
        });
    })();

    // —— Report bug modal (matches hosted builder "Report bug" label) ——
    (function initBugReport() {
        var $modal = $('#grwi-bug-report-modal');
        if (!$modal.length) {
            return;
        }
        var $form = $('#grwi-bug-report-form');
        var $status = $('#grwi-bug-report-status');
        var $submit = $('#grwi-bug-report-submit');
        var $context = $form.find('[data-grwi-bug-context]');

        function activeSection() {
            var $btn = $('.grw-customize__rail-btn.is-active[data-grwi-section]').first();
            return $btn.length ? String($btn.data('grwi-section') || '') : '';
        }

        function syncContext() {
            var parts = [];
            var section = activeSection();
            var layout = String($root.data('layout') || '');
            if (section) {
                parts.push('section=' + section);
            }
            if (layout) {
                parts.push('layout=' + layout);
            }
            $context.val(parts.join('; '));
        }

        function openModal() {
            syncContext();
            $status.prop('hidden', true).removeClass('is-error is-ok').text('');
            $modal.prop('hidden', false);
            $form.find('textarea[name="description"]').trigger('focus');
        }

        function closeModal() {
            $modal.prop('hidden', true);
        }

        $(document).on('click', '[data-grwi-bug-report-open]', function (e) {
            e.preventDefault();
            openModal();
        });
        $modal.on('click', '[data-grwi-bug-close]', closeModal);
        $(document).on('keydown', function (e) {
            if (e.key === 'Escape' && !$modal.prop('hidden')) {
                closeModal();
            }
        });

        $form.on('submit', function (e) {
            e.preventDefault();
            var description = String($form.find('[name="description"]').val() || '').trim();
            var email = String($form.find('[name="email"]').val() || '').trim();
            if (!description || !email) {
                return;
            }
            syncContext();
            $submit.prop('disabled', true).text(i18n.reportBugSending || 'Sending…');
            $status.prop('hidden', true);

            $.post(cfg.ajaxUrl, {
                action: 'grwi_report_bug',
                nonce: cfg.nonce,
                embed_key: cfg.embedKey || '',
                description: description,
                email: email,
                context: $context.val(),
                url: window.location.href
            })
                .done(function (res) {
                    var msg = (res && res.data && res.data.message) || i18n.reportBugSent || 'Thanks — your bug report was sent.';
                    $status.removeClass('is-error').addClass('is-ok').text(msg).prop('hidden', false);
                    $form.find('[name="description"]').val('');
                    window.setTimeout(closeModal, 1800);
                })
                .fail(function (xhr) {
                    var msg = i18n.reportBugFailed || 'Could not send the bug report.';
                    if (xhr.responseJSON && xhr.responseJSON.data && xhr.responseJSON.data.message) {
                        msg = xhr.responseJSON.data.message;
                    }
                    $status.removeClass('is-ok').addClass('is-error').text(msg).prop('hidden', false);
                })
                .always(function () {
                    $submit.prop('disabled', false).text(i18n.reportBugSend || 'Send report');
                });
        });
    })();

    $(document).on('click', '.grw-copy-btn', function () {
        var $btn = $(this);
        var text = $btn.data('copy') || $btn.siblings('input, textarea').val() || '';
        if (!text || !navigator.clipboard) {
            return;
        }
        navigator.clipboard.writeText(text).then(function () {
            var original = $btn.text();
            $btn.text(i18n.copied || 'Copied!');
            window.setTimeout(function () {
                $btn.text(original);
            }, 1500);
        });
    });

    // Toasts (overlay on topbar — not WP `.notice`, which relocates under h1).
    $(document).on('click', '[data-grwi-toast-dismiss]', function (e) {
        e.preventDefault();
        dismissToast($(this).closest('[data-grwi-toast]'));
    });
    $('[data-grwi-toast]').each(function () {
        armToastAutodismiss($(this));
    });

    // Strip foreign admin notices WP may relocate next to our h1 (cache / LiteSpeed pollution).
    (function stripForeignCustomizeNotices() {
        function scrub() {
            $('#wpbody-content > .notice, #wpbody-content > .updated, #wpbody-content > .error, #wpbody-content > .update-nag')
                .not('.grw-upgrade-banner')
                .remove();
            $root.find('.notice, .updated, .error').not('.grw-toast, .grw-upgrade-banner').each(function () {
                var $n = $(this);
                if ($n.closest('#grwi-customize-notices').length) {
                    return;
                }
                $n.remove();
            });
        }
        scrub();
        window.setTimeout(scrub, 0);
        window.setTimeout(scrub, 250);
    })();

    // Install widget modal (shortcode / embed — same content as Install tab).
    (function initInstallModal() {
        var $modal = $('#grwi-install-modal');
        if (!$modal.length) {
            return;
        }
        function openModal() {
            $modal.prop('hidden', false);
            $modal.find('.grw-shortcode-input').first().trigger('focus').trigger('select');
        }
        function closeModal() {
            $modal.prop('hidden', true);
        }
        $(document).on('click', '[data-grwi-install-open]', function (e) {
            e.preventDefault();
            if (previewFirstEnabled() && editor.requirement && editor.requirement.can_publish === false) {
                if (window.GrwiCustomizeLayout && typeof GrwiCustomizeLayout.showPreviewFirstPublishModal === 'function') {
                    GrwiCustomizeLayout.showPreviewFirstPublishModal(editor.requirement);
                }
                return;
            }
            openModal();
        });
        $(document).on('click', '[data-grwi-install-close]', function (e) {
            e.preventDefault();
            closeModal();
        });
        $(document).on('keydown', function (e) {
            if (e.key === 'Escape' && !$modal.prop('hidden')) {
                closeModal();
            }
        });
    })();

    // Layout gallery: card previews, selection, entitlement unlock modal.
    (function initLayoutPicker() {
        var $unlockModal = $('#grwi-unlock-modal');
        var unlockState = null;
        var unlockLastFocus = null;

        function closeUnlockModal() {
            if (!$unlockModal.length) {
                return;
            }
            $unlockModal.attr('hidden', true);
            $unlockModal.removeClass('grw-unlock-modal--linked_free grw-unlock-modal--site grw-unlock-modal--business');
            $('body').removeClass('grw-modal-open');
            if (unlockLastFocus && unlockLastFocus.focus) {
                try { unlockLastFocus.focus(); } catch (err) { /* ignore */ }
            }
            unlockState = null;
        }

        function openUnlockModal(config) {
            if (!$unlockModal.length) {
                return;
            }
            unlockState = config || {};
            unlockLastFocus = document.activeElement;
            var mode = config.mode || 'linked_free';
            $unlockModal
                .removeClass('grw-unlock-modal--linked_free grw-unlock-modal--site grw-unlock-modal--business')
                .addClass('grw-unlock-modal--' + (mode === 'business' ? 'business' : (mode === 'site' ? 'site' : 'linked_free')));
            $('#grwi-unlock-modal-title').text(config.title || '');
            $('#grwi-unlock-modal-body').text(config.body || '');
            var $supporting = $('#grwi-unlock-modal-supporting');
            if (config.supporting) {
                $supporting.text(config.supporting).prop('hidden', false);
            } else {
                $supporting.text('').prop('hidden', true);
            }
            $('#grwi-unlock-modal-primary').text(config.primaryLabel || 'Continue');
            $('#grwi-unlock-modal-secondary').text(config.secondaryLabel || 'Cancel');
            var $planSafe = $('#grwi-unlock-modal-plan-safe');
            if ($planSafe.length) {
                if (config.planSafeLabel && typeof config.onPlanSafe === 'function') {
                    $planSafe.text(config.planSafeLabel).prop('hidden', false);
                } else {
                    $planSafe.text('').prop('hidden', true);
                }
            }
            var $footer = $('#grwi-unlock-modal-footer');
            if (config.footer) {
                $footer.text(config.footer).prop('hidden', false);
            } else {
                $footer.text('').prop('hidden', true);
            }
            var $note = $('#grwi-unlock-modal-note');
            if ($note.length) {
                if (config.linkOnlyNote) {
                    $note.text(config.linkOnlyNote).prop('hidden', false);
                } else {
                    $note.text('').prop('hidden', true);
                }
            }
            var $linkOnly = $('#grwi-unlock-modal-link-only');
            if ($linkOnly.length) {
                if (config.linkOnlyLabel) {
                    $linkOnly.text(config.linkOnlyLabel).prop('hidden', false);
                } else {
                    $linkOnly.text('').prop('hidden', true);
                }
            }
            $unlockModal.prop('hidden', false);
            $('body').addClass('grw-modal-open');
            $('#grwi-unlock-modal-primary').trigger('focus');
        }

        function normalizeEntitlement(raw) {
            var value = String(raw || '').toLowerCase();
            if (value === 'link_account') {
                return 'linked_free';
            }
            if (value === 'linked_free' || value === 'site' || value === 'unlinked' || value === 'business') {
                return value;
            }
            return value || 'site';
        }

        function editingSubtitle(label) {
            var template = i18n.editingSubtitle || '%s · Editing';
            return template.replace('%s', label || '');
        }

        function applyLayoutSelection(layoutKey, layoutLabel) {
            layoutKey = String(layoutKey || '').trim();
            if (!layoutKey || layoutKey === currentLayoutKey()) {
                return;
            }
            layoutLabel = String(layoutLabel || layoutKey);
            var leavingAiTab = activeSection === 'ai-summary'
                && !(window.GrwiBuilder && typeof GrwiBuilder.isFeedLayoutKey === 'function'
                    ? GrwiBuilder.isFeedLayoutKey(layoutKey)
                    : String(layoutKey).indexOf('feed_') === 0);

            $root.attr('data-layout', layoutKey).data('layout', layoutKey);
            if (!editor.builder) {
                editor.builder = {};
            }
            if (editor.widget) {
                editor.widget.layout = layoutKey;
                editor.widget.layout_label = layoutLabel;
            }
            if (window.GrwiBuilder && typeof GrwiBuilder.applyLayoutChange === 'function') {
                editor = GrwiBuilder.applyLayoutChange(editor, layoutKey, layoutLabel);
            } else {
                editor.layout = layoutKey;
                editor.builder.layout = layoutKey;
                editor.builder.layout_label = layoutLabel;
            }
            editorConfig = $.extend({}, editor.config || editorConfig || {});
            if (previewPayload) {
                previewPayload.layout = layoutKey;
                // Keep preview mount on the same path as a fresh builder open: layout
                // defaults for the NEW layout, not the badge/sticker config we left.
                previewPayload.config = $.extend({}, editorConfig);
            }
            $('.grw-customize__subtitle').text(editingSubtitle(layoutLabel));
            lastPreviewConfigJson = '';
            lastChangedConfigKey = 'layout';
            dirty = true;
            updateSaveStatus();
            if (window.GrwiBuilder) {
                GrwiBuilder.renderAllPanels(editor);
                bindPanelInteractions();
                mountLayoutGalleryPreviews();
            }
            if (leavingAiTab) {
                activateSection('reviews');
            } else if (activeSection === 'layout') {
                // Keep Layout tab active; rail/panel DOM may have gained AI Summary.
                activateSection('layout');
            }
            // Force a full remount (not a patch) so family CSS/theme chrome resets.
            if ($mount.length) {
                $mount.removeAttr('data-grw-mounted').empty();
            }
            schedulePreview();
        }

        var activeConnectPollTimer = null;
        var activeConnectCloseWatcher = null;
        var connectInFlight = false;

        function openCheckoutPopup(url, layoutKey, featureSlug) {
            if (!url) {
                return;
            }
            var finalUrl = url;
            try {
                var parsed = new URL(url, window.location.origin);
                if (layoutKey) {
                    parsed.searchParams.set('layout', layoutKey);
                }
                if (featureSlug) {
                    parsed.searchParams.set('feature', featureSlug);
                } else if (layoutKey && LAYOUT_FEATURE_SLUGS[layoutKey]) {
                    parsed.searchParams.set('feature', LAYOUT_FEATURE_SLUGS[layoutKey]);
                }
                parsed.searchParams.set('widget', embedKey || '');
                parsed.searchParams.set('tab', String(activeSection || 'layout'));
                parsed.searchParams.set('section', String(activeSection || 'layout'));
                parsed.searchParams.set('return', window.location.href);
                if (cfg.siteId) {
                    parsed.searchParams.set('site_id', String(cfg.siteId));
                }
                var existingSource = parsed.searchParams.get('source');
                if (!existingSource || existingSource === 'pricing') {
                    parsed.searchParams.set('source', 'wordpress');
                }
                finalUrl = parsed.toString();
            } catch (err) {
                // keep base
            }
            var width = 520;
            var height = 780;
            var left = Math.max(0, (window.screen.width - width) / 2);
            var top = Math.max(0, (window.screen.height - height) / 2);
            var popup = window.open(
                finalUrl,
                'grwiCheckout',
                'popup=yes,width=' + width + ',height=' + height + ',left=' + left + ',top=' + top + ',noopener=yes'
            );
            if (!popup) {
                window.open(finalUrl, '_blank', 'noopener,noreferrer');
            }
        }

        // Prefer checkout/confirm URLs over marketing /pricing pages when possible.
        // Always rewrite plan= to the canonical required plan so Carousel+AI never
        // keeps a leftover Site destination.
        function applyCheckoutPlan(url, plan, extra) {
            extra = extra || {};
            plan = plan === 'business' || plan === 'agency' || plan === 'site' ? plan : 'site';
            if (!url) {
                return '';
            }
            try {
                var parsed = new URL(url, 'https://grwidget.com');
                parsed.searchParams.set('plan', plan);
                if (!parsed.searchParams.get('cycle')) {
                    parsed.searchParams.set('cycle', 'monthly');
                }
                if (extra.feature) {
                    parsed.searchParams.set('feature', extra.feature);
                }
                if (extra.layout) {
                    parsed.searchParams.set('layout', extra.layout);
                }
                if (extra.section) {
                    parsed.searchParams.set('section', extra.section);
                }
                if (extra.source && (!parsed.searchParams.get('source') || parsed.searchParams.get('source') === 'pricing')) {
                    parsed.searchParams.set('source', extra.source);
                }
                return parsed.toString();
            } catch (err) {
                return String(url);
            }
        }

        function checkoutFeatureForRequirement(requirement, layout) {
            var features = (requirement && requirement.features) || [];
            var order = { free: 0, site: 1, business: 2, agency: 3 };
            var best = null;
            features.forEach(function (feature) {
                if (!best || (order[feature.plan_key] || 0) > (order[best.plan_key] || 0)) {
                    best = feature;
                }
            });
            if (!best) {
                return '';
            }
            if (best.key === 'premium_layout') {
                return LAYOUT_FEATURE_SLUGS[layout] || 'premium_layouts';
            }
            var map = {
                ai_summary: 'ai_summary',
                json_ld: 'review_jsonld',
                review_photos: 'uploaded_review_photos',
                filters: 'review_filters',
                review_sorting: 'review_filters',
                advanced_customisation: 'advanced_customisation',
                remove_branding: 'remove_branding',
                review_limit_site: 'review_limit',
                review_limit_business: 'review_limit'
            };
            return map[best.key] || '';
        }

        function joinFeatureNames(names) {
            names = (names || []).filter(Boolean);
            if (names.length === 0) return '';
            if (names.length === 1) return names[0];
            if (names.length === 2) return names[0] + ' and ' + names[1];
            return names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];
        }

        function previewFirstFeaturePlanSentences(features, fallbackPlanName) {
            var order = ['linked_free', 'free', 'site', 'business', 'agency'];
            var grouped = {};
            var planKeyByName = {};
            var messages = [];
            var messageGroups = {};
            (features || []).forEach(function (feature) {
                if (!feature || typeof feature !== 'object') return;
                var message = String(feature.message || '').trim();
                if (message) {
                    var sameFeature = message.match(/^You changed the .+\. (.+)$/);
                    var groupKey = sameFeature ? sameFeature[1] : message;
                    if (!messageGroups[groupKey]) {
                        messageGroups[groupKey] = [];
                    }
                    if (messageGroups[groupKey].indexOf(message) < 0) {
                        messageGroups[groupKey].push(message);
                    }
                    return;
                }
                var name = String(feature.name || '').trim();
                if (!name) return;
                var planKey = String(feature.plan_key || '').toLowerCase();
                var planLabel = String(feature.plan_name || fallbackPlanName || 'Site').trim() || 'Site';
                if (!grouped[planLabel]) {
                    grouped[planLabel] = [];
                    planKeyByName[planLabel] = planKey;
                }
                if (grouped[planLabel].indexOf(name) < 0) {
                    grouped[planLabel].push(name);
                }
            });
            Object.keys(messageGroups).forEach(function (groupKey) {
                var group = messageGroups[groupKey];
                if (group.length > 1) {
                    messages.push(groupKey);
                    return;
                }
                if (messages.indexOf(group[0]) < 0) {
                    messages.push(group[0]);
                }
            });
            var sentences = [];
            var emitted = {};
            order.forEach(function (key) {
                Object.keys(grouped).forEach(function (planLabel) {
                    if (planKeyByName[planLabel] !== key) return;
                    var list = joinFeatureNames(grouped[planLabel]);
                    var verb = grouped[planLabel].length === 1 ? 'requires' : 'require';
                    if (grouped[planLabel].length === 1) {
                        var lower = String(grouped[planLabel][0] || '').toLowerCase();
                        if (/photos$|filters$|features$/.test(lower)) {
                            verb = 'require';
                        }
                    }
                    sentences.push(list + ' ' + verb + ' ' + planLabel + '.');
                    emitted[planLabel] = true;
                });
            });
            Object.keys(grouped).forEach(function (planLabel) {
                if (emitted[planLabel]) return;
                var list = joinFeatureNames(grouped[planLabel]);
                var verb = grouped[planLabel].length === 1 ? 'requires' : 'require';
                if (grouped[planLabel].length === 1) {
                    var leftover = String(grouped[planLabel][0] || '').toLowerCase();
                    if (/photos$|filters$|features$/.test(leftover)) {
                        verb = 'require';
                    }
                }
                sentences.push(list + ' ' + verb + ' ' + planLabel + '.');
            });
            return sentences.concat(messages).join(' ').trim();
        }

        function featuresRequireCopy(req, fallbackPlanName) {
            var features = (req && req.features) || [];
            if (!features.length && req && req.feature_names) {
                features = (req.feature_names || []).map(function (name) {
                    return { name: name, plan_name: fallbackPlanName };
                });
            }
            var sentences = previewFirstFeaturePlanSentences(features, fallbackPlanName);
            if (!sentences) {
                return 'These features require ' + (fallbackPlanName || 'Site') + '. Keep designing for free—your current live widget won’t change.';
            }
            return sentences + ' Keep designing for free—your current live widget won’t change.';
        }

        function resolveCheckoutUrl(preferred, trialEligible, plan) {
            plan = plan === 'business' || plan === 'agency' ? plan : 'site';
            var catalog = (editor.preview_first_catalog || cfg.previewFirstCatalog || {});
            var urls = catalog.checkout_urls || {};
            var bags = catalog.trial || {};
            var candidates = [];
            if (urls[plan]) {
                candidates.push(urls[plan]);
            }
            if (bags[plan] && bags[plan].checkout_url) {
                candidates.push(bags[plan].checkout_url);
            }
            if (preferred) {
                candidates.push(preferred);
            }
            if (trialEligible) {
                if (plan === 'agency') {
                    candidates.push(cfg.agencyTrialUrl || editor.agency_trial_url || '');
                } else if (plan === 'business') {
                    candidates.push(cfg.businessTrialUrl || cfg.trialUrl || '');
                } else {
                    candidates.push(cfg.trialUrl || '');
                }
            } else if (plan === 'agency') {
                candidates.push(cfg.agencyUpgradeCheckoutUrl || editor.agency_upgrade_checkout_url || cfg.upgradeCheckoutUrl || '');
            } else if (plan === 'business') {
                candidates.push(cfg.businessUpgradeCheckoutUrl || cfg.upgradeCheckoutUrl || cfg.upgradeUrl || '');
            } else {
                candidates.push(cfg.upgradeCheckoutUrl || cfg.upgradeUrl || cfg.trialUrl || '');
            }
            var i;
            var url;
            for (i = 0; i < candidates.length; i += 1) {
                url = String(candidates[i] || '').trim();
                if (!url) {
                    continue;
                }
                if (/\/pricing(\?|#|$)/i.test(url)) {
                    continue;
                }
                return applyCheckoutPlan(url, plan);
            }
            for (i = 0; i < candidates.length; i += 1) {
                url = String(candidates[i] || '').trim();
                if (url) {
                    return applyCheckoutPlan(url, plan);
                }
            }
            return applyCheckoutPlan(
                'https://grwidget.com/billing/checkout/confirm?plan=' + encodeURIComponent(plan) + '&cycle=monthly&source=wordpress',
                plan
            );
        }

        function finishConnect(connectToken) {
            connectInFlight = false;
            $.post(cfg.ajaxUrl, {
                action: 'grwi_connect_claim',
                nonce: cfg.adminNonce,
                connect_token: connectToken
            }).done(function (resp) {
                if (!resp || !resp.success) {
                    return;
                }
                var reloadUrl = window.location.href;
                try {
                    var next = new URL(reloadUrl);
                    var tab = String(activeSection || $root.data('grwi-active-section') || 'style').trim();
                    if (tab) {
                        next.searchParams.set('tab', tab);
                    }
                    next.searchParams.set('grwi_linked', '1');
                    reloadUrl = next.toString();
                } catch (err) { /* keep current href */ }
                window.location.href = reloadUrl;
            });
        }

        function pollConnectStatus(connectToken, popup) {
            var attempts = 0;
            var maxAttempts = 90;
            var closedGraceAttempts = 0;
            var maxClosedGrace = 3;
            var timer = setInterval(function () {
                attempts += 1;

                if (popup && popup.closed) {
                    closedGraceAttempts += 1;
                    if (closedGraceAttempts > maxClosedGrace) {
                        clearInterval(timer);
                        if (activeConnectPollTimer === timer) {
                            activeConnectPollTimer = null;
                        }
                        connectInFlight = false;
                        $(window).off('message.grwiConnectCustomize');
                        return;
                    }
                }

                if (attempts > maxAttempts) {
                    clearInterval(timer);
                    if (activeConnectPollTimer === timer) {
                        activeConnectPollTimer = null;
                    }
                    connectInFlight = false;
                    $(window).off('message.grwiConnectCustomize');
                    return;
                }

                $.post(cfg.ajaxUrl, {
                    action: 'grwi_connect_status',
                    nonce: cfg.adminNonce,
                    connect_token: connectToken
                }).done(function (resp) {
                    if (!resp || !resp.success || !resp.data) {
                        return;
                    }
                    if (resp.data.linked || resp.data.status === 'completed' || resp.data.status === 'claimed') {
                        clearInterval(timer);
                        if (activeConnectPollTimer === timer) {
                            activeConnectPollTimer = null;
                        }
                        $(window).off('message.grwiConnectCustomize');
                        finishConnect(connectToken);
                    }
                });
            }, 2000);

            return timer;
        }

        /**
         * Dashboard parity: open the /wordpress/connect/... popup (not a pricing tab).
         */
        function startConnectFromLayout() {
            if (cfg.isLinked || connectInFlight) {
                return;
            }
            if (!cfg.ajaxUrl || !cfg.adminNonce) {
                // Last-resort fallback — should not happen with localized adminNonce.
                window.open(cfg.linkUrl || cfg.dashboardUrl || '/', '_blank', 'noopener');
                return;
            }
            connectInFlight = true;
            $.post(cfg.ajaxUrl, {
                action: 'grwi_connect_start',
                nonce: cfg.adminNonce,
                opener_origin: window.location.origin
            }).done(function (resp) {
                if (!resp || !resp.success || !resp.data || !resp.data.connect_url) {
                    connectInFlight = false;
                    return;
                }

                var connectToken = resp.data.connect_token;
                var connectUrl = resp.data.connect_url;
                var width = 480;
                var height = 720;
                var left = Math.max(0, (window.screen.width - width) / 2);
                var top = Math.max(0, (window.screen.height - height) / 2);
                var popup = window.open(
                    connectUrl,
                    'grwiConnect',
                    'popup=yes,width=' + width + ',height=' + height + ',left=' + left + ',top=' + top + ',noopener=no'
                );

                if (!popup) {
                    connectInFlight = false;
                    return;
                }

                if (activeConnectPollTimer) {
                    clearInterval(activeConnectPollTimer);
                }
                if (activeConnectCloseWatcher) {
                    clearInterval(activeConnectCloseWatcher);
                }
                activeConnectPollTimer = pollConnectStatus(connectToken, popup);
                var finishing = false;
                activeConnectCloseWatcher = setInterval(function () {
                    if (!popup || !popup.closed) {
                        return;
                    }
                    clearInterval(activeConnectCloseWatcher);
                    activeConnectCloseWatcher = null;
                    if (finishing) {
                        return;
                    }
                    connectInFlight = false;
                }, 400);

                $(window).off('message.grwiConnectCustomize').on('message.grwiConnectCustomize', function (event) {
                    var data = event.originalEvent && event.originalEvent.data ? event.originalEvent.data : null;
                    if (!data || data.type !== 'grwi-connected') {
                        return;
                    }
                    if (data.connect_token && data.connect_token !== connectToken) {
                        return;
                    }
                    if (finishing) {
                        return;
                    }
                    finishing = true;
                    if (activeConnectCloseWatcher) {
                        clearInterval(activeConnectCloseWatcher);
                        activeConnectCloseWatcher = null;
                    }
                    if (activeConnectPollTimer) {
                        clearInterval(activeConnectPollTimer);
                        activeConnectPollTimer = null;
                    }
                    $(window).off('message.grwiConnectCustomize');
                    finishConnect(connectToken);
                });
            }).fail(function () {
                connectInFlight = false;
            });
        }

        function promptLockedLayout($card) {
            var layoutKey = String($card.data('layout') || '');
            var layoutLabel = String($card.data('layout-label') || layoutKey);
            var entitlement = normalizeEntitlement($card.data('entitlement'));
            if (entitlement === 'linked_free') {
                var freePrompt = (editor && editor.layout_prompts && editor.layout_prompts[layoutKey]) || {};
                openUnlockModal({
                    mode: 'linked_free',
                    title: freePrompt.title || (i18n.linkLayoutTitle || 'Unlock %s with a free account').replace('%s', layoutLabel),
                    body: freePrompt.body
                        || i18n.linkLayoutBody
                        || ('Link a free account to unlock the ' + layoutLabel + '. Free includes 22 layouts; Site unlocks 31 with up to 30 reviews, reviewer photos, filters and bi-weekly syncing.'),
                    primaryLabel: freePrompt.primary_label || i18n.linkLayoutCta || 'Link free account',
                    secondaryLabel: freePrompt.secondary_label || i18n.siteLayoutSecondary || i18n.linkLayoutSecondary || 'Continue with current layout',
                    footer: freePrompt.footer || i18n.linkLayoutFooter || 'No payment required',
                    onPrimary: function () {
                        closeUnlockModal();
                        startConnectFromLayout();
                    },
                });
                return;
            }
            var trialEligible = !!(cfg.trialEligible);
            if (editor && Object.prototype.hasOwnProperty.call(editor, 'trial_eligible')) {
                trialEligible = editor.trial_eligible === null ? null : !!editor.trial_eligible;
            } else if (!cfg.isLinked) {
                trialEligible = null;
            }
            var paidPlan = entitlement === 'business' ? 'business' : 'site';
            var layoutPrompt = (editor && editor.layout_prompts && editor.layout_prompts[layoutKey]) || {};
            var layoutBody = layoutPrompt.body
                || (paidPlan === 'business'
                    ? ('Display your reviews using the ' + layoutLabel + '. Business includes AI summaries, review photos, and the layouts that depend on them.')
                    : (i18n.siteLayoutBody || 'Display your reviews using the %s. Site also includes 31 layouts, up to 30 reviews, reviewer photos, filters, bi-weekly syncing and full design control.').replace('%s', layoutLabel));
            var supporting = layoutPrompt.supporting
                || (trialEligible === null
                    ? (i18n.trialUnknownSupporting || 'Trial eligibility will be confirmed before payment.')
                    : (trialEligible
                        ? (i18n.siteLayoutSupporting || '')
                        : (i18n.trialIneligibleSupporting || 'Charged at checkout. Cancel anytime.')));
            var primaryLabel = layoutPrompt.primary_label
                || (trialEligible === null
                    ? (cfg.isLinked ? 'Sign in to continue' : (paidPlan === 'business' ? 'View Business plan' : 'View Site plan'))
                    : (trialEligible
                        ? (paidPlan === 'business' ? 'Start 7-day Business trial' : (i18n.siteLayoutCta || 'Start 7-day Site trial'))
                        : (paidPlan === 'business' ? 'Upgrade to Business' : (i18n.customizeUpgradeCta || 'Upgrade to Site'))));
            var secondaryLabel = layoutPrompt.secondary_label
                || (cfg.isLinked ? (i18n.siteLayoutSecondary || 'Continue with current layout') : 'Compare plans');
            var featureSlug = layoutPrompt.feature || LAYOUT_FEATURE_SLUGS[layoutKey] || '';
            openUnlockModal({
                mode: paidPlan,
                title: layoutPrompt.title || (paidPlan === 'business'
                    ? ('Unlock ' + layoutLabel + ' with Business')
                    : (i18n.siteLayoutTitle || 'Unlock %s with Site').replace('%s', layoutLabel)),
                body: layoutBody,
                supporting: supporting,
                primaryLabel: primaryLabel,
                secondaryLabel: secondaryLabel,
                footer: trialEligible === true
                    ? (i18n.siteLayoutFooter || 'Cancel anytime during the trial')
                    : '',
                linkOnlyLabel: !cfg.isLinked ? (layoutPrompt.link_only_label || 'Link free account only') : '',
                linkOnlyNote: !cfg.isLinked ? (layoutPrompt.link_only_note || (paidPlan === 'business'
                    ? 'Linking a free account does not unlock this Business feature.'
                    : 'Linking a free account does not unlock this Site feature.')) : '',
                onPrimary: function () {
                    closeUnlockModal();
                    var checkout = resolveCheckoutUrl(layoutPrompt.checkout_url || '', trialEligible === true, paidPlan);
                    openCheckoutPopup(checkout || '/', layoutKey, featureSlug);
                },
                onSecondary: function () {
                    if (layoutPrompt.compare_url || layoutPrompt.secondary_url) {
                        window.open(layoutPrompt.compare_url || layoutPrompt.secondary_url, '_blank', 'noopener,noreferrer');
                    }
                    closeUnlockModal();
                },
                onLinkOnly: function () {
                    closeUnlockModal();
                    startConnectFromLayout();
                },
            });
        }

        function computePreviewFirstRequirement(config, layout) {
            var catalog = (editor.preview_first_catalog || cfg.previewFirstCatalog || {});
            var entitlements = catalog.entitlements || {};
            var liveCfg = editor.live_config || {};
            var features = [];
            function liveBool(value) {
                return value === true || value === 1 || value === '1' || value === 'true';
            }
            function planName(key) {
                return (catalog.plan_names && catalog.plan_names[key]) || (key ? key.charAt(0).toUpperCase() + key.slice(1) : '');
            }
            function layoutLabel(key) {
                return (catalog.layout_labels && catalog.layout_labels[key]) || key;
            }
            function featureLabel(key) {
                return (catalog.feature_labels && catalog.feature_labels[key]) || key;
            }
            function planRank(key) {
                var order = catalog.plan_order || ['free', 'site', 'business', 'agency'];
                var idx = order.indexOf(key);
                return idx < 0 ? 0 : idx;
            }
            var layoutPlan = (catalog.layout_plans && catalog.layout_plans[layout]) || null;
            if (layoutPlan && layoutPlan !== 'free' && (entitlements.layouts || []).indexOf(layout) < 0) {
                features.push({ key: 'premium_layout', name: layoutLabel(layout), plan_key: layoutPlan, plan_name: planName(layoutPlan) });
            }
            function baselineRow() {
                var theme = config.theme === 'dark' ? 'dark' : 'light';
                return (((catalog.appearance_baselines || {})[layout] || {})[theme]) || {};
            }
            function baselineOn(key) {
                return liveBool(baselineRow()[key]);
            }
            if (config.ai_summary_enabled && !entitlements.ai_summary && !baselineOn('ai_summary_enabled') && !liveBool(liveCfg.ai_summary_enabled)) {
                features.push({ key: 'ai_summary', name: featureLabel('ai_summary'), plan_key: 'business', plan_name: planName('business') });
            }
            if (liveBool(config.enable_json_ld) && !entitlements.json_ld && !baselineOn('enable_json_ld') && !liveBool(liveCfg.enable_json_ld)) {
                features.push({ key: 'json_ld', name: featureLabel('json_ld'), plan_key: 'business', plan_name: planName('business') });
            }
            var layoutEntitlements = catalog.wordpress_layout_entitlements || {};
            if (layoutEntitlements[layout] === 'linked_free' && (entitlements.layouts || []).indexOf(layout) < 0) {
                features.push({
                    key: 'account_link',
                    name: layoutLabel(layout),
                    plan_key: 'linked_free',
                    plan_name: planName('linked_free') || 'Free with account'
                });
            }
            function csvValue(value) {
                if (Array.isArray(value)) {
                    return value.join(',').trim();
                }
                return String(value || '').trim();
            }
            var minRating = parseInt(config.min_rating, 10) || 1;
            var liveMin = parseInt(liveCfg.min_rating, 10) || 1;
            var keywords = csvValue(config.filter_keywords);
            var liveKeywords = csvValue(liveCfg.filter_keywords);
            var excludeKeywords = csvValue(config.filter_exclude_keywords);
            var liveExclude = csvValue(liveCfg.filter_exclude_keywords);
            var reviewers = csvValue(config.filter_reviewers);
            var liveReviewers = csvValue(liveCfg.filter_reviewers);
            var baseMin = parseInt(baselineRow().min_rating, 10) || 1;
            var filtersMatchDefault = minRating === baseMin
                && keywords === csvValue(baselineRow().filter_keywords)
                && excludeKeywords === csvValue(baselineRow().filter_exclude_keywords)
                && reviewers === csvValue(baselineRow().filter_reviewers);
            var filtersInUse = minRating > 1 || keywords !== '' || excludeKeywords !== '' || reviewers !== '';
            var liveFiltersInUse = liveMin > 1 || liveKeywords !== '' || liveExclude !== '' || liveReviewers !== '';
            var filtersChanged = minRating !== liveMin || keywords !== liveKeywords || excludeKeywords !== liveExclude || reviewers !== liveReviewers;
            if (!entitlements.filters && filtersInUse && (filtersChanged || !liveFiltersInUse) && !filtersMatchDefault) {
                features.push({ key: 'filters', name: featureLabel('filters'), plan_key: 'site', plan_name: planName('site') });
            }
            function parseSortField(value, dir, order) {
                var v = String(value || '').toLowerCase();
                var d = String(dir || '').toLowerCase();
                if (v === 'newest' || v === 'oldest') return { field: 'date', dir: v };
                if (v === 'highest_rated' || v === 'highest') return { field: 'rating', dir: 'highest' };
                if (v === 'lowest_rated' || v === 'lowest') return { field: 'rating', dir: 'lowest' };
                if (v === 'photos_first' || v === 'photos_last') return { field: 'photos', dir: v };
                if (v === 'manual' || (Array.isArray(order) && order.length && (v === '' || v === 'date'))) {
                    if (v === 'manual') return { field: 'manual', dir: d || 'newest' };
                }
                if (v === 'rating') return { field: 'rating', dir: d === 'lowest' ? 'lowest' : 'highest' };
                if (v === 'photos') return { field: 'photos', dir: d === 'photos_last' ? 'photos_last' : 'photos_first' };
                if (v === 'date') return { field: 'date', dir: d === 'oldest' ? 'oldest' : 'newest' };
                return { field: 'date', dir: 'newest' };
            }
            var draftSort = parseSortField(config.review_sort, config.review_sort_dir, config.review_order);
            var liveSort = parseSortField(liveCfg.review_sort, liveCfg.review_sort_dir, liveCfg.review_order);
            var baseSort = parseSortField(baselineRow().review_sort, baselineRow().review_sort_dir, baselineRow().review_order);
            var sortMatchesDefault = draftSort.field === baseSort.field && draftSort.dir === baseSort.dir;
            var sortIsDefault = draftSort.field === 'date' && draftSort.dir === 'newest';
            var sortMatchesLive = draftSort.field === liveSort.field && draftSort.dir === liveSort.dir;
            if (!entitlements.filters && !sortIsDefault && !sortMatchesLive && !sortMatchesDefault) {
                features.push({ key: 'review_sorting', name: featureLabel('review_sorting') || 'Review sorting', plan_key: 'site', plan_name: planName('site') });
            }
            var family = (function () {
                if (window.GrwiBuilder && typeof window.GrwiBuilder.layoutFamilyFromLayout === 'function') {
                    return window.GrwiBuilder.layoutFamilyFromLayout(layout);
                }
                var raw = String(layout || '');
                if (raw.indexOf('feed_') === 0) return raw.replace(/^feed_/, '');
                return raw.split('_')[0];
            })();
            if (family === 'slider') {
                family = 'showcase';
            }
            var photoFamilies = ['list', 'carousel', 'grid', 'masonry', 'showcase'];
            var photoKeys = [];
            if (photoFamilies.indexOf(family) >= 0) {
                photoKeys.push(family + '_show_review_photos');
                photoKeys.push('show_review_photos');
            }
            function liveActiveReviewPhotoShowKeys(liveLayout) {
                var liveFamily = (function () {
                    if (window.GrwiBuilder && typeof window.GrwiBuilder.layoutFamilyFromLayout === 'function') {
                        return window.GrwiBuilder.layoutFamilyFromLayout(liveLayout);
                    }
                    var raw = String(liveLayout || '');
                    if (raw.indexOf('feed_') === 0) return raw.replace(/^feed_/, '');
                    return raw.split('_')[0];
                })();
                if (liveFamily === 'slider') {
                    liveFamily = 'showcase';
                }
                if (photoFamilies.indexOf(liveFamily) < 0) {
                    return [];
                }
                return [liveFamily + '_show_review_photos', 'show_review_photos'];
            }
            if (!entitlements.review_photos) {
                var photosOn = photoKeys.some(function (key) { return liveBool(config[key]) && !baselineOn(key); });
                var livePhotoKeys = liveActiveReviewPhotoShowKeys(editor.live_layout || '');
                var livePhotosGrandfathered = photoKeys.some(function (key) {
                    return livePhotoKeys.indexOf(key) >= 0 && liveBool(liveCfg[key]);
                });
                var flyoutOn = config.flyout_enabled === undefined || config.flyout_enabled === null || liveBool(config.flyout_enabled);
                var flyoutPhotosOn = flyoutOn && liveBool(config.flyout_show_review_photos);
                var liveFlyoutPhotosOn = liveBool(liveCfg.flyout_show_review_photos);
                var flyoutPhotosNew = photoFamilies.indexOf(family) >= 0
                    && flyoutPhotosOn
                    && !baselineOn('flyout_show_review_photos')
                    && Object.prototype.hasOwnProperty.call(liveCfg, 'flyout_show_review_photos')
                    && !liveFlyoutPhotosOn;
                if ((photosOn && !livePhotosGrandfathered) || flyoutPhotosNew || (draftSort.field === 'photos' && !sortMatchesLive)) {
                    features.push({ key: 'review_photos', name: featureLabel('review_photos'), plan_key: 'business', plan_name: planName('business') });
                }
            }
            var requestedReviews = parseInt(config.max_reviews, 10);
            var caps = catalog.max_reviews || {};
            var entitledMax = parseInt(caps.entitled, 10);
            var unlinkedSite = catalog.account_linked === false || catalog.account_linked === 0
                || cfg.isLinked === false || cfg.isLinked === 0 || cfg.isLinked === '0' || cfg.isLinked === '';
            if (unlinkedSite) {
                var unlinkedCap = parseInt(caps.unlinked, 10);
                if (!isNaN(unlinkedCap) && unlinkedCap > 0) {
                    entitledMax = unlinkedCap;
                }
            }
            var freeMax = caps.free || 10;
            var siteMax = caps.site || 30;
            if (!isNaN(requestedReviews) && entitledMax && requestedReviews > entitledMax && entitledMax < 100000) {
                if (requestedReviews > siteMax) {
                    features.push({ key: 'review_limit_business', name: featureLabel('review_limit_business'), plan_key: 'business', plan_name: planName('business') });
                } else if (requestedReviews > freeMax) {
                    features.push({ key: 'review_limit_site', name: featureLabel('review_limit_site'), plan_key: 'site', plan_name: planName('site') });
                } else {
                    features.push({
                        key: 'review_limit_account_link',
                        name: featureLabel('review_limit_account_link') || 'More reviews',
                        plan_key: 'linked_free',
                        plan_name: planName('linked_free') || 'Free with account'
                    });
                }
            }
            function normalizeAppearanceCompare(value) {
                if (value === true || value === 1 || value === '1') return '1';
                if (value === false || value === 0 || value === '0') return '0';
                if (value === undefined || value === null) return '';
                var text = String(value).trim();
                if (text === '') return '';
                if (text === 'true') return '1';
                if (text === 'false') return '0';
                var px = text.match(/^(-?\d+(?:\.\d+)?)px$/i);
                if (px) text = px[1];
                if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(text)) {
                    text = text.toLowerCase();
                    if (text.length === 4 || text.length === 5) {
                        var expanded = '#';
                        for (var i = 1; i < text.length; i++) expanded += text[i] + text[i];
                        return expanded;
                    }
                    return text;
                }
                return text;
            }

            function canonicalElementOrder(key, val) {
                var allowed = key === 'badge_element_order'
                    ? (catalog.badge_element_order_elements || [])
                    : (key === 'sticker_element_order' ? (catalog.sticker_element_order_elements || []) : null);
                if (!allowed || !allowed.length) return null;
                var order = val;
                if (typeof order === 'string' && order.trim() !== '') {
                    try { order = JSON.parse(order); } catch (e) { order = []; }
                }
                if (!Array.isArray(order)) order = [];
                var seen = [];
                order.forEach(function (item) {
                    item = String(item || '').trim();
                    if (!item || allowed.indexOf(item) < 0 || seen.indexOf(item) >= 0) return;
                    seen.push(item);
                });
                allowed.forEach(function (item) {
                    if (seen.indexOf(item) < 0) seen.push(item);
                });
                return seen.join('\n');
            }
            function appearanceValueIsBaseline(key, val, liveVal) {
                var current = normalizeAppearanceCompare(val);
                var live = normalizeAppearanceCompare(liveVal);
                if (live !== '' && current === live) {
                    return true;
                }
                if (current === '') {
                    return true;
                }
                var theme = (config.theme === 'dark') ? 'dark' : 'light';
                var baselineRow = ((catalog.appearance_baselines || {})[layout] || {})[theme] || {};
                var currentOrder = canonicalElementOrder(key, val);
                if (currentOrder !== null && currentOrder === canonicalElementOrder(key, baselineRow[key])) return true;
                if (key === 'widget_border_radius') {
                    var baseRadius = normalizeAppearanceCompare(baselineRow[key]);
                    var curRadius = normalizeAppearanceCompare(val);
                    if ((baseRadius === '' || baseRadius === '16px') && (curRadius === '' || curRadius === '16px')) return true;
                }
                var defaultVal = baselineRow[key];
                if (/(padding|margin|radius|spacing|gap|offset)/i.test(String(key || ''))) {
                    var spacingNorm = function (value) {
                        var n = normalizeAppearanceCompare(value);
                        return n === '' || n === '0';
                    };
                    if (spacingNorm(val) && spacingNorm(defaultVal)) {
                        return true;
                    }
                }
                var defaultNorm = normalizeAppearanceCompare(defaultVal);
                if (current === defaultNorm) {
                    return true;
                }
                if (defaultNorm !== '' && current.toLowerCase() === defaultNorm.toLowerCase()) {
                    return true;
                }
                return false;
            }
            var styleKeys = [];
            var basicAppearanceKeys = catalog.basic_appearance_keys || [];
            (catalog.advanced_appearance_keys || []).forEach(function (key) {
                if (key === 'custom_css') return;
                if (basicAppearanceKeys.indexOf(key) >= 0 || /^widget_margin_/.test(key)) return;
                if (/(_show_review_photos|_review_image_filter|_show_author_avatar)$/.test(key) || key === 'show_review_photos' || key === 'review_image_filter') return;
                if (key === 'enable_json_ld' || key === 'ai_summary_enabled' || key === 'hide_branding' || key === 'show_branding') return;
                var val = config[key];
                if (appearanceValueIsBaseline(key, val, liveCfg[key])) return;
                styleKeys.push(key);
            });
            if (!entitlements.advanced_customisation) {
                var stylePlan = (catalog.feature_plans && catalog.feature_plans.advanced_customisation) || 'site';
                styleKeys.forEach(function (key) {
                    features.push({
                        key: 'advanced_customisation',
                        name: (catalog.option_labels || {})[key] || featureLabel('advanced_customisation'),
                        plan_key: stylePlan,
                        plan_name: planName(stylePlan),
                        message: (catalog.option_messages || {})[key] || ''
                    });
                });
            }
            var required = null;
            var accountLinkRequired = false;
            features.forEach(function (f) {
                if (f.plan_key === 'linked_free' || f.key === 'account_link' || f.key === 'review_limit_account_link') {
                    accountLinkRequired = true;
                    return;
                }
                if (!required || planRank(f.plan_key) > planRank(required)) {
                    required = f.plan_key;
                }
            });
            var result = {
                required_plan_key: required,
                required_plan_name: required ? planName(required) : null,
                can_publish: features.length === 0,
                account_link_required: accountLinkRequired,
                features: features,
                feature_keys: features.map(function (f) { return f.key; }),
                feature_names: features.map(function (f) { return f.name; })
            };
            editor.requirement = result;
            return result;
        }

        function syncPreviewFirstBanner() {
            if (!previewFirstEnabled()) {
                return;
            }
            var req = computePreviewFirstRequirement(collectConfigFromForm(), currentLayoutKey());
            var $banner = $('#grwi-preview-first-banner');
            var $publish = $('#grwi-customize-publish');
            if ($publish.length) {
                if (req.can_publish) {
                    $publish.text(i18n.previewFirstPublish || 'Publish changes');
                } else if (req.account_link_required && !req.required_plan_key) {
                    $publish.text(i18n.previewFirstLinkPublish || 'Link free account & publish');
                } else {
                    $publish.text((i18n.previewFirstUpgradePublish || 'Upgrade to %s & publish').replace('%s', req.required_plan_name || 'Site'));
                }
            }
            if (!$banner.length) {
                return;
            }
            if (req.can_publish) {
                $banner.attr('hidden', true);
                return;
            }
            if (req.account_link_required && !req.required_plan_key) {
                var keys = req.feature_keys || [];
                var reviewLimitOnly = keys.indexOf('review_limit_account_link') >= 0 && keys.indexOf('account_link') < 0;
                var layoutName = (req.feature_names || []).filter(Boolean)[0] || currentLayoutKey();
                $('#grwi-preview-first-banner-title').text(
                    reviewLimitOnly
                        ? (i18n.previewFirstLinkTitleGeneric || 'Link a free account to publish')
                        : (i18n.previewFirstLinkTitle || 'Link a free account to publish this layout')
                );
                var reviewCap = parseInt(((editor.preview_first_catalog || cfg.previewFirstCatalog || {}).max_reviews || {}).free, 10);
                if (isNaN(reviewCap) || reviewCap <= 0) {
                    reviewCap = 10;
                }
                $('#grwi-preview-first-banner-body').text(
                    reviewLimitOnly
                        ? (i18n.previewFirstLinkBodyReviews || 'Link a free account to show up to %d reviews. Keep designing—your current live widget won’t change.').replace('%d', String(reviewCap))
                        : (i18n.previewFirstLinkBody || '%s is included free when you link a GR Widget account. Keep designing—your current live widget won’t change.').replace('%s', layoutName)
                );
                $('#grwi-preview-first-banner-trial')
                    .attr('href', cfg.linkUrl || editor.link_url || '#')
                    .text(i18n.previewFirstLinkCta || 'Link free account');
                $('#grwi-preview-first-banner-features').attr('href', cfg.upgradeUrl || 'https://grwidget.com/pricing?source=wordpress');
                $banner.removeAttr('hidden');
                return;
            }
            if (!req.required_plan_key) {
                $banner.attr('hidden', true);
                return;
            }
            var names = (req.feature_names || []).filter(Boolean);
            var planName = req.required_plan_name || 'Site';
            $('#grwi-preview-first-banner-title').text(
                req.required_plan_key === 'business'
                    ? (i18n.previewFirstBannerTitleBusiness || 'Your design requires Business')
                    : (i18n.previewFirstBannerTitle || 'Your design uses %s features').replace('%s', planName)
            );
            $('#grwi-preview-first-banner-body').text(featuresRequireCopy(req, planName));
            var trial = (editor.preview_first_catalog || cfg.previewFirstCatalog || {}).trial || {};
            var bag = trial[req.required_plan_key] || trial.site || {};
            var trialEligible = editor.trial_eligible;
            if (typeof trialEligible === 'undefined') {
                trialEligible = cfg.trialEligible;
            }
            var checkout = applyCheckoutPlan(
                resolveCheckoutUrl(bag.checkout_url || '', trialEligible === true, req.required_plan_key)
                    || cfg.trialUrl
                    || cfg.upgradeCheckoutUrl
                    || '#',
                req.required_plan_key,
                {
                    feature: checkoutFeatureForRequirement(req, currentLayoutKey()),
                    layout: currentLayoutKey(),
                    source: 'wordpress'
                }
            );
            $('#grwi-preview-first-banner-trial')
                .attr('href', checkout)
                .text(trialEligible === false
                    ? ((i18n.upgradeAndPublish || 'Upgrade to %s').replace('%s', planName))
                    : ('Start ' + planName + ' free trial'));
            $('#grwi-preview-first-banner-features').attr(
                'href',
                'https://grwidget.com/pricing?source=wordpress&plan=' + encodeURIComponent(req.required_plan_key || 'site')
            );
            $banner.removeAttr('hidden');
        }

        function brandingCheckoutUrl() {
            var catalog = (editor.preview_first_catalog || cfg.previewFirstCatalog || {});
            var trial = catalog.trial || {};
            var trialEligible = editor.trial_eligible;
            if (typeof trialEligible === 'undefined') {
                trialEligible = cfg.trialEligible;
            }
            return applyCheckoutPlan(
                resolveCheckoutUrl((trial.site && trial.site.checkout_url) || '', trialEligible === true, 'site'),
                'site',
                {
                    feature: 'remove_branding',
                    source: 'wordpress',
                    section: 'settings'
                }
            );
        }
        window.wbBrandingCheckoutUrl = brandingCheckoutUrl;

        function brandingCtaLabel() {
            var trialEligible = editor.trial_eligible;
            if (typeof trialEligible === 'undefined') {
                trialEligible = cfg.trialEligible;
            }
            if (trialEligible === false) {
                return i18n.customizeUpgradeCta || 'Upgrade to Site';
            }
            return i18n.brandingTrialCta || 'Start your 7-day Site trial';
        }
        window.__wbBrandingCtaLabel = brandingCtaLabel();

        function hideBrandingToast() {
            var $toast = $('#grwi-preview-first-toast');
            if (!$toast.length) {
                return;
            }
            $toast.attr('hidden', true);
            $('#grwi-preview-first-toast-actions').attr('hidden', true);
            $('#grwi-preview-first-toast-cta').attr('hidden', true).removeAttr('href');
            $('#grwi-preview-first-toast-undo').attr('hidden', true);
        }

        function showBrandingHiddenToast() {
            var $toast = $('#grwi-preview-first-toast');
            if (!$toast.length) {
                return;
            }
            var catalog = (editor.preview_first_catalog || cfg.previewFirstCatalog || {});
            var entitled = !!(catalog.entitlements && catalog.entitlements.remove_branding);
            $('#grwi-preview-first-toast-title').text(i18n.brandingHiddenTitle || 'Branding hidden in this preview');
            $('#grwi-preview-first-toast-body').text(
                entitled
                    ? (i18n.brandingHiddenEntitledBody || 'The GR Widget link is hidden in this preview. You can restore it anytime.')
                    : (i18n.brandingHiddenBody || 'Upgrade to Site to publish your widget without the GR Widget link.')
            );
            var $actions = $('#grwi-preview-first-toast-actions');
            var $cta = $('#grwi-preview-first-toast-cta');
            var $undo = $('#grwi-preview-first-toast-undo');
            if ($actions.length) {
                $actions.removeAttr('hidden');
            }
            if ($cta.length) {
                if (entitled) {
                    $cta.attr('hidden', true).removeAttr('href');
                } else {
                    $cta.removeAttr('hidden')
                        .attr('href', brandingCheckoutUrl())
                        .text(brandingCtaLabel());
                }
            }
            if ($undo.length) {
                $undo.removeAttr('hidden');
            }
            $toast.removeAttr('hidden');
            window.setTimeout(hideBrandingToast, 12000);
        }

        window.wbPreviewFirstHideBranding = function () {
            var $el = $('[data-config-key="hide_branding"]').filter('input[type="checkbox"]');
            if (!$el.length) {
                return;
            }
            if ($el.is(':checked')) {
                return;
            }
            window.__wbBrandingSyncing = true;
            $el.prop('checked', true).trigger('change');
            window.__wbBrandingSyncing = false;
            showBrandingHiddenToast();
        };

        $(document).on('change', '[data-config-key="hide_branding"]', function () {
            if (window.__wbBrandingSyncing) {
                return;
            }
            if (this.checked) {
                showBrandingHiddenToast();
            } else {
                hideBrandingToast();
            }
            if (typeof syncPreviewFirstBanner === 'function') {
                syncPreviewFirstBanner();
            }
        });
        $(document).on('click', '#grwi-preview-first-toast-undo', function (e) {
            e.preventDefault();
            var $el = $('[data-config-key="hide_branding"]').filter('input[type="checkbox"]');
            window.__wbBrandingSyncing = true;
            $el.prop('checked', false).trigger('change');
            window.__wbBrandingSyncing = false;
            hideBrandingToast();
        });

        function showPreviewFirstPublishModal(requirement) {
            requirement = requirement || editor.requirement || {};
            var layoutKey = currentLayoutKey();
            var layoutLabel = (editor.widget && editor.widget.layout_label)
                || (editor.builder && editor.builder.layout_label)
                || layoutKey;
            if (requirement.account_link_required && !requirement.required_plan_key) {
                openUnlockModal({
                    mode: 'linked_free',
                    title: i18n.previewFirstLinkTitle || 'Link a free account to publish this layout',
                    body: (i18n.previewFirstLinkBody || '%s is included free when you link a GR Widget account. Keep designing—your current live widget won’t change.').replace('%s', layoutLabel),
                    supporting: i18n.previewFirstLinkReassurance || 'Free to link · No card required · Returns you to WordPress',
                    primaryLabel: i18n.previewFirstLinkPublish || 'Link free account & publish',
                    secondaryLabel: i18n.previewFirstContinueEditing || 'Continue editing',
                    footer: i18n.linkLayoutFooter || 'No payment required',
                    linkOnlyNote: '',
                    linkOnlyLabel: i18n.previewFirstLinkUnlocks || 'See what linking unlocks',
                    onPrimary: function () {
                        closeUnlockModal();
                        saveWidget({
                            saveMode: 'draft',
                            onSuccess: function () {
                                startConnectFromLayout();
                            },
                            onError: function () {
                                startConnectFromLayout();
                            }
                        });
                    },
                    onLinkOnly: function () {
                        window.open(cfg.upgradeUrl || 'https://grwidget.com/pricing?source=wordpress', '_blank', 'noopener');
                    }
                });
                return;
            }
            var planKey = requirement.required_plan_key || 'site';
            var catalog = (editor.preview_first_catalog || cfg.previewFirstCatalog || {});
            var trial = catalog.trial || {};
            var bags = cfg.trialCopy || {};
            var bag = bags[planKey] || trial[planKey] || bags.site || trial.site || {};
            var trialEligible = editor.trial_eligible;
            if (typeof trialEligible === 'undefined') {
                trialEligible = cfg.trialEligible;
            }
            var names = requirement.feature_names || [];
            var list = names.length ? names.join(', ') : layoutLabel;
            var planName = requirement.required_plan_name
                || (catalog.plan_names && catalog.plan_names[planKey])
                || 'Site';
            var price = bag.price_label || '';
            var cycle = bag.cycle_label || '/month';
            var days = bag.days || trial.days || 7;
            var featureCopy = featuresRequireCopy(requirement, planName);
            var featureSentences = featureCopy.replace(' Keep designing for free—your current live widget won’t change.', '')
                || ((list || layoutLabel) + ' require ' + planName + '.');
            var body = trialEligible === false
                ? (featureSentences + ' Upgrade to publish this version' + (price ? ('—' + price + cycle) : '') + '.')
                : (featureSentences + ' Start a ' + days + '-day free trial to publish this version—no charge today, then ' + (price ? (price + cycle) : 'the listed plan price') + '.');
            var accountName = catalog.account_plan_name || planName;
            var offer = (requirement.features || []).length && !(requirement.features || []).some(function (feature) {
                return feature && (feature.key === 'premium_layout' || feature.key === 'account_link' || feature.key === 'review_limit_account_link');
            });
            var removed = (requirement.feature_names || []).filter(Boolean).join(', ');
            openUnlockModal({
                mode: 'site',
                title: (i18n.previewFirstPublishTitle || 'Your %s design is ready').replace('%s', layoutLabel),
                body: body,
                supporting: trialEligible === false ? (bag.ineligible_supporting || '') : (bag.eligible_supporting || ''),
                primaryLabel: trialEligible === false
                    ? ((i18n.upgradeAndPublish || 'Upgrade to %s & publish').replace('%s', planName))
                    : (i18n.previewFirstStartTrial || 'Start my free trial'),
                secondaryLabel: i18n.previewFirstContinueEditing || 'Continue editing',
                planSafeLabel: offer ? ('See it on my ' + accountName + ' plan') : '',
                onPlanSafe: function () {
                    openUnlockModal({
                        mode: 'site',
                        title: (i18n.previewFirstPublishTitle || 'Your %s design is ready').replace('%s', layoutLabel),
                        body: 'On the ' + accountName + ' plan this leaves out ' + removed + '.',
                        supporting: trialEligible === false ? (bag.ineligible_supporting || '') : (bag.eligible_supporting || ''),
                        primaryLabel: trialEligible === false
                            ? ((i18n.upgradeAndPublish || 'Upgrade to %s & publish').replace('%s', planName))
                            : (i18n.previewFirstStartTrial || 'Start my free trial'),
                        secondaryLabel: 'Put my changes back',
                        planSafeLabel: 'Publish like this',
                        onSecondary: function () {
                            showPreviewFirstPublishModal(requirement);
                        },
                        onPlanSafe: function () {
                            closeUnlockModal();
                            saveWidget({ saveMode: 'publish', publishPlanSafe: true });
                        },
                        onPrimary: function () {
                            closeUnlockModal();
                            var url = applyCheckoutPlan(
                                resolveCheckoutUrl(bag.checkout_url || '', trialEligible === true, planKey),
                                planKey,
                                {
                                    feature: checkoutFeatureForRequirement(requirement, layoutKey),
                                    layout: layoutKey,
                                    source: 'wordpress'
                                }
                            );
                            openCheckoutPopup(url || cfg.trialUrl || '/', layoutKey, '');
                        }
                    });
                },
                onPrimary: function () {
                    closeUnlockModal();
                    var url = applyCheckoutPlan(
                        resolveCheckoutUrl(bag.checkout_url || '', trialEligible === true, planKey),
                        planKey,
                        {
                            feature: checkoutFeatureForRequirement(requirement, layoutKey),
                            layout: layoutKey,
                            source: 'wordpress'
                        }
                    );
                    openCheckoutPopup(url || cfg.trialUrl || '/', layoutKey, '');
                }
            });
        }

        var paidLayoutToastTimer = null;

        function hidePaidLayoutToast() {
            if (paidLayoutToastTimer) {
                window.clearTimeout(paidLayoutToastTimer);
                paidLayoutToastTimer = null;
            }
            $('#grwi-preview-first-toast').attr('hidden', true);
        }

        function layoutNeedsPaidPlan($card) {
            var entitlement = String($card.attr('data-entitlement') || '');
            return entitlement === 'site' || entitlement === 'business' || entitlement === 'agency';
        }

        function onLayoutCardActivate(e) {
            var $card = $(e.currentTarget);
            if (!$card.length) {
                return;
            }
            e.preventDefault();
            if ($card.hasClass('grw-layout-card--locked')) {
                if (previewFirstEnabled()) {
                    applyLayoutSelection($card.data('layout'), $card.data('layout-label'));
                    if (!layoutNeedsPaidPlan($card)) {
                        hidePaidLayoutToast();
                        return;
                    }
                    if (!window.__grwiPaidLayoutToastShown) {
                        window.__grwiPaidLayoutToastShown = true;
                        var req = computePreviewFirstRequirement(collectConfigFromForm(), $card.data('layout'));
                        var planLabel = req.required_plan_name
                            || $card.data('upgrade-plan')
                            || 'Site';
                        var $toast = $('#grwi-preview-first-toast');
                        if ($toast.length) {
                            if (paidLayoutToastTimer) {
                                window.clearTimeout(paidLayoutToastTimer);
                            }
                            $('#grwi-preview-first-toast-title').text(($card.data('layout-label') || '') + ' selected');
                            $('#grwi-preview-first-toast-body').text(
                                (i18n.previewFirstToastBody || 'Preview and customise it freely. You’ll need %s to publish this design.').replace('%s', planLabel)
                            );
                            $toast.removeAttr('hidden');
                            paidLayoutToastTimer = window.setTimeout(function () {
                                $toast.attr('hidden', true);
                                paidLayoutToastTimer = null;
                            }, 8000);
                        }
                    }
                    return;
                }
                promptLockedLayout($card);
                return;
            }
            hidePaidLayoutToast();
            applyLayoutSelection($card.data('layout'), $card.data('layout-label'));
        }

        $(document).on('click', '[data-grwi-layout-card]', onLayoutCardActivate);
        $(document).on('keydown', '[data-grwi-layout-card]', function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') {
                return;
            }
            onLayoutCardActivate(e);
        });

        $(document).on('click', '[data-grw-unlock-close]', function (e) {
            e.preventDefault();
            closeUnlockModal();
        });
        $(document).on('click', '#grwi-unlock-modal-plan-safe', function (e) {
            e.preventDefault();
            if (unlockState && typeof unlockState.onPlanSafe === 'function') {
                unlockState.onPlanSafe();
            }
        });
        $(document).on('click', '#grwi-unlock-modal-secondary', function (e) {
            e.preventDefault();
            if (unlockState && typeof unlockState.onSecondary === 'function') {
                unlockState.onSecondary();
            } else {
                closeUnlockModal();
            }
        });
        $(document).on('click', '#grwi-unlock-modal-link-only', function (e) {
            e.preventDefault();
            if (unlockState && typeof unlockState.onLinkOnly === 'function') {
                unlockState.onLinkOnly();
            } else {
                closeUnlockModal();
            }
        });
        $(document).on('click', '#grwi-unlock-modal-primary', function (e) {
            e.preventDefault();
            if (unlockState && typeof unlockState.onPrimary === 'function') {
                unlockState.onPrimary();
            } else {
                closeUnlockModal();
            }
        });
        $(document).on('keydown', function (e) {
            if (e.key === 'Escape' && $unlockModal.length && !$unlockModal.prop('hidden')) {
                closeUnlockModal();
            }
        });

        function layoutGalleryPreviewMeta() {
            var meta = (editor.builder && editor.builder.preview) || {};
            // Capabilities demo is the same payload the dashboard create picker uses.
            if (!meta.layout_picker_demo && cfg.layoutPreviewDemo) {
                meta = $.extend({}, meta, {
                    layout_picker_demo: cfg.layoutPreviewDemo,
                    demo_place: (cfg.layoutPreviewDemo && cfg.layoutPreviewDemo.place) || meta.demo_place,
                });
            }
            return meta;
        }

        function layoutGalleryDemo() {
            var meta = layoutGalleryPreviewMeta();
            return meta.layout_picker_demo || cfg.layoutPreviewDemo || {};
        }

        function layoutGalleryDemoPlace() {
            var demo = layoutGalleryDemo();
            var place = demo.place || (layoutGalleryPreviewMeta().demo_place) || {};
            // GrwPreview requires business_name (not only name) — match dashboard create picker.
            return {
                place_id: place.place_id || '',
                business_name: place.business_name || place.name || 'Demo Business',
                formatted_address: place.formatted_address || place.location_label || '',
                location_label: place.location_label || place.formatted_address || '',
                rating: place.rating != null ? place.rating : 4.9,
                review_count: place.review_count != null ? place.review_count : 128,
            };
        }

        function layoutGalleryDemoReviews() {
            var reviews = layoutGalleryDemo().reviews;
            return Array.isArray(reviews) ? reviews.slice(0, 6) : [];
        }

        function layoutGalleryPresentationFor(layout) {
            var key = String(layout || '');
            if (key === 'feed_masonry') {
                return { preview_variant: 'examples-masonry', masonry_show_all: true };
            }
            if (key === 'feed_slider') {
                return { showcase_rows: 1 };
            }
            if (key === 'feed_grid') {
                return {
                    preview_variant: 'examples',
                    showcase_rows: 2,
                    demo_photos: 'selective',
                    max_reviews: 8,
                };
            }
            if (key === 'feed_list') {
                return { max_reviews: 3 };
            }
            return null;
        }

        function layoutGalleryThumbnailReviews(layout, feedReviewCount) {
            switch (String(layout || '')) {
                case 'feed_list': return Math.min(feedReviewCount, 2);
                case 'feed_grid': return 8;
                case 'feed_slider': return 8;
                case 'feed_carousel': return Math.min(feedReviewCount, 4);
                default: return feedReviewCount;
            }
        }

        function layoutGalleryFeedFitScale(layout) {
            // Same pads as dashboard create-flow thumbs (admin.js layoutCardFeedFitScale).
            switch (String(layout || '')) {
                case 'feed_grid': return 0.88;
                case 'feed_list': return 0.76;
                case 'feed_slider': return 0.74;
                case 'feed_carousel': return 0.88;
                case 'feed_masonry': return 0.88;
                default: return 0.88;
            }
        }

        function layoutGalleryRecipeFor(layout) {
            var key = String(layout || '');
            var demo = layoutGalleryDemo();
            var configs = demo.configs || {};
            var reviews = layoutGalleryDemoReviews();
            var feedReviewCount = reviews.length > 0 ? reviews.length : 6;
            var cfgCount = parseInt((configs[key] || {}).feed_initial_review_count, 10);
            if (isFinite(cfgCount) && cfgCount > 0) {
                feedReviewCount = cfgCount;
            }

            if (key.indexOf('feed_') === 0) {
                feedReviewCount = layoutGalleryThumbnailReviews(key, feedReviewCount);
                switch (key) {
                    case 'feed_list': return { mode: 'feed', width: 540, reviews: feedReviewCount };
                    case 'feed_grid': return { mode: 'feed', width: 960, reviews: feedReviewCount };
                    case 'feed_masonry': return { mode: 'feed', width: 1000, reviews: feedReviewCount };
                    case 'feed_carousel': return { mode: 'feed', width: 560, reviews: feedReviewCount };
                    case 'feed_slider': return { mode: 'feed', width: 1400, reviews: feedReviewCount };
                    case 'feed_review_ribbon': return { mode: 'feed', width: 880, reviews: feedReviewCount };
                    case 'feed_mini_slider': return { mode: 'feed', width: 740, reviews: feedReviewCount };
                    case 'feed_reputation_snapshot': return { mode: 'feed', width: 590, reviews: 4 };
                    case 'feed_review_mosaic': return { mode: 'feed', width: 960, reviews: 6 };
                    case 'feed_photo_spotlight': return { mode: 'feed', width: 940, reviews: 3 };
                    case 'feed_classic_carousel': return { mode: 'feed', width: 960, reviews: feedReviewCount };
                    case 'feed_classic_slider': return { mode: 'feed', width: 740, reviews: 6 };
                    case 'feed_classic_list': return { mode: 'feed', width: 740, reviews: 3 };
                    case 'feed_classic_grid': return { mode: 'feed', width: 1090, reviews: 6 };
                    case 'feed_classic_masonry': return { mode: 'feed', width: 1090, reviews: 6 };
                    default: return { mode: 'feed', width: 540, reviews: feedReviewCount };
                }
            }

            switch (key) {
                case 'sticker_light': return { mode: 'container', width: 200 };
                case 'sticker_bold': return { mode: 'container', width: 200 };
                case 'sticker_tag': return { mode: 'container', width: 220 };
                case 'sticker_pill': return { mode: 'container', width: 280 };
                case 'sticker_ribbon': return { mode: 'container', width: 380 };
                case 'badge_card': return { mode: 'intrinsic', width: 300 };
                case 'badge_compact': return { mode: 'intrinsic', width: 340 };
                case 'badge_inline': return { mode: 'intrinsic', width: 460 };
                case 'badge_avatar': return { mode: 'intrinsic', width: 380, reviews: 8 };
                case 'badge_inline_reviews': return { mode: 'intrinsic', width: 420 };
                case 'badge_essential': return { mode: 'intrinsic', width: 320 };
                case 'badge_text_rating': return { mode: 'intrinsic', width: 360 };
                case 'badge_stacked': return { mode: 'intrinsic', width: 280 };
                case 'badge_micro_strip': return { mode: 'intrinsic', width: 520 };
                case 'badge_review_request': return { mode: 'container', width: 480, reviews: 4 };
                default: return { mode: 'intrinsic' };
            }
        }

        function layoutGalleryVisualRoot(target) {
            return target.querySelector('.grw-sticker-shape')
                || target.querySelector('.grw-pill-chip')
                || target.querySelector('.lf-request')
                || target.querySelector('.og-ribbon')
                || target.querySelector('.grw-mini-slider')
                || target.querySelector('.grw-rs-widget')
                || target.querySelector('.grw-mosaic')
                || target.querySelector('.og-story')
                || target.querySelector('.grw-preview-classic-carousel')
                || target.querySelector('.lf-feed')
                || target.querySelector('.grw-avatar-proof')
                || target.querySelector('.grw-badge')
                || target.querySelector('.grw-mock')
                || target.firstElementChild
                || target;
        }

        function layoutGalleryMeasureBox(mock) {
            var boxW = mock.clientWidth;
            var boxH = mock.clientHeight;
            if (boxW && boxH) {
                return { boxW: boxW, boxH: boxH };
            }
            var preview = mock.closest('.grw-layout-card__preview');
            if (preview) {
                boxW = boxW || preview.clientWidth;
                boxH = boxH || preview.clientHeight;
            }
            return { boxW: boxW, boxH: boxH };
        }

        /**
         * Plugin Layout-tab only. Mirrors dashboard admin.js layoutCardFit — pixel
         * translate + origin 0,0. Do not call web builder fit helpers (different CSS).
         */
        function fitLayoutCard(mockEl) {
            if (!mockEl) {
                return;
            }
            var stage = mockEl.querySelector('[data-grw-layout-stage]');
            var target = mockEl.querySelector('[data-grw-layout-target]');
            if (!stage || !target) {
                return;
            }
            var recipe = mockEl.__grwLayoutRecipe || { mode: 'intrinsic' };

            stage.style.transform = 'none';
            var measured = layoutGalleryMeasureBox(mockEl);
            var boxW = measured.boxW;
            var boxH = measured.boxH;
            if (!boxW || !boxH) {
                return;
            }

            if (recipe.mode === 'feed') {
                var natW = stage.offsetWidth;
                var natH = stage.scrollHeight || stage.offsetHeight;
                if (!natW || !natH) {
                    return;
                }
                var layoutKey = mockEl.getAttribute('data-layout') || '';
                var fitPad = layoutGalleryFeedFitScale(layoutKey);
                var scale = Math.min((boxW * fitPad) / natW, (boxH * 0.94) / natH);
                if (!isFinite(scale) || scale <= 0) {
                    scale = 0.1;
                }
                scale = Math.min(scale, 1);
                var scaledW = natW * scale;
                var scaledH = natH * scale;
                var tx = (boxW - scaledW) / 2;
                var ty = natH * scale <= boxH ? (boxH - scaledH) / 2 : 0;
                stage.style.left = '0px';
                stage.style.top = '0px';
                stage.style.transformOrigin = '0 0';
                stage.style.transform = 'translate(' + tx + 'px, ' + ty + 'px) scale(' + scale + ')';
                return;
            }

            var widget = layoutGalleryVisualRoot(target);
            var stageRect = stage.getBoundingClientRect();
            var wRect = widget.getBoundingClientRect();
            var natW2 = wRect.width;
            var natH2 = wRect.height;
            if (!natW2 || !natH2) {
                return;
            }
            var s = Math.min((boxW * 0.94) / natW2, (boxH * 0.9) / natH2);
            if (!isFinite(s) || s <= 0) {
                s = 0.1;
            }
            s = Math.min(s, 1);
            var wx = wRect.left - stageRect.left;
            var wy = wRect.top - stageRect.top;
            stage.style.left = '0px';
            stage.style.top = '0px';
            stage.style.transformOrigin = '0 0';
            var tx2 = (boxW / 2) - s * (wx + natW2 / 2);
            var ty2 = (boxH / 2) - s * (wy + natH2 / 2);
            stage.style.transform = 'translate(' + tx2 + 'px, ' + ty2 + 'px) scale(' + s + ')';
        }

        function mountOneLayoutCard(mockEl) {
            if (!mockEl || mockEl.getAttribute('data-grw-preview-mounted') === '1') {
                return;
            }
            var stage = mockEl.querySelector('[data-grw-layout-stage]');
            var target = mockEl.querySelector('[data-grw-layout-target]');
            var layout = mockEl.getAttribute('data-layout') || 'badge_card';
            var theme = mockEl.getAttribute('data-preview-theme') || 'light';
            if (!stage || !target || !window.GrwPreview || !window.GrwiPreviewOpts) {
                return;
            }

            var recipe = layoutGalleryRecipeFor(layout);
            mockEl.__grwLayoutRecipe = recipe;
            // GrwPreview.mount replaces className — keep target class so admin.css display:block survives.
            target.setAttribute('data-preview-wrapper-class', 'grw-layout-card__target');

            if (recipe.mode === 'feed' || recipe.mode === 'container') {
                stage.style.width = recipe.width + 'px';
            } else {
                stage.style.width = recipe.width ? (recipe.width + 'px') : 'max-content';
                stage.style.minWidth = recipe.width ? (recipe.width + 'px') : '';
            }

            var demoReviews = layoutGalleryDemo().reviews;
            var reviews = Array.isArray(demoReviews) && demoReviews.length ? demoReviews : layoutGalleryDemoReviews();
            var reviewCount = recipe.reviews || 0;
            var mountReviews = reviewCount > 0 ? reviews.slice(0, reviewCount) : reviews.slice(0, 1);
            var filledClass = recipe.mode === 'feed'
                ? 'w-full min-w-0 text-left'
                : (layout === 'badge_review_request'
                    ? 'w-full min-w-0'
                    : (recipe.mode === 'container'
                        ? 'w-full min-w-0 flex items-center justify-center'
                        : 'w-max max-w-full inline-block'));

            var previewMeta = layoutGalleryPreviewMeta();
            var opts = GrwiPreviewOpts.buildLayoutPickerPreviewOpts({
                layout: layout,
                theme: theme,
                previewMeta: previewMeta,
                previewDemo: previewMeta.layout_picker_demo || cfg.layoutPreviewDemo,
                reviews: mountReviews,
                maxReviews: reviewCount > 0 ? reviewCount : Math.min(mountReviews.length || 3, 6),
                filledClass: filledClass,
                presentation: layoutGalleryPresentationFor(layout),
            });
            if (layout === 'feed_grid' || layout === 'feed_masonry' || layout === 'feed_slider') {
                opts.feed_columns = 4;
            }

            try {
                GrwPreview.mount(target, layoutGalleryDemoPlace(), layout, opts);
                mockEl.setAttribute('data-grw-preview-mounted', '1');
                target.querySelectorAll('a, button, [href], [role="button"], [tabindex]').forEach(function (el) {
                    el.setAttribute('tabindex', '-1');
                });
                fitLayoutCard(mockEl);
                requestAnimationFrame(function () { fitLayoutCard(mockEl); });
                // Second frame: fonts/images can change intrinsic size after first paint.
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () { fitLayoutCard(mockEl); });
                });
                target.querySelectorAll('img').forEach(function (img) {
                    if (img.complete) {
                        return;
                    }
                    img.addEventListener('load', function () { fitLayoutCard(mockEl); }, { once: true });
                    img.addEventListener('error', function () { fitLayoutCard(mockEl); }, { once: true });
                });
            } catch (err) {
                /* ignore mount failures for gallery thumbs */
            }
        }

        function mountLayoutGalleryPreviews() {
            bindLayoutGalleryRefit();
            var $mocks = $('[data-grwi-layout-picker] .grw-layout-card__mock[data-layout]').filter(function () {
                return !this.closest('details:not([open])') && this.getAttribute('data-grw-preview-mounted') !== '1';
            });
            if (!$mocks.length) {
                return;
            }
            function renderWhenReady(mockEl) {
                grwiWhenPreviewReady(function () {
                    mountOneLayoutCard(mockEl);
                });
            }
            $mocks.each(function (index) {
                if (index < 4) {
                    renderWhenReady(this);
                } else {
                    var el = this;
                    window.setTimeout(function () { renderWhenReady(el); }, (index - 3) * 40);
                }
            });
            bindLayoutGalleryRefit();
        }

        function refitMountedLayoutGalleryPreviews() {
            document.querySelectorAll(
                '[data-grwi-layout-picker] .grw-layout-card__mock[data-grw-preview-mounted="1"]'
            ).forEach(function (mock) {
                fitLayoutCard(mock);
            });
        }

        function bindLayoutGalleryRefit() {
            if (window.__grwiCustomizeLayoutFitBound) {
                if (window.__grwiCustomizeLayoutRo) {
                    document.querySelectorAll(
                        '[data-grwi-layout-picker] .grw-layout-card__mock[data-layout]'
                    ).forEach(function (mock) {
                        try { window.__grwiCustomizeLayoutRo.observe(mock); } catch (err) { /* ignore */ }
                    });
                }
                return;
            }
            window.__grwiCustomizeLayoutFitBound = true;
            var resizeTimer = null;
            function scheduleRefit() {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(refitMountedLayoutGalleryPreviews, 120);
            }
            document.addEventListener('toggle', function (event) {
                if (event.target && event.target.open && event.target.closest('[data-grwi-layout-picker]')) {
                    mountLayoutGalleryPreviews();
                    scheduleRefit();
                }
            }, true);
            window.addEventListener('load', refitMountedLayoutGalleryPreviews);
            window.addEventListener('resize', scheduleRefit, { passive: true });
            if (typeof window.ResizeObserver === 'function') {
                var ro = new window.ResizeObserver(scheduleRefit);
                document.querySelectorAll(
                    '[data-grwi-layout-picker] .grw-layout-card__mock[data-layout]'
                ).forEach(function (mock) {
                    ro.observe(mock);
                });
                window.__grwiCustomizeLayoutRo = ro;
            }
        }

        function promptFeatureTrial(options) {
            options = options || {};
            var featureKey = options.featureKey || 'builder_customize';
            var plan = options.plan === 'business' ? 'business' : 'site';
            var trialEligible = !!options.trialEligible;
            var isLinked = !!cfg.isLinked;
            var planLabel = plan === 'business'
                ? (i18n.businessPlanName || 'Business')
                : (i18n.sitePlanName || 'Site');
            var featureLabel = options.featureLabel
                || (featureKey === 'ai_summary' ? 'AI Summary'
                    : (featureKey === 'filters' ? 'review filters and sorting' : 'full customisation'));
            var checkoutUrl = options.checkoutUrl || '';
            var title = options.title
                || ('Unlock ' + featureLabel + ' with ' + planLabel);

            var isSchema = featureKey === 'json_ld';
            if (isSchema) {
                title = (window.GrwiSeoContent || {}).upgradeTitle || 'Turn your reviews into stars in Google search';
                options.body = (window.GrwiSeoContent || {}).upgradeBody || 'Give Google the structured review data it needs to show your rating, stars and review count on eligible pages. Make your business stand out in search, build trust before the click, and attract more customers.';
            }

            if (!isLinked) {
                var unlinkedPrompt = {};
                if (editor && editor.feature_prompts) {
                    var unlinkedMap = {
                        ai_summary: 'ai_summary',
                        json_ld: 'review_jsonld',
                        review_photos: 'uploaded_review_photos',
                        filters: 'review_filters',
                        advanced_customisation: 'advanced_customisation',
                        review_limit: 'review_limit',
                    };
                    unlinkedPrompt = editor.feature_prompts[unlinkedMap[featureKey] || featureKey] || {};
                }
                var unlinkedPlanLabel = plan === 'business'
                    ? (i18n.businessPlanName || 'Business')
                    : (i18n.sitePlanName || 'Site');
                openUnlockModal({
                    mode: 'site',
                    title: isSchema ? title : (unlinkedPrompt.title || options.title || ('Unlock ' + featureLabel + ' with ' + unlinkedPlanLabel)),
                    body: isSchema ? options.body : (unlinkedPrompt.body || options.body || ('This is a ' + unlinkedPlanLabel + ' feature. Linking a free account does not unlock it.')),
                    supporting: unlinkedPrompt.supporting
                        || options.supporting
                        || (i18n.trialUnknownSupporting || 'Trial eligibility will be confirmed before payment.'),
                    primaryLabel: isSchema ? (options.upgradeCta || 'Get Business') : (unlinkedPrompt.primary_label || options.upgradeCta || (plan === 'business' ? 'Get Business' : 'View Site plan')),
                    secondaryLabel: unlinkedPrompt.secondary_label || 'Compare plans',
                    linkOnlyLabel: unlinkedPrompt.link_only_label || 'Link free account only',
                    linkOnlyNote: unlinkedPrompt.link_only_note || ('Linking a free account does not unlock this ' + unlinkedPlanLabel + ' feature.'),
                    onPrimary: function () {
                        closeUnlockModal();
                        var url = resolveCheckoutUrl(unlinkedPrompt.checkout_url || options.checkoutUrl || '', false, plan);
                        openCheckoutPopup(url || '/', options.layoutKey || '', options.featureSlug || unlinkedPrompt.feature || '');
                    },
                    onSecondary: function () {
                        if (isSchema || unlinkedPrompt.compare_url || unlinkedPrompt.secondary_url) {
                            window.open(unlinkedPrompt.compare_url || unlinkedPrompt.secondary_url || 'https://grwidget.com/pricing?source=wordpress', '_blank', 'noopener,noreferrer');
                        }
                        closeUnlockModal();
                    },
                    onLinkOnly: function () {
                        closeUnlockModal();
                        startConnectFromLayout();
                    },
                });
                return;
            }

            openUnlockModal({
                mode: 'site',
                title: title,
                body: options.body
                    || (trialEligible
                        ? ((i18n.featureTrialBody || 'Start a 7-day free trial of %s to unlock this feature and premium tools.').replace('%s', planLabel))
                        : ((i18n.featureUpgradeBody || 'Upgrade to %s to unlock this feature and premium tools.').replace('%s', planLabel))),
                supporting: options.supporting
                    || (trialEligible
                        ? (plan === 'business'
                            ? (i18n.businessTrialSupporting || '')
                            : (i18n.siteLayoutSupporting || ''))
                        : (plan === 'business'
                            ? (i18n.businessTrialIneligibleSupporting || 'Charged at checkout. Cancel anytime.')
                            : (i18n.trialIneligibleSupporting || 'Charged at checkout. Cancel anytime.'))),
                primaryLabel: trialEligible
                    ? (isSchema ? 'Start 7-day Business trial' : (i18n.siteLayoutCta || 'Start 7-day Site trial'))
                    : (options.upgradeCta || i18n.customizeUpgradeCta || 'Upgrade'),
                secondaryLabel: isSchema ? 'Compare plans' : (i18n.featureTrialSecondary || 'Not now'),
                onSecondary: isSchema ? function () { window.open('https://grwidget.com/pricing?source=wordpress', '_blank', 'noopener,noreferrer'); closeUnlockModal(); } : undefined,
                footer: trialEligible
                    ? (i18n.siteLayoutFooter || 'Cancel anytime during the trial')
                    : '',
                onPrimary: function () {
                    closeUnlockModal();
                    var url = resolveCheckoutUrl(checkoutUrl, trialEligible, plan);
                    openCheckoutPopup(url || '/', options.layoutKey || '', options.featureSlug || '');
                },
            });
        }

        $(document).on('click', '[data-grwi-locked-switch]', function (e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            var $input = $(this).is('.grw-switch__input, input[type="checkbox"]')
                ? $(this)
                : $(this).closest('.grw-switch, .grw-field--switch').find('.grw-switch__input, input[type="checkbox"]').first();
            if ($input.length) {
                $input.each(function () {
                    this.checked = this.defaultChecked;
                    if (this.getAttribute('role') === 'switch') {
                        this.setAttribute('aria-checked', this.checked ? 'true' : 'false');
                    }
                });
            }
            var el = $input[0] || this;
            var feature = String($(this).attr('data-grwi-locked-switch') || (el && el.getAttribute && el.getAttribute('data-grwi-locked-switch')) || 'ai_summary');
            var plan = (feature === 'ai_summary' || feature === 'json_ld' || feature === 'review_photos')
                ? 'business'
                : 'site';
            var prompt = {};
            if (editor && editor.feature_prompts) {
                var map = {
                    ai_summary: 'ai_summary',
                    json_ld: 'review_jsonld',
                    review_photos: 'uploaded_review_photos',
                    filters: 'review_filters',
                    advanced_customisation: 'advanced_customisation',
                };
                prompt = editor.feature_prompts[map[feature] || feature] || {};
            }
            promptFeatureTrial({
                featureKey: feature,
                plan: plan,
                trialEligible: customizeTrialFromEditor(),
                checkoutUrl: prompt.checkout_url || '',
                title: prompt.title || '',
                body: prompt.body || '',
                supporting: prompt.supporting || '',
                upgradeCta: prompt.primary_label || undefined,
            });
            return false;
        });

        function customizeTrialFromEditor() {
            if (editor && Object.prototype.hasOwnProperty.call(editor, 'trial_eligible')) {
                if (editor.trial_eligible === null) {
                    return false;
                }
                return !!editor.trial_eligible;
            }
            return !!cfg.trialEligible;
        }

        $(document).on('click', '[data-grwi-connect-account]', function (e) {
            e.preventDefault();
            e.stopPropagation();
            startConnectFromLayout();
        });

        // Upsell / trial / upgrade CTAs — always open in-builder unlock modal (never jump to /pricing).
        $(document).on('click', '[data-grwi-trial-cta], a.grw-customize-trial-card__cta', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var $btn = $(this);
            var featureKey = String($btn.attr('data-feature') || $btn.data('feature') || 'builder_customize');
            var plan = String($btn.attr('data-plan') || $btn.data('plan') || 'site');
            var trialEligible = String(
                $btn.attr('data-trial-eligible')
                || $btn.data('trialEligible')
                || $btn.data('trial-eligible')
                || '0'
            ) === '1';
            var checkoutUrl = String(
                $btn.attr('data-checkout-url')
                || $btn.data('checkoutUrl')
                || $btn.attr('href')
                || ''
            );
            var featureLabel = String($btn.attr('data-feature-label') || $btn.data('featureLabel') || '');
            var body = String($btn.attr('data-modal-body') || $btn.data('modalBody') || '');
            var supporting = String($btn.attr('data-modal-supporting') || $btn.data('modalSupporting') || '');
            var title = String($btn.attr('data-modal-title') || $btn.data('modalTitle') || '');
            var ctaLabel = String($btn.text() || '').replace(/\s+/g, ' ').trim();
            var layoutKey = String($btn.attr('data-layout') || $btn.data('layout') || '');
            var featureSlug = '';
            if (featureKey.indexOf('premium_layout_') === 0 || featureKey === 'premium_layouts') {
                featureSlug = featureKey;
            } else if (layoutKey && LAYOUT_FEATURE_SLUGS[layoutKey]) {
                featureSlug = LAYOUT_FEATURE_SLUGS[layoutKey];
            }
            promptFeatureTrial({
                featureKey: featureKey,
                featureLabel: featureLabel,
                featureSlug: featureSlug,
                layoutKey: layoutKey,
                plan: plan,
                trialEligible: trialEligible,
                checkoutUrl: checkoutUrl,
                body: body,
                supporting: supporting,
                title: title,
                upgradeCta: ctaLabel || undefined,
            });
        });

        $(document).on('click', '#grwi-preview-first-banner-trial', function (e) {
            var req = editor.requirement || computePreviewFirstRequirement(collectConfigFromForm(), currentLayoutKey());
            if (req && req.account_link_required && !req.required_plan_key) {
                e.preventDefault();
                saveWidget({
                    saveMode: 'draft',
                    onSuccess: function () {
                        startConnectFromLayout();
                    },
                    onError: function () {
                        startConnectFromLayout();
                    }
                });
            }
        });

        window.GrwiCustomizeLayout = {
            mountLayoutGalleryPreviews: mountLayoutGalleryPreviews,
            refitMountedLayoutGalleryPreviews: refitMountedLayoutGalleryPreviews,
            applyLayoutSelection: applyLayoutSelection,
            openUnlockModal: openUnlockModal,
            closeUnlockModal: closeUnlockModal,
            promptFeatureTrial: promptFeatureTrial,
            showPreviewFirstPublishModal: showPreviewFirstPublishModal,
            syncPreviewFirstBanner: syncPreviewFirstBanner,
        };
    })();

    if (window.GrwiBuilder) {
        GrwiBuilder.renderAllPanels(editor);
        bindPanelInteractions();
    }
    activateSection(activeSection);
    if (window.GrwiCustomizeLayout) {
        GrwiCustomizeLayout.mountLayoutGalleryPreviews();
    }
    // Baseline after panels render so fingerprint matches form-collected config.
    window.setTimeout(function () {
        baselineSavedConfig();
    }, 0);

    var syncLiveDraftContext = function () {};

    function applySavedLiveDraftState(nextEditor) {
        var $switch = $('#grwi-live-draft-switch');
        if (!$switch.length || !nextEditor) {
            return;
        }
        var live = nextEditor.live_preview;
        if (live && typeof live === 'object') {
            editor.live_preview = live;
            if (live.plan_name) {
                $switch.attr('data-plan-name', live.plan_name);
            }
            if (live.live_label) {
                $switch.find('[data-grwi-preview-mode="live"]').text(live.live_label);
            }
        }
        var show = live && Object.prototype.hasOwnProperty.call(live, 'show_toggle')
            ? !!live.show_toggle
            : !!nextEditor.has_unpublished_draft;
        $switch.attr('data-grwi-live-draft', show ? 'shown' : 'available');
        if (!show && window.grwiLivePreviewActive) {
            window.grwiLivePreviewActive = false;
            $('#grwi-customize-panels').removeClass('is-live-locked');
            $('#grwi-live-draft-lock').prop('hidden', true);
            $switch.find('[data-grwi-preview-mode]').each(function () {
                var on = $(this).attr('data-grwi-preview-mode') === 'draft';
                $(this).toggleClass('is-active', on).attr('aria-pressed', on ? 'true' : 'false');
            });
            mountPreview();
        }
        syncLiveDraftContext();
    }

    (function bindLiveDraftToggle() {
        var $switch = $('#grwi-live-draft-switch');
        if (!$switch.length || !editor.live_preview || !editor.live_preview.embed) {
            return;
        }
        var $line = $('#grwi-live-draft-context');
        var $text = $('#grwi-live-draft-context-text');
        var $action = $('#grwi-live-draft-action');
        var $panels = $('#grwi-customize-panels');
        var $lock = $('#grwi-live-draft-lock');

        function syncContext() {
            var planLabel = $switch.attr('data-plan-name') || 'Free';
            var dirty = $('#grwi-customize-status').attr('data-state') === 'unsaved';
            var show = $switch.attr('data-grwi-live-draft') === 'shown' || dirty;
            $switch.prop('hidden', !show);
            $line.prop('hidden', !show);
            if (!show) {
                $action.prop('hidden', true);
                return;
            }
            if (window.grwiLivePreviewActive) {
                $text.text('This is what visitors see on your site now (' + planLabel + ' plan). Switch to Draft to keep editing.');
                $action.prop('hidden', true);
                return;
            }
            var req = editor.requirement || null;
            var names = req && req.feature_names ? req.feature_names : [];
            if (req && req.can_publish === false && names.length) {
                var plan = req.required_plan_name || 'Site';
                $text.text('Your draft uses ' + names.join(', ') + '. It needs the ' + plan + ' plan. Save draft keeps it; upgrade to publish it.');
                var trial = (editor.preview_first_catalog && editor.preview_first_catalog.trial) || {};
                var days = trial.days || 7;
                $action.prop('hidden', false).text(trial.eligible === false
                    ? ('Upgrade to ' + plan)
                    : ('Start ' + days + '-day ' + plan + ' trial'));
                return;
            }
            $text.text('You have unpublished changes. Publish to update your live widget.');
            $action.prop('hidden', true);
        }

        function setMode(live) {
            window.grwiLivePreviewActive = !!live;
            $switch.find('[data-grwi-preview-mode]').each(function () {
                var on = $(this).attr('data-grwi-preview-mode') === (live ? 'live' : 'draft');
                $(this).toggleClass('is-active', on).attr('aria-pressed', on ? 'true' : 'false');
            });
            $panels.toggleClass('is-live-locked', !!live);
            $lock.prop('hidden', !live);
            if (live) {
                mountPublishedPreview();
            } else {
                mountPreview();
            }
            syncContext();
        }

        $switch.on('click', '[data-grwi-preview-mode]', function (event) {
            event.preventDefault();
            setMode($(this).attr('data-grwi-preview-mode') === 'live');
        });
        $panels.on('input.grwiLiveDraft change.grwiLiveDraft', function () {
            if ($switch.attr('data-grwi-live-draft') !== 'shown') {
                $switch.attr('data-grwi-live-draft', 'shown');
            }
            window.setTimeout(syncContext, 0);
        });
        syncLiveDraftContext = syncContext;
        syncContext();
    })();

    loadPreviewData();
    if (window.GrwiCustomizeLayout && typeof GrwiCustomizeLayout.syncPreviewFirstBanner === 'function') {
        GrwiCustomizeLayout.syncPreviewFirstBanner();
    }

    $(document).on('click', '[data-grwi-toast-close]', function (e) {
        e.preventDefault();
        $('#grwi-preview-first-toast').attr('hidden', true);
    });
    $(document).on('keydown.grwiPreviewFirstToast', function (e) {
        if (e.key === 'Escape' && $('#grwi-preview-first-toast').length && !$('#grwi-preview-first-toast').is('[hidden]')) {
            $('#grwi-preview-first-toast').attr('hidden', true);
        }
    });
})(jQuery);
